"use client";

import { Badge, DecisionBadge, HttpBadge, OpBadge, SensitivityBadge, StatusBadge, ThreatBadge, TierBadge } from "@/components/ui/badge";
import { DescList, JsonView, Mono, ScoreMeter } from "@/components/ui/data";
import { INJECTION_SIGNATURES } from "@/lib/engine/signatures";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway, useLookup } from "@/lib/store/gateway-store";
import type { ToolCallRequest } from "@/lib/types";
import { PipelineTrace, RiskBreakdownView } from "./request-insights";

export function RequestDetails({ r }: { r: ToolCallRequest }) {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  const { agentById, userById, policyById, resourceById } = useLookup();
  const agent = agentById(r.agent_id);
  const user = userById(r.user_id);
  const policy = policyById(r.triggered_policy_id);
  const resource = resourceById(r.resource_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <bdi className="font-mono text-base font-semibold">{r.tool_name}</bdi>
        <OpBadge op={r.operation_type} />
        <StatusBadge status={r.status} />
        <HttpBadge code={r.http_status} />
        {r.threat_category && <ThreatBadge threat={r.threat_category} />}
      </div>
      <p className="-mt-3 text-xs text-muted">{t.http[r.http_status]}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        <ScoreMeter label={t.approvals.riskScore} value={r.risk_score} threshold={state.settings.risk_threshold} />
        <ScoreMeter label={t.approvals.injectionScore} value={r.injection_score} threshold={state.settings.similarity_threshold} />
      </div>

      <section className="rounded-lg border border-border p-4">
        <h3 className="mb-3 text-xs font-medium text-muted">{t.approvals.pipeline}</h3>
        <PipelineTrace stages={r.pipeline} />
        <div className="mt-3 flex justify-between border-t border-border pt-2.5 text-xs">
          <span className="text-muted">{t.engines.total}</span>
          <span className="font-mono tabular-nums" dir="ltr">
            {r.latency_ms} ms
          </span>
        </div>
      </section>

      {r.pipeline.find((s) => s.id === "RISK")?.result !== "SKIP" && (
        <section className="rounded-lg border border-border p-4">
          <h3 className="mb-3 text-xs font-medium text-muted">{t.risk.breakdown}</h3>
          <RiskBreakdownView request={r} settings={state.settings} />
        </section>
      )}

      <DescList
        items={[
          { label: t.approvals.traceId, value: <Mono value={r.request_id} chars={12} /> },
          { label: t.approvals.receivedAt, value: fmt.dateTime(r.received_at) },
          { label: t.approvals.user, value: `${user?.full_name ?? "—"} (${user?.username ?? ""})` },
          { label: t.approvals.role, value: <bdi>{user?.role}</bdi> },
          { label: t.approvals.agent, value: <bdi>{agent?.agent_name}</bdi> },
          { label: t.approvals.platform, value: agent ? <bdi>{`${t.framework[agent.framework]} · ${agent.model}`}</bdi> : "—" },
          { label: t.approvals.trust, value: agent ? <TierBadge tier={agent.trust_tier} /> : "—" },
          { label: t.approvals.resource, value: resource ? <span className="inline-flex items-center gap-2"><bdi className="font-mono text-xs">{resource.resource_id}</bdi><SensitivityBadge level={resource.sensitivity} /></span> : "—" },
          { label: t.requests.decision, value: <DecisionBadge decision={r.abac_decision} /> },
          { label: t.approvals.policy, value: policy ? <bdi className="font-mono text-xs">{`${policy.policy_id} · ${policy.policy_name}`}</bdi> : t.common.none },
          { label: t.approvals.source, value: t.source[r.source] },
          {
            label: t.approvals.engines,
            value: r.triggered_engines.length ? (
              <span className="flex flex-wrap gap-1">
                {r.triggered_engines.map((e) => (
                  <Badge key={e}>{t.engine[e]}</Badge>
                ))}
              </span>
            ) : (
              t.common.none
            ),
          },
        ]}
      />

      {r.matched_signatures.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium text-muted">{t.approvals.signatures}</h3>
          <div className="flex flex-wrap gap-1.5">
            {r.matched_signatures.map((id) => (
              <span key={id} className="rounded-md border border-danger/30 bg-danger-soft px-2 py-0.5 font-mono text-[11px] text-danger" dir="ltr">
                {id} · {INJECTION_SIGNATURES.find((s) => s.id === id)?.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {r.pipeline.find((s) => s.id === "DLP")?.result !== "SKIP" && (
        <section>
          <h3 className="mb-2 text-xs font-medium text-muted">{t.approvals.args}</h3>
          <JsonView value={r.sanitized_arguments} />
          <p className="mt-1.5 text-[11px] text-muted">{t.approvals.argsNote}</p>
        </section>
      )}

      {r.dlp_redactions.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium text-muted">{t.approvals.redactions}</h3>
          <div className="flex flex-wrap gap-1.5">
            {r.dlp_redactions.map((d, i) => (
              <Badge key={`${d.field}-${i}`} tone="warning">
                <bdi className="font-mono">{d.field}</bdi>· {t.redaction[d.type]}
              </Badge>
            ))}
          </div>
        </section>
      )}
      {r.outbound_redactions > 0 && <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">{t.requests.outbound(r.outbound_redactions)}</p>}
    </div>
  );
}
