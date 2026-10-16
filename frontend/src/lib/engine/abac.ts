// تقييم سياسات الصلاحيات المبنية على السمات (FR-07): حتمي بالكامل وأول قاعدة مطابقة تحسم القرار
import type { AbacDecision, AbacPolicy, Agent, Resource, Sensitivity, Tool, User } from "../types";

export const SENSITIVITY_RANK: Record<Sensitivity, number> = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3 };

export interface AbacContext {
  user: User;
  agent: Agent;
  tool: Tool;
  resource: Resource | null;
}

/** قواعد مدمجة تسبق سياسات المسؤول */
export type BuiltInRule = "AGENT_SCOPE" | "USER_CLEARANCE" | "DEFAULT";

export interface AbacResult {
  decision: AbacDecision;
  policy: AbacPolicy | null;
  rule: BuiltInRule | null;
  /** السياسات التي فُحصت بالترتيب حتى وُجدت المطابقة */
  evaluated: { policy: AbacPolicy; matched: boolean }[];
}

function listMatch<T>(list: T[], value: T | undefined): boolean {
  return list.length === 0 || (value !== undefined && list.includes(value));
}

export function policyMatches(p: AbacPolicy, ctx: AbacContext): boolean {
  return (
    listMatch(p.subject_rule.roles, ctx.user.role) &&
    listMatch(p.subject_rule.departments, ctx.user.department) &&
    listMatch(p.subject_rule.trust_tiers, ctx.agent.trust_tier) &&
    listMatch(p.resource_rule.tools, ctx.tool.tool_name) &&
    listMatch(p.resource_rule.sensitivity, ctx.resource?.sensitivity) &&
    listMatch(p.action_rule.operations, ctx.tool.operation_type)
  );
}

export function evaluateAbac(ctx: AbacContext, policies: AbacPolicy[]): AbacResult {
  // نطاق الوكيل: لا يستدعي إلا الأدوات المسجلة له (AR-06)
  if (!ctx.agent.allowed_tools.includes(ctx.tool.tool_name)) {
    return { decision: "DENY", policy: null, rule: "AGENT_SCOPE", evaluated: [] };
  }
  // تصريح المستخدم يجب أن يغطي حساسية المورد
  if (ctx.resource && SENSITIVITY_RANK[ctx.user.clearance] < SENSITIVITY_RANK[ctx.resource.sensitivity]) {
    return { decision: "DENY", policy: null, rule: "USER_CLEARANCE", evaluated: [] };
  }

  const evaluated: AbacResult["evaluated"] = [];
  const ordered = policies.filter((p) => p.is_active).sort((a, b) => a.priority - b.priority);
  for (const p of ordered) {
    const matched = policyMatches(p, ctx);
    evaluated.push({ policy: p, matched });
    if (matched) return { decision: p.effect, policy: p, rule: null, evaluated };
  }
  // لا توجد مطابقة: القراءة والكتابة تمر للفحص، والحذف والتنفيذ تحتاج موافقة (ثقة صفرية)
  const op = ctx.tool.operation_type;
  return { decision: op === "READ" || op === "WRITE" ? "ALLOW" : "HITL_REQUIRED", policy: null, rule: "DEFAULT", evaluated };
}
