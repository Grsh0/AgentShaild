"use client";

import { Check, CircleSlash, Flag, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";
import { INJECTION_SIGNATURES } from "@/lib/engine/signatures";
import type { GatewaySettings, PipelineStage, RiskBreakdown, ToolCallRequest } from "@/lib/types";

const resultStyle = {
  PASS: { icon: Check, cls: "bg-success-soft text-success border-success/30" },
  FAIL: { icon: X, cls: "bg-danger-soft text-danger border-danger/40" },
  FLAG: { icon: Flag, cls: "bg-warning-soft text-warning border-warning/30" },
  SKIP: { icon: CircleSlash, cls: "bg-surface-2 text-muted/60 border-border" },
};

/** مسار القرار مرحلة بمرحلة كما في مخطط النشاط */
export function PipelineTrace({ stages, compact }: { stages: PipelineStage[]; compact?: boolean }) {
  const { t } = usePrefs();
  const noteText = (s: PipelineStage) => {
    if (!s.note) return null;
    if (t.stageNote[s.note]) return t.stageNote[s.note];
    if (s.id === "INJECTION") return s.note.split(",").map((id) => INJECTION_SIGNATURES.find((x) => x.id === id)?.label ?? id).join(" · ");
    if (s.id === "DLP" || s.id === "OUTBOUND_DLP") return `${s.note} × [REDACTED]`;
    return s.note;
  };
  return (
    <ol className="relative space-y-0">
      {stages.map((s, i) => {
        const st = resultStyle[s.result];
        const Icon = st.icon;
        const last = i === stages.length - 1;
        return (
          <li key={s.id} className={cn("relative flex gap-3", compact ? "pb-2" : "pb-3", last && "pb-0")}>
            {!last && <span className="absolute start-[11px] top-6 bottom-0 w-px bg-border" aria-hidden />}
            <span className={cn("relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border", st.cls)}>
              <Icon className="h-3 w-3" />
            </span>
            <div className={cn("min-w-0 flex-1", s.result === "SKIP" && "opacity-50")}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm">{t.stage[s.id]}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums" dir="ltr">
                  {s.result === "SKIP" ? "—" : `${s.duration_ms.toFixed(1)} ms`}
                </span>
              </div>
              {s.result !== "PASS" && s.result !== "SKIP" && (
                <div className={cn("text-[11px]", s.result === "FAIL" ? "text-danger" : "text-warning")}>
                  {t.stageResult[s.result]}
                  {noteText(s) && <span className="text-muted"> · <bdi>{noteText(s)}</bdi></span>}
                </div>
              )}
              {s.result === "PASS" && noteText(s) && !compact && (
                <div className="text-[11px] text-muted">
                  <bdi>{noteText(s)}</bdi>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const COMPONENTS: (keyof RiskBreakdown)[] = ["injection", "operation", "abac", "dlp", "trust"];

/** تفصيل درجة الخطورة إلى مكوناتها وأوزانها (FR-16) */
export function RiskBreakdownView({ request, settings }: { request: ToolCallRequest; settings: GatewaySettings }) {
  const { t } = usePrefs();
  const w = settings.risk_weights;
  const total = w.abac + w.injection + w.dlp + w.operation + w.trust || 1;
  const weighted = COMPONENTS.reduce((s, k) => s + (request.risk_breakdown[k] * w[k]) / total, 0);
  const floored = request.risk_score > weighted + 0.005;
  return (
    <div>
      <ul className="space-y-2.5">
        {COMPONENTS.map((k) => {
          const v = request.risk_breakdown[k];
          const contrib = (v * w[k]) / total;
          return (
            <li key={k}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span>{t.risk[k]}</span>
                <span className="font-mono text-muted tabular-nums" dir="ltr">
                  {v.toFixed(2)} × {(w[k] / total).toFixed(2)} = <span className="text-fg">{contrib.toFixed(3)}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2" dir="ltr">
                <div className={cn("h-full rounded-full", v >= 0.7 ? "bg-danger" : v >= 0.4 ? "bg-warning" : "bg-success")} style={{ width: `${v * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs">
        <span className="text-muted">{t.approvals.riskScore}</span>
        <span className="font-mono font-semibold tabular-nums" dir="ltr">
          {weighted.toFixed(2)}
          {floored && <> → {request.risk_score.toFixed(2)}</>}
        </span>
      </div>
      {floored && <p className="mt-1 text-[11px] text-warning">{t.risk.floor}</p>}
    </div>
  );
}
