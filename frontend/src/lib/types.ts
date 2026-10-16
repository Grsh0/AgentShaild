// أنواع البيانات مطابقة لمخطط قاعدة البيانات (القسم 3.9) ومخطط الأصناف (القسم 3.10.3)

export type TrustTier = "HIGH" | "MEDIUM" | "LOW";
export type OperationType = "READ" | "WRITE" | "DELETE" | "EXEC";
export type AbacDecision = "ALLOW" | "DENY" | "HITL_REQUIRED";
export type Sensitivity = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

export type AgentFramework = "LANGCHAIN" | "LANGGRAPH" | "CREWAI" | "AUTOGEN" | "SEMANTIC_KERNEL" | "LLAMAINDEX" | "CUSTOM_SDK";

/** النتيجة النهائية للطلب كما تظهر في السجل، مع رمز الرد المقابل في مخطط النشاط */
export type RequestStatus =
  | "ALLOWED" // 200
  | "BLOCKED" // 403
  | "PENDING_HITL" // 202
  | "HITL_APPROVED" // 200 بعد الموافقة
  | "HITL_REJECTED" // 403
  | "HITL_TIMED_OUT" // 408
  | "KILL_SWITCH_BLOCKED" // 503
  | "AUTH_FAILED" // 401
  | "INVALID_REQUEST"; // 400

export type HttpStatus = 200 | 202 | 400 | 401 | 403 | 408 | 503;

export type HitlDecision = "PENDING" | "APPROVED" | "REJECTED" | "TIMED_OUT";

export type TriggerEngine = "ABAC" | "INJECTION" | "DLP" | "RISK" | "DESTRUCTIVE_OP" | "TOOL_DISABLED";

/** تصنيف التهديدات حسب الشكل 4 في الوثيقة */
export type ThreatCategory = "DIRECT_INJECTION" | "INDIRECT_INJECTION" | "DATA_EXFILTRATION" | "EXCESSIVE_AGENCY";

export type RedactionType = "SECRET" | "HIGH_ENTROPY" | "EMAIL" | "PHONE" | "SSN" | "IBAN" | "CARD";

/** مصدر النص الذي يحمل المعاملات: من المستخدم مباشرة أو من محتوى خارجي قرأه الوكيل */
export type ContentSource = "USER_PROMPT" | "RETRIEVED_CONTENT";

export type AuditEventType =
  | "TOOL_CALL_ALLOWED"
  | "TOOL_CALL_BLOCKED"
  | "AUTH_FAILED"
  | "INVALID_REQUEST"
  | "HITL_ESCALATED"
  | "HITL_APPROVED"
  | "HITL_REJECTED"
  | "HITL_TIMED_OUT"
  | "KILL_SWITCH_ACTIVATED"
  | "KILL_SWITCH_DEACTIVATED"
  | "KILL_SWITCH_BLOCKED"
  | "POLICY_CREATED"
  | "POLICY_UPDATED"
  | "POLICY_DELETED"
  | "AGENT_REGISTERED"
  | "AGENT_UPDATED"
  | "AGENT_DEACTIVATED"
  | "AGENT_ACTIVATED"
  | "TOOL_DISABLED"
  | "TOOL_ENABLED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "SETTINGS_UPDATED";

export interface User {
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  clearance: Sensitivity;
  kind: "HUMAN" | "SERVICE";
  mfa_enabled: boolean;
  is_admin: boolean;
  is_active: boolean;
  created_at: number;
  last_login_at: number | null;
}

export interface Agent {
  agent_id: string;
  agent_name: string;
  framework: AgentFramework;
  model: string;
  purpose: string;
  trust_tier: TrustTier;
  owner_user_id: string;
  allowed_tools: string[];
  /** بصمة شهادة الوكيل الموقّعة (النصف الثاني من الهوية المزدوجة) */
  certificate_fingerprint: string;
  certificate_expires_at: number;
  is_active: boolean;
  registered_at: number;
  deactivated_at: number | null;
  last_seen_at: number | null;
}

export type ResourceKind = "DATABASE" | "FILES" | "EMAIL" | "HTTP" | "SHELL";

export interface Resource {
  resource_id: string;
  name: string;
  kind: ResourceKind;
  endpoint: string;
  sensitivity: Sensitivity;
  /** هل الوجهة داخل حدود المؤسسة */
  internal: boolean;
}

export interface Tool {
  tool_name: string;
  description: string;
  operation_type: OperationType;
  resource_id: string;
  /** أداة مسجلة كعملية تدميرية تتحول دائماً للموافقة البشرية (FR-17) */
  destructive: boolean;
  enabled: boolean;
  disabled_at: number | null;
}

