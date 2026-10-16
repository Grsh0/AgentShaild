"use client";

// مخزن حالة اللوحة. كل طلب يمر على محرك الفحص الحقيقي (lib/engine) محلياً،
// وعند بناء الخادم تُستبدل المحاكاة باتصال WebSocket وواجهات REST دون تغيير الصفحات.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import type { GatewayEnv } from "@/lib/engine/pipeline";
import {
  CURRENT_ADMIN_ID,
  appendAudit,
  auditEventForStatus,
  generateToolCall,
  requestAuditDetails,
  seedAgents,
  seedDailyThreats,
  seedHistory,
  seedPolicies,
  seedResources,
  seedSettings,
  seedTools,
  seedUsers,
  uuid,
  verifyChain,
  type DailyThreats,
} from "@/lib/mock-data";
import type {
  AbacPolicy,
  Agent,
  AuditEventType,
  AuditLog,
  ChainVerification,
  GatewaySettings,
  HitlQueueItem,
  Notice,
  Resource,
  ServiceHealth,
  Tool,
  ToolCallRequest,
  User,
} from "@/lib/types";

const MAX_REQUESTS = 2500;

export interface LabRun {
  case_id: string;
  passed: boolean;
  http_status: number;
  latency_ms: number;
  at: number;
}

export interface GatewayState {
  now: number;
  bootedAt: number;
  users: User[];
  agents: Agent[];
  tools: Tool[];
  resources: Resource[];
  policies: AbacPolicy[];
  requests: ToolCallRequest[];
  hitl: HitlQueueItem[];
  audit: AuditLog[];
  tampered: { log_id: string; original: Record<string, unknown> } | null;
  settings: GatewaySettings;
  health: ServiceHealth[];
  verification: ChainVerification | null;
  dailyThreats: DailyThreats[];
  notices: Notice[];
  labRuns: Record<string, LabRun>;
  lastLatencyAlert: number;
}

type Action =
  | { type: "init" }
  | { type: "tick"; at: number }
  | { type: "killSwitch"; active: boolean }
  | { type: "decide"; itemId: string; decision: "APPROVED" | "REJECTED"; notes: string }
  | { type: "savePolicy"; policy: AbacPolicy; isNew: boolean }
  | { type: "deletePolicy"; id: string }
  | { type: "togglePolicy"; id: string }
  | { type: "saveAgent"; agent: Agent; isNew: boolean }
  | { type: "setAgentActive"; id: string; active: boolean }
  | { type: "setToolEnabled"; name: string; enabled: boolean }
  | { type: "saveUser"; user: User; isNew: boolean }
  | { type: "setUserActive"; id: string; active: boolean }
  | { type: "updateSettings"; patch: Partial<GatewaySettings> }
  | { type: "verify" }
  | { type: "tamper" }
  | { type: "restore" }
  | { type: "readNotices" }
  | { type: "recordLab"; runs: LabRun[] };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function envOf(s: Pick<GatewayState, "settings" | "users" | "agents" | "tools" | "resources" | "policies">): GatewayEnv {
  return { settings: s.settings, users: s.users, agents: s.agents, tools: s.tools, resources: s.resources, policies: s.policies };
}

