// مسار معالجة طلب أداة واحد كما في مخطط النشاط (القسم 3.10.2)
import type {
  AbacPolicy,
  Agent,
  ContentSource,
  GatewaySettings,
  HttpStatus,
  OperationType,
  PipelineStage,
  RequestStatus,
  Resource,
  RiskBreakdown,
  StageId,
  ThreatCategory,
  Tool,
  ToolCallRequest,
  TriggerEngine,
  TrustTier,
  User,
} from "../types";
import { evaluateAbac, type AbacResult } from "./abac";
import { scanDlp, scanInjection, type InjectionResult } from "./inspect";

export interface ToolCallInput {
  /** null يمثل طلباً مشوّهاً لا يطابق المخطط */
  tool_name: string | null;
  arguments: Record<string, unknown> | null;
  user_id: string;
  agent_id: string;
  /** صلاحية توقيع وتاريخ رمز الهوية المزدوجة */
  token_valid: boolean;
  source: ContentSource;
  /** ناتج الأداة لو نُفذت، يمر على فحص التسريب الصادر */
  output?: unknown;
}

export interface GatewayEnv {
  settings: GatewaySettings;
  users: User[];
  agents: Agent[];
  tools: Tool[];
  resources: Resource[];
  policies: AbacPolicy[];
}

export interface PipelineResult {
  request: ToolCallRequest;
  escalation: TriggerEngine | null;
  abac: AbacResult | null;
  injection: InjectionResult | null;
}

const OP_RISK: Record<OperationType, number> = { READ: 0.1, WRITE: 0.4, EXEC: 0.75, DELETE: 0.9 };
const TRUST_RISK: Record<TrustTier, number> = { HIGH: 0.1, MEDIUM: 0.4, LOW: 0.8 };
const ABAC_RISK = { ALLOW: 0, HITL_REQUIRED: 0.6, DENY: 1 } as const;

const STAGE_ORDER: StageId[] = ["SCHEMA", "KILL_SWITCH", "AUTH", "TOOL", "ABAC", "INJECTION", "DLP", "RISK", "ROUTE", "OUTBOUND_DLP"];
const STAGE_COST: Record<StageId, [number, number]> = {
  SCHEMA: [0.2, 0.8],
  KILL_SWITCH: [0.05, 0.2],
  AUTH: [1.5, 4.5],
  TOOL: [0.05, 0.2],
  ABAC: [0.4, 1.8],
  INJECTION: [9, 34],
  DLP: [0.8, 6],
  RISK: [0.1, 0.4],
  ROUTE: [0.6, 3],
  OUTBOUND_DLP: [0.8, 4],
};

