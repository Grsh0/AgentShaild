"use client";

import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";
import type { AbacDecision, AgentFramework, HitlDecision, HttpStatus, OperationType, RequestStatus, Sensitivity, ThreatCategory, TrustTier } from "@/lib/types";

export type Tone = "neutral" | "primary" | "danger" | "warning" | "success" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  primary: "bg-primary-soft text-primary border-primary/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  success: "bg-success-soft text-success border-success/25",
  info: "bg-info-soft text-info border-info/25",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const statusTone: Record<RequestStatus, Tone> = {
  ALLOWED: "success",
  BLOCKED: "danger",
  PENDING_HITL: "warning",
  HITL_APPROVED: "primary",
  HITL_REJECTED: "danger",
  HITL_TIMED_OUT: "neutral",
  KILL_SWITCH_BLOCKED: "danger",
  AUTH_FAILED: "danger",
  INVALID_REQUEST: "neutral",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { t } = usePrefs();
  return (
    <Badge tone={statusTone[status]} dot>
      {t.status[status]}
    </Badge>
  );
}

const decisionTone: Record<AbacDecision, Tone> = { ALLOW: "success", DENY: "danger", HITL_REQUIRED: "warning" };

export function DecisionBadge({ decision }: { decision: AbacDecision }) {
  const { t } = usePrefs();
  return <Badge tone={decisionTone[decision]}>{t.decision[decision]}</Badge>;
}

const hitlTone: Record<HitlDecision, Tone> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", TIMED_OUT: "neutral" };

export function HitlBadge({ decision }: { decision: HitlDecision }) {
  const { t } = usePrefs();
  return (
    <Badge tone={hitlTone[decision]} dot>
      {t.hitlDecision[decision]}
    </Badge>
  );
}

const opTone: Record<OperationType, Tone> = { READ: "info", WRITE: "primary", DELETE: "danger", EXEC: "warning" };

export function OpBadge({ op }: { op: OperationType }) {
  const { t } = usePrefs();
  return <Badge tone={opTone[op]}>{t.op[op]}</Badge>;
}

const tierTone: Record<TrustTier, Tone> = { HIGH: "success", MEDIUM: "info", LOW: "warning" };

export function TierBadge({ tier }: { tier: TrustTier }) {
  const { t } = usePrefs();
  return <Badge tone={tierTone[tier]}>{t.tier[tier]}</Badge>;
}

export function riskTone(score: number, threshold: number): Tone {
  if (score >= threshold) return "danger";
  if (score >= threshold * 0.6) return "warning";
  return "success";
}

export function RiskPill({ score, threshold }: { score: number; threshold: number }) {
  const tone = riskTone(score, threshold);
  const bar = { danger: "bg-danger", warning: "bg-warning", success: "bg-success" }[tone as "danger" | "warning" | "success"];
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs tabular-nums" dir="ltr">
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-2">
        <span className={cn("block h-full rounded-full", bar)} style={{ width: `${Math.round(score * 100)}%` }} />
      </span>
      {score.toFixed(2)}
    </span>
  );
}

const httpTone: Record<HttpStatus, Tone> = { 200: "success", 202: "warning", 400: "neutral", 401: "danger", 403: "danger", 408: "neutral", 503: "danger" };

export function HttpBadge({ code }: { code: HttpStatus }) {
  const { t } = usePrefs();
  return (
    <span title={t.http[code]}>
      <Badge tone={httpTone[code]} className="font-mono">
        {code}
      </Badge>
    </span>
  );
}

export const threatColor: Record<ThreatCategory, string> = {
  DIRECT_INJECTION: "var(--danger)",
  INDIRECT_INJECTION: "var(--warning)",
  DATA_EXFILTRATION: "var(--info)",
  EXCESSIVE_AGENCY: "var(--primary)",
};

export function ThreatBadge({ threat }: { threat: ThreatCategory }) {
  const { t } = usePrefs();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: threatColor[threat] }} />
      {t.threat[threat]}
    </span>
  );
}

export function FrameworkBadge({ framework }: { framework: AgentFramework }) {
  const { t } = usePrefs();
  return <Badge tone="info">{t.framework[framework]}</Badge>;
}

const sensTone: Record<Sensitivity, Tone> = { PUBLIC: "neutral", INTERNAL: "info", CONFIDENTIAL: "warning", RESTRICTED: "danger" };

export function SensitivityBadge({ level }: { level: Sensitivity }) {
  const { t } = usePrefs();
  return <Badge tone={sensTone[level]}>{t.sensitivity[level]}</Badge>;
}