function initialState(): GatewayState {
  const now = Date.now();
  const settings = seedSettings(now);
  const users = seedUsers(now);
  const agents = seedAgents(now);
  const tools = seedTools();
  const resources = seedResources();
  const basePolicies = seedPolicies(now);
  const env = { settings, users, agents, tools, resources, policies: basePolicies };
  const { requests, hitl, audit, evaluations } = seedHistory(now, env);

  const lastSeen = new Map<string, number>();
  for (const r of requests) if (!lastSeen.has(r.agent_id)) lastSeen.set(r.agent_id, r.received_at);

  return {
    now,
    bootedAt: now,
    users,
    agents: agents.map((a) => (a.is_active ? { ...a, last_seen_at: lastSeen.get(a.agent_id) ?? null } : a)),
    tools,
    resources,
    policies: basePolicies.map((p) => ({ ...p, evaluations: (evaluations.get(p.policy_id) ?? 0) * 7 + Math.round(rand(20, 400)) })),
    requests,
    hitl,
    audit,
    tampered: null,
    settings,
    health: [
      { name: "proxy", status: "UP", latency_ms: 4 },
      { name: "websocket", status: "UP", latency_ms: 2 },
      { name: "abac", status: "UP", latency_ms: 1 },
      { name: "redis", status: "UP", latency_ms: 1 },
      { name: "postgres", status: "UP", latency_ms: 6 },
    ],
    verification: null,
    dailyThreats: seedDailyThreats(now),
    notices: [],
    labRuns: {},
    lastLatencyAlert: 0,
  };
}

function rootReducer(state: GatewayState | null, action: Action): GatewayState | null {
  if (action.type === "init") return state ?? initialState();
  return state ? reducer(state, action) : state;
}

function notice(kind: Notice["kind"], at: number, ref?: string, value?: number): Notice {
  return { id: uuid(), kind, at, read: false, ref, value };
}