export interface SubjectRule {
  roles: string[];
  departments: string[];
  trust_tiers: TrustTier[];
}

export interface ResourceRule {
  tools: string[];
  sensitivity: Sensitivity[];
}

export interface ActionRule {
  operations: OperationType[];
}

export interface AbacPolicy {
  policy_id: string;
  policy_name: string;
  description: string;
  subject_rule: SubjectRule;
  resource_rule: ResourceRule;
  action_rule: ActionRule;
  effect: AbacDecision;
  priority: number;
  is_active: boolean;
  evaluations: number;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface Redaction {
  field: string;
  type: RedactionType;
  token: string;
}

export type StageId = "SCHEMA" | "KILL_SWITCH" | "AUTH" | "TOOL" | "ABAC" | "INJECTION" | "DLP" | "RISK" | "ROUTE" | "OUTBOUND_DLP";
export type StageResult = "PASS" | "FAIL" | "FLAG" | "SKIP";

export interface PipelineStage {
  id: StageId;
  result: StageResult;
  duration_ms: number;
  /** مفتاح ترجمة مع قيم إضافية لشرح نتيجة المرحلة */
  note?: string;
}

export interface RiskBreakdown {
  abac: number;
  injection: number;
  dlp: number;
  operation: number;
  trust: number;
}

export interface ToolCallRequest {
  request_id: string;
  user_id: string;
  agent_id: string;
  tool_name: string;
  resource_id: string | null;
  operation_type: OperationType;
  source: ContentSource;
  /** تبقى المعاملات الأصلية في الخادم فقط ولا تُعرض في اللوحة */
  sanitized_arguments: Record<string, unknown>;
  dlp_redactions: Redaction[];
  /** عدد ما أُخفي من نتيجة الأداة قبل إعادتها للوكيل (FR-15) */
  outbound_redactions: number;
  injection_score: number;
  matched_signatures: string[];
  risk_score: number;
  risk_breakdown: RiskBreakdown;
  abac_decision: AbacDecision;
  triggered_policy_id: string | null;
  triggered_engines: TriggerEngine[];
  threat_category: ThreatCategory | null;
  pipeline: PipelineStage[];
  status: RequestStatus;
  http_status: HttpStatus;
  latency_ms: number;
  received_at: number;
  resolved_at: number | null;
}

export interface HitlQueueItem {
  item_id: string;
  request_id: string;
  escalation_reason: TriggerEngine;
  reviewer_user_id: string | null;
  decision: HitlDecision;
  timeout_at: number;
  queued_at: number;
  resolved_at: number | null;
  admin_notes: string | null;
}

export interface AuditLog {
  log_id: string;
  index: number;
  request_id: string | null;
  event_type: AuditEventType;
  actor_user_id: string | null;
  payload_hash: string;
  event_details: Record<string, unknown>;
  hmac_signature: string;
  previous_entry_hash: string;
  timestamp: number;
}

export interface RiskWeights {
  abac: number;
  injection: number;
  dlp: number;
  operation: number;
  trust: number;
}

export interface GatewaySettings {
  kill_switch_active: boolean;
  hitl_timeout_seconds: number;
  risk_threshold: number;
  similarity_threshold: number;
  entropy_threshold: number;
  latency_alert_ms: number;
  error_rate_alert_pct: number;
  risk_weights: RiskWeights;
  modules: {
    injection_signatures: boolean;
    injection_semantic: boolean;
    dlp_secrets: boolean;
    dlp_entropy: boolean;
    dlp_pii: boolean;
    outbound_dlp: boolean;
  };
  last_modified_by: string;
  last_modified_at: number;
  kill_switch_activated_at: number | null;
}

export type ServiceName = "proxy" | "websocket" | "abac" | "redis" | "postgres";

export interface ServiceHealth {
  name: ServiceName;
  status: "UP" | "DEGRADED" | "DOWN";
  latency_ms: number;
}

export interface MetricPoint {
  t: number;
  rps: number;
  avg_ms: number;
  p95_ms: number;
}

export type NoticeKind = "HITL_NEW" | "LATENCY_BREACH" | "KILL_SWITCH" | "AGENT_DEACTIVATED" | "TOOL_DISABLED";

export interface Notice {
  id: string;
  kind: NoticeKind;
  at: number;
  read: boolean;
  /** معرّف العنصر المرتبط (طلب الموافقة أو الوكيل أو الأداة) */
  ref?: string;
  value?: number;
}

export type ChainVerification =
  | { status: "INTACT"; checked: number; at: number }
  | { status: "COMPROMISED"; checked: number; at: number; index: number; reason: "PAYLOAD_HASH" | "SIGNATURE" | "CHAIN_LINK" };