const rnd = (r: [number, number]) => Math.round((r[0] + Math.random() * (r[1] - r[0])) * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** درجة الخطورة المركبة (FR-16) مع رفعها عند رصد حقن أوامر (FR-09) */
export function computeRisk(b: RiskBreakdown, settings: GatewaySettings, injectionFlagged: boolean, injectionScore: number) {
  const w = settings.risk_weights;
  const total = w.abac + w.injection + w.dlp + w.operation + w.trust || 1;
  const weighted = (b.abac * w.abac + b.injection * w.injection + b.dlp * w.dlp + b.operation * w.operation + b.trust * w.trust) / total;
  return round2(Math.min(1, Math.max(weighted, injectionFlagged ? injectionScore : 0)));
}

export function runPipeline(input: ToolCallInput, env: GatewayEnv, at: number, id: string): PipelineResult {
  const { settings } = env;
  const stages: PipelineStage[] = [];
  const pass = (stage: StageId, result: PipelineStage["result"] = "PASS", note?: string) =>
    stages.push({ id: stage, result, duration_ms: rnd(STAGE_COST[stage]), note });

  const user = env.users.find((u) => u.user_id === input.user_id);
  const agent = env.agents.find((a) => a.agent_id === input.agent_id);
  const tool = input.tool_name ? env.tools.find((t) => t.tool_name === input.tool_name) : undefined;
  const resource = tool ? env.resources.find((r) => r.resource_id === tool.resource_id) ?? null : null;

  const base: ToolCallRequest = {
    request_id: id,
    user_id: input.user_id,
    agent_id: input.agent_id,
    tool_name: input.tool_name ?? "—",
    resource_id: resource?.resource_id ?? null,
    operation_type: tool?.operation_type ?? "READ",
    source: input.source,
    sanitized_arguments: {},
    dlp_redactions: [],
    outbound_redactions: 0,
    injection_score: 0,
    matched_signatures: [],
    risk_score: 0,
    risk_breakdown: { abac: 0, injection: 0, dlp: 0, operation: 0, trust: 0 },
    abac_decision: "DENY",
    triggered_policy_id: null,
    triggered_engines: [],
    threat_category: null,
    pipeline: stages,
    status: "ALLOWED",
    http_status: 200,
    latency_ms: 0,
    received_at: at,
    resolved_at: at,
  };

  const finish = (status: RequestStatus, http: HttpStatus, extra: Partial<ToolCallRequest> = {}): ToolCallRequest => {
    const done = new Set(stages.map((s) => s.id));
    for (const s of STAGE_ORDER) if (!done.has(s)) stages.push({ id: s, result: "SKIP", duration_ms: 0 });
    const latency = round2(stages.reduce((sum, s) => sum + s.duration_ms, 0));
    return { ...base, ...extra, status, http_status: http, latency_ms: Math.round(latency), pipeline: stages, resolved_at: status === "PENDING_HITL" ? null : at };
  };

  // 1) التحقق من بنية الطلب (NFR-09)
  if (!input.tool_name || !input.arguments || !tool) {
    pass("SCHEMA", "FAIL", !input.tool_name ? "missing_tool" : "unknown_tool");
    return { request: finish("INVALID_REQUEST", 400), escalation: null, abac: null, injection: null };
  }
  pass("SCHEMA");

  // 2) زر الإيقاف الطارئ (FR-25)
  if (settings.kill_switch_active) {
    pass("KILL_SWITCH", "FAIL");
    return { request: finish("KILL_SWITCH_BLOCKED", 503), escalation: null, abac: null, injection: null };
  }
  pass("KILL_SWITCH");

  // 3) الهوية المزدوجة: رمز المستخدم وشهادة الوكيل (FR-05)
  if (!input.token_valid || !user?.is_active || !agent?.is_active || (agent && agent.certificate_expires_at < at)) {
    const note = !input.token_valid ? "token_invalid" : !agent?.is_active ? "agent_inactive" : !user?.is_active ? "user_inactive" : "cert_expired";
    pass("AUTH", "FAIL", note);
    return { request: finish("AUTH_FAILED", 401), escalation: null, abac: null, injection: null };
  }
  pass("AUTH");

  // 4) الأداة معطلة على مستوى البوابة
  if (!tool.enabled) {
    pass("TOOL", "FAIL");
    return {
      request: finish("BLOCKED", 403, { triggered_engines: ["TOOL_DISABLED"], threat_category: null }),
      escalation: null,
      abac: null,
      injection: null,
    };
  }
  pass("TOOL");

  // 5) سياسات الصلاحيات (FR-07, FR-08)
  const abac = evaluateAbac({ user, agent, tool, resource }, env.policies);
  const trust = TRUST_RISK[agent.trust_tier];
  const operation = OP_RISK[tool.operation_type];
  if (abac.decision === "DENY") {
    pass("ABAC", "FAIL", abac.policy?.policy_name ?? abac.rule ?? undefined);
    const breakdown = { abac: 1, injection: 0, dlp: 0, operation, trust };
    return {
      request: finish("BLOCKED", 403, {
        abac_decision: "DENY",
        triggered_policy_id: abac.policy?.policy_id ?? null,
        triggered_engines: ["ABAC"],
        risk_breakdown: breakdown,
        risk_score: computeRisk(breakdown, settings, false, 0),
        threat_category: "EXCESSIVE_AGENCY",
      }),
      escalation: null,
      abac,
      injection: null,
    };
  }
  pass("ABAC", abac.decision === "HITL_REQUIRED" ? "FLAG" : "PASS", abac.policy?.policy_name ?? abac.rule ?? undefined);

  // 6) و 7) فحص الحقن ومنع التسريب يعملان بالتوازي على النسخة الأصلية
  const injection = scanInjection(input.arguments, settings);
  pass("INJECTION", injection.flagged ? "FLAG" : "PASS", injection.matched.join(",") || undefined);
  const dlp = scanDlp(input.arguments, settings);
  pass("DLP", dlp.redactions.length ? "FLAG" : "PASS", dlp.redactions.length ? String(dlp.redactions.length) : undefined);

  // 8) درجة الخطورة
  const breakdown: RiskBreakdown = { abac: ABAC_RISK[abac.decision], injection: injection.score, dlp: dlp.severity, operation, trust };
  const risk = computeRisk(breakdown, settings, injection.flagged, injection.score);
  pass("RISK", risk >= settings.risk_threshold ? "FLAG" : "PASS", risk.toFixed(2));

  const engines: TriggerEngine[] = [];
  if (abac.decision === "HITL_REQUIRED") engines.push("ABAC");
  if (injection.flagged) engines.push("INJECTION");
  if (dlp.redactions.length) engines.push("DLP");
  if (tool.destructive) engines.push("DESTRUCTIVE_OP");
  if (risk >= settings.risk_threshold) engines.push("RISK");

  const hasSecret = dlp.redactions.some((r) => r.type === "SECRET" || r.type === "HIGH_ENTROPY");
  const category: ThreatCategory | null = injection.flagged
    ? input.source === "USER_PROMPT"
      ? "DIRECT_INJECTION"
      : "INDIRECT_INJECTION"
    : hasSecret || (dlp.redactions.length > 0 && resource && !resource.internal && resource.kind === "HTTP")
      ? "DATA_EXFILTRATION"
      : tool.destructive
        ? "EXCESSIVE_AGENCY"
        : null;

  const common: Partial<ToolCallRequest> = {
    sanitized_arguments: dlp.sanitized,
    dlp_redactions: dlp.redactions,
    injection_score: injection.score,
    matched_signatures: injection.matched,
    risk_score: risk,
    risk_breakdown: breakdown,
    abac_decision: abac.decision,
    triggered_policy_id: abac.policy?.policy_id ?? null,
    triggered_engines: engines,
    threat_category: category,
  };

  // 9) التوجيه: موافقة بشرية أو تنفيذ (FR-17)
  const escalate = abac.decision === "HITL_REQUIRED" || risk >= settings.risk_threshold || tool.destructive;
  if (escalate) {
    pass("ROUTE", "FLAG", "hitl");
    const reason: TriggerEngine = tool.destructive ? "DESTRUCTIVE_OP" : injection.flagged ? "INJECTION" : abac.decision === "HITL_REQUIRED" ? "ABAC" : "RISK";
    return { request: finish("PENDING_HITL", 202, common), escalation: reason, abac, injection };
  }
  pass("ROUTE", "PASS", "execute");

  // 10) فحص ناتج الأداة قبل إعادته للوكيل (FR-15)
  const outbound = settings.modules.outbound_dlp && input.output !== undefined ? scanDlp({ output: input.output }, settings).redactions.length : 0;
  pass("OUTBOUND_DLP", outbound ? "FLAG" : settings.modules.outbound_dlp ? "PASS" : "SKIP", outbound ? String(outbound) : undefined);

  return { request: finish("ALLOWED", 200, { ...common, outbound_redactions: outbound }), escalation: null, abac, injection };
}