function withAudit(state: GatewayState, type: AuditEventType, details: Record<string, unknown>, opts: { actor?: string | null; request_id?: string | null; at?: number } = {}) {
  return appendAudit([...state.audit], type, details, { actor: CURRENT_ADMIN_ID, ...opts });
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function reducer(state: GatewayState, action: Exclude<Action, { type: "init" }>): GatewayState {
  switch (action.type) {
    case "tick": {
      const at = action.at;
      let { requests, hitl, policies, agents } = state;
      const audit = [...state.audit];
      const notices = [...state.notices];

      // انتهاء مهلة الطلبات المعلقة (FR-21)
      const expired = hitl.filter((h) => h.decision === "PENDING" && h.timeout_at <= at);
      if (expired.length) {
        const ids = new Set(expired.map((h) => h.item_id));
        const reqIds = new Set(expired.map((h) => h.request_id));
        hitl = hitl.map((h) => (ids.has(h.item_id) ? { ...h, decision: "TIMED_OUT", resolved_at: at } : h));
        requests = requests.map((r) => (reqIds.has(r.request_id) ? { ...r, status: "HITL_TIMED_OUT", http_status: 408, resolved_at: at } : r));
        for (const h of expired) {
          appendAudit(audit, "HITL_TIMED_OUT", { item_id: h.item_id, timeout_seconds: state.settings.hitl_timeout_seconds }, { request_id: h.request_id, at });
        }
      }

      // وصول طلبات جديدة من الوكلاء
      const incoming = Math.random() < 0.45 ? (Math.random() < 0.2 ? 2 : 1) : 0;
      const fresh: ToolCallRequest[] = [];
      const env = envOf(state);
      const evals = new Map<string, number>();
      const seen = new Map<string, number>();
      for (let i = 0; i < incoming; i++) {
        let call = generateToolCall(at, env);
        // التحويل للموافقة نادر في الحركة الطبيعية (قرابة طلب كل دقيقة)
        for (let tries = 0; call.hitl && tries < 3 && Math.random() < 0.6; tries++) call = generateToolCall(at, env);
        const { request, hitl: item, policyId } = call;
        fresh.push(request);
        if (policyId) evals.set(policyId, (evals.get(policyId) ?? 0) + 1);
        if (request.status !== "INVALID_REQUEST") seen.set(request.agent_id, at);
        if (item) {
          hitl = [item, ...hitl];
          notices.unshift(notice("HITL_NEW", at, item.item_id, request.risk_score));
        }
        appendAudit(audit, auditEventForStatus(request.status), requestAuditDetails(request), { request_id: request.request_id, at });
      }
      if (fresh.length) {
        requests = [...fresh.reverse(), ...requests].slice(0, MAX_REQUESTS);
        if (evals.size) policies = policies.map((p) => (evals.has(p.policy_id) ? { ...p, evaluations: p.evaluations + evals.get(p.policy_id)! } : p));
        agents = agents.map((a) => (seen.has(a.agent_id) && a.is_active ? { ...a, last_seen_at: seen.get(a.agent_id)! } : a));
      }

      // تنبيه تجاوز زمن المعالجة (NFR-13)
      let lastLatencyAlert = state.lastLatencyAlert;
      const p95 = percentile(requests.slice(0, 60).filter((r) => r.http_status !== 503).map((r) => r.latency_ms), 95);
      if (p95 > state.settings.latency_alert_ms && at - lastLatencyAlert > 120_000) {
        notices.unshift(notice("LATENCY_BREACH", at, undefined, p95));
        lastLatencyAlert = at;
      }

      const health = state.health.map((h) => ({ ...h, latency_ms: Math.max(1, Math.round(h.latency_ms + rand(-1, 1))) }));
      return { ...state, now: at, requests, hitl, policies, agents, audit, health, notices: notices.slice(0, 50), lastLatencyAlert };
    }

    case "killSwitch": {
      const at = Date.now();
      return {
        ...state,
        settings: {
          ...state.settings,
          kill_switch_active: action.active,
          kill_switch_activated_at: action.active ? at : state.settings.kill_switch_activated_at,
          last_modified_by: CURRENT_ADMIN_ID,
          last_modified_at: at,
        },
        notices: action.active ? [notice("KILL_SWITCH", at), ...state.notices] : state.notices,
        audit: withAudit(state, action.active ? "KILL_SWITCH_ACTIVATED" : "KILL_SWITCH_DEACTIVATED", { active: action.active }, { at }),
      };
    }

    case "decide": {
      const at = Date.now();
      const item = state.hitl.find((h) => h.item_id === action.itemId);
      if (!item || item.decision !== "PENDING") return state;
      const approved = action.decision === "APPROVED";
      return {
        ...state,
        hitl: state.hitl.map((h) =>
          h.item_id === action.itemId ? { ...h, decision: action.decision, reviewer_user_id: CURRENT_ADMIN_ID, resolved_at: at, admin_notes: action.notes || null } : h,
        ),
        requests: state.requests.map((r) =>
          r.request_id === item.request_id ? { ...r, status: approved ? "HITL_APPROVED" : "HITL_REJECTED", http_status: approved ? 200 : 403, resolved_at: at } : r,
        ),
        audit: withAudit(state, approved ? "HITL_APPROVED" : "HITL_REJECTED", { item_id: item.item_id, notes: action.notes || null }, { request_id: item.request_id, at }),
      };
    }

    case "savePolicy": {
      const policy = { ...action.policy, updated_at: Date.now() };
      return {
        ...state,
        policies: action.isNew ? [...state.policies, policy] : state.policies.map((p) => (p.policy_id === policy.policy_id ? policy : p)),
        audit: withAudit(state, action.isNew ? "POLICY_CREATED" : "POLICY_UPDATED", {
          policy_id: policy.policy_id,
          policy_name: policy.policy_name,
          effect: policy.effect,
          priority: policy.priority,
          is_active: policy.is_active,
        }),
      };
    }

    case "togglePolicy": {
      const p = state.policies.find((x) => x.policy_id === action.id);
      return p ? reducer(state, { type: "savePolicy", policy: { ...p, is_active: !p.is_active }, isNew: false }) : state;
    }

    case "deletePolicy": {
      const p = state.policies.find((x) => x.policy_id === action.id);
      if (!p) return state;
      return {
        ...state,
        policies: state.policies.filter((x) => x.policy_id !== action.id),
        audit: withAudit(state, "POLICY_DELETED", { policy_id: p.policy_id, policy_name: p.policy_name }),
      };
    }

    case "saveAgent":
      return {
        ...state,
        agents: action.isNew ? [...state.agents, action.agent] : state.agents.map((a) => (a.agent_id === action.agent.agent_id ? action.agent : a)),
        audit: withAudit(state, action.isNew ? "AGENT_REGISTERED" : "AGENT_UPDATED", {
          agent_id: action.agent.agent_id,
          agent_name: action.agent.agent_name,
          framework: action.agent.framework,
          model: action.agent.model,
          trust_tier: action.agent.trust_tier,
          allowed_tools: action.agent.allowed_tools,
        }),
      };

    case "setAgentActive": {
      const at = Date.now();
      const agent = state.agents.find((a) => a.agent_id === action.id);
      if (!agent) return state;
      return {
        ...state,
        agents: state.agents.map((a) => (a.agent_id === action.id ? { ...a, is_active: action.active, deactivated_at: action.active ? null : at } : a)),
        notices: action.active ? state.notices : [notice("AGENT_DEACTIVATED", at, agent.agent_id), ...state.notices],
        audit: withAudit(state, action.active ? "AGENT_ACTIVATED" : "AGENT_DEACTIVATED", { agent_id: agent.agent_id, agent_name: agent.agent_name }, { at }),
      };
    }

    case "setToolEnabled": {
      const at = Date.now();
      return {
        ...state,
        tools: state.tools.map((t) => (t.tool_name === action.name ? { ...t, enabled: action.enabled, disabled_at: action.enabled ? null : at } : t)),
        notices: action.enabled ? state.notices : [notice("TOOL_DISABLED", at, action.name), ...state.notices],
        audit: withAudit(state, action.enabled ? "TOOL_ENABLED" : "TOOL_DISABLED", { tool: action.name }, { at }),
      };
    }

    case "saveUser":
      return {
        ...state,
        users: action.isNew ? [...state.users, action.user] : state.users.map((u) => (u.user_id === action.user.user_id ? action.user : u)),
        audit: withAudit(state, action.isNew ? "USER_CREATED" : "USER_UPDATED", {
          user_id: action.user.user_id,
          username: action.user.username,
          role: action.user.role,
          department: action.user.department,
          clearance: action.user.clearance,
        }),
      };

    case "setUserActive": {
      const user = state.users.find((u) => u.user_id === action.id);
      if (!user) return state;
      return reducer(state, { type: "saveUser", user: { ...user, is_active: action.active }, isNew: false });
    }

    case "updateSettings":
      return {
        ...state,
        settings: { ...state.settings, ...action.patch, last_modified_by: CURRENT_ADMIN_ID, last_modified_at: Date.now() },
        audit: withAudit(state, "SETTINGS_UPDATED", action.patch as Record<string, unknown>),
      };

    case "verify":
      return { ...state, verification: verifyChain(state.audit) };

    case "tamper": {
      if (state.tampered || state.audit.length < 10) return state;
      const target = state.audit[Math.floor(state.audit.length * (0.2 + Math.random() * 0.5))];
      return {
        ...state,
        tampered: { log_id: target.log_id, original: target.event_details },
        audit: state.audit.map((e) => (e.log_id === target.log_id ? { ...e, event_details: { ...e.event_details, risk_score: 0.01, status: "ALLOWED" } } : e)),
        verification: null,
      };
    }

    case "restore": {
      if (!state.tampered) return state;
      const { log_id, original } = state.tampered;
      return { ...state, audit: state.audit.map((e) => (e.log_id === log_id ? { ...e, event_details: original } : e)), tampered: null, verification: null };
    }

    case "readNotices":
      return { ...state, notices: state.notices.map((n) => (n.read ? n : { ...n, read: true })) };

    case "recordLab":
      return { ...state, labRuns: { ...state.labRuns, ...Object.fromEntries(action.runs.map((r) => [r.case_id, r])) } };
  }
}

interface GatewayContext {
  state: GatewayState;
  activateKillSwitch: () => void;
  deactivateKillSwitch: () => void;
  decide: (itemId: string, decision: "APPROVED" | "REJECTED", notes: string) => void;
  savePolicy: (policy: AbacPolicy, isNew: boolean) => void;
  deletePolicy: (id: string) => void;
  togglePolicy: (id: string) => void;
  saveAgent: (agent: Agent, isNew: boolean) => void;
  setAgentActive: (id: string, active: boolean) => void;
  setToolEnabled: (name: string, enabled: boolean) => void;
  saveUser: (user: User, isNew: boolean) => void;
  setUserActive: (id: string, active: boolean) => void;
  updateSettings: (patch: Partial<GatewaySettings>) => void;
  verifyAudit: () => void;
  tamperAudit: () => void;
  restoreAudit: () => void;
  readNotices: () => void;
  recordLab: (runs: LabRun[]) => void;
  newId: () => string;
}

const Ctx = createContext<GatewayContext | null>(null);

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  // تُبنى البيانات بعد التحميل في المتصفح لتجنب اختلاف الوقت بين الخادم والمتصفح
  const [state, dispatch] = useReducer(rootReducer, null);
  const ready = state !== null;

  useEffect(() => {
    dispatch({ type: "init" });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => dispatch({ type: "tick", at: Date.now() }), 1000);
    return () => clearInterval(id);
  }, [ready]);

  const api = useMemo<Omit<GatewayContext, "state">>(
    () => ({
      activateKillSwitch: () => dispatch({ type: "killSwitch", active: true }),
      deactivateKillSwitch: () => dispatch({ type: "killSwitch", active: false }),
      decide: (itemId, decision, notes) => dispatch({ type: "decide", itemId, decision, notes }),
      savePolicy: (policy, isNew) => dispatch({ type: "savePolicy", policy, isNew }),
      deletePolicy: (id) => dispatch({ type: "deletePolicy", id }),
      togglePolicy: (id) => dispatch({ type: "togglePolicy", id }),
      saveAgent: (agent, isNew) => dispatch({ type: "saveAgent", agent, isNew }),
      setAgentActive: (id, active) => dispatch({ type: "setAgentActive", id, active }),
      setToolEnabled: (name, enabled) => dispatch({ type: "setToolEnabled", name, enabled }),
      saveUser: (user, isNew) => dispatch({ type: "saveUser", user, isNew }),
      setUserActive: (id, active) => dispatch({ type: "setUserActive", id, active }),
      updateSettings: (patch) => dispatch({ type: "updateSettings", patch }),
      verifyAudit: () => dispatch({ type: "verify" }),
      tamperAudit: () => dispatch({ type: "tamper" }),
      restoreAudit: () => dispatch({ type: "restore" }),
      readNotices: () => dispatch({ type: "readNotices" }),
      recordLab: (runs) => dispatch({ type: "recordLab", runs }),
      newId: uuid,
    }),
    [],
  );

  const value = useMemo(() => (state ? { state, ...api } : null), [state, api]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** يعيد null حتى تجهز البيانات */
export function useGatewayOptional(): GatewayContext | null {
  return useContext(Ctx);
}

export function useGateway(): GatewayContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGateway must be used after the gateway data is ready");
  return ctx;
}

export function useLookup() {
  const { state } = useGateway();
  const userById = useCallback((id: string | null) => state.users.find((u) => u.user_id === id), [state.users]);
  const agentById = useCallback((id: string | null) => state.agents.find((a) => a.agent_id === id), [state.agents]);
  const policyById = useCallback((id: string | null) => state.policies.find((p) => p.policy_id === id), [state.policies]);
  const requestById = useCallback((id: string | null) => state.requests.find((r) => r.request_id === id), [state.requests]);
  const toolByName = useCallback((name: string | null) => state.tools.find((t) => t.tool_name === name), [state.tools]);
  const resourceById = useCallback((id: string | null) => state.resources.find((r) => r.resource_id === id), [state.resources]);
  return { userById, agentById, policyById, requestById, toolByName, resourceById };
}

export { percentile };
