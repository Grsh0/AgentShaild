"use client";

import { CheckCircle2, Clock, Inbox, ShieldCheck, ShieldX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PipelineTrace, RiskBreakdownView } from "@/components/request-insights";
import { Badge, HitlBadge, OpBadge, RiskPill, SensitivityBadge, ThreatBadge, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { DescList, JsonView, Mono, ScoreMeter } from "@/components/ui/data";
import { Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { INJECTION_SIGNATURES } from "@/lib/engine/signatures";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway, useLookup } from "@/lib/store/gateway-store";
import type { HitlQueueItem } from "@/lib/types";

function formatLeft(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function Countdown({ item, large }: { item: HitlQueueItem; large?: boolean }) {
  const { state } = useGateway();
  const total = state.settings.hitl_timeout_seconds;
  const left = Math.max(0, Math.round((item.timeout_at - state.now) / 1000));
  const urgent = left < 60;
  return (
    <div className={cn("flex items-center gap-2", large && "flex-col items-stretch gap-1.5")}>
      <span className={cn("inline-flex items-center gap-1 font-mono tabular-nums", urgent ? "text-danger" : "text-warning", large ? "text-2xl font-semibold" : "text-xs")} dir="ltr">
        <Clock className={large ? "h-5 w-5" : "h-3 w-3"} />
        {formatLeft(left)}
      </span>
      <div className={cn("overflow-hidden rounded-full bg-surface-2", large ? "h-1.5 w-full" : "h-1 w-14")} dir="ltr">
        <div className={cn("h-full rounded-full transition-[width] duration-1000", urgent ? "bg-danger" : "bg-warning")} style={{ width: `${Math.min(1, left / total) * 100}%` }} />
      </div>
    </div>
  );
}

function QueueList({ items, selectedId, onSelect }: { items: HitlQueueItem[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  const { requestById, agentById } = useLookup();
  return (
    <ul className="divide-y divide-border">
      {items.map((h) => {
        const r = requestById(h.request_id);
        if (!r) return null;
        const selected = h.item_id === selectedId;
        return (
          <li key={h.item_id}>
            <button
              type="button"
              onClick={() => onSelect(h.item_id)}
              aria-current={selected}
              className={cn("animate-in flex w-full flex-col gap-2 border-s-2 px-4 py-3 text-start transition", selected ? "border-primary bg-primary-soft/60" : "border-transparent hover:bg-surface-2/60")}
            >
              <div className="flex items-center justify-between gap-2">
                <bdi className="truncate font-mono text-sm">{r.tool_name}</bdi>
                <RiskPill score={r.risk_score} threshold={state.settings.risk_threshold} />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="truncate">
                  <bdi>{agentById(r.agent_id)?.agent_name}</bdi> · {t.engine[h.escalation_reason]}
                </span>
                {h.decision === "PENDING" ? <Countdown item={h} /> : <HitlBadge decision={h.decision} />}
              </div>
              {h.decision !== "PENDING" && h.resolved_at && <span className="text-[11px] text-muted">{fmt.relative(h.resolved_at, state.now)}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Detail({ item }: { item: HitlQueueItem }) {
  const { t, fmt } = usePrefs();
  const { state, decide } = useGateway();
  const { requestById, agentById, userById, policyById, resourceById } = useLookup();
  const [notes, setNotes] = useState("");
  const r = requestById(item.request_id);
  if (!r) return null;
  const agent = agentById(r.agent_id);
  const user = userById(r.user_id);
  const policy = policyById(r.triggered_policy_id);
  const resource = resourceById(r.resource_id);
  const pending = item.decision === "PENDING";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <bdi className="font-mono text-lg font-semibold">{r.tool_name}</bdi>
            <OpBadge op={r.operation_type} />
            <HitlBadge decision={item.decision} />
            {r.threat_category && <ThreatBadge threat={r.threat_category} />}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>{t.approvals.traceId}:</span>
            <Mono value={r.request_id} />
            <span>
              {t.approvals.receivedAt}: {fmt.time(r.received_at)}
            </span>
          </div>
        </div>
        {pending && (
          <div className="w-40 text-end">
            <div className="mb-1 text-[11px] text-muted">{t.approvals.timeLeft}</div>
            <Countdown item={item} large />
            <div className="mt-1 text-[10px] text-muted">{t.approvals.autoReject}</div>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <ScoreMeter label={t.approvals.riskScore} value={r.risk_score} threshold={state.settings.risk_threshold} hint={t.approvals.threshold(state.settings.risk_threshold.toFixed(2))} />
          <ScoreMeter label={t.approvals.injectionScore} value={r.injection_score} threshold={state.settings.similarity_threshold} hint={t.approvals.threshold(state.settings.similarity_threshold.toFixed(2))} />
        </div>

        <section>
          <h3 className="mb-2 text-xs font-medium text-muted">{t.approvals.escalation}</h3>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="warning">{t.engine[item.escalation_reason]}</Badge>
            {r.triggered_engines
              .filter((e) => e !== item.escalation_reason)
              .map((e) => (
                <Badge key={e}>{t.engine[e]}</Badge>
              ))}
          </div>
          {r.matched_signatures.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] text-muted">{t.approvals.signatures}</div>
              <div className="flex flex-wrap gap-1.5">
                {r.matched_signatures.map((id) => (
                  <span key={id} className="rounded-md border border-danger/30 bg-danger-soft px-2 py-0.5 font-mono text-[11px] text-danger" dir="ltr">
                    {id} · {INJECTION_SIGNATURES.find((s) => s.id === id)?.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border p-4">
          <h3 className="mb-3 text-xs font-medium text-muted">{t.approvals.requestInfo}</h3>
          <DescList
            items={[
              { label: t.approvals.user, value: `${user?.full_name ?? "—"} (${user?.username ?? ""})` },
              { label: t.approvals.role, value: <bdi>{user?.role}</bdi> },
              { label: t.approvals.agent, value: <bdi>{agent?.agent_name}</bdi> },
              { label: t.approvals.platform, value: agent ? <bdi>{`${t.framework[agent.framework]} · ${agent.model}`}</bdi> : "—" },
              { label: t.approvals.trust, value: agent ? <TierBadge tier={agent.trust_tier} /> : "—" },
              { label: t.approvals.resource, value: resource ? <span className="inline-flex items-center gap-2"><bdi className="font-mono text-xs">{resource.resource_id}</bdi><SensitivityBadge level={resource.sensitivity} /></span> : "—" },
              { label: t.approvals.source, value: t.source[r.source] },
              { label: t.approvals.policy, value: policy ? <bdi className="font-mono text-xs">{`${policy.policy_id} · ${policy.policy_name}`}</bdi> : t.common.none },
            ]}
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-xs font-medium text-muted">{t.risk.breakdown}</h3>
            <RiskBreakdownView request={r} settings={state.settings} />
          </section>
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-xs font-medium text-muted">{t.approvals.pipeline}</h3>
            <PipelineTrace stages={r.pipeline} compact />
          </section>
        </div>

        <section>
          <h3 className="mb-2 text-xs font-medium text-muted">{t.approvals.args}</h3>
          <JsonView value={r.sanitized_arguments} />
          <p className="mt-1.5 text-[11px] text-muted">{t.approvals.argsNote}</p>
        </section>

        {r.dlp_redactions.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-medium text-muted">{t.approvals.redactions}</h3>
            <ul className="space-y-1.5">
              {r.dlp_redactions.map((d, i) => (
                <li key={`${d.field}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-surface-2/60 px-3 py-2 text-xs">
                  <bdi className="font-mono">{d.field}</bdi>
                  <Badge tone="warning">{t.redaction[d.type]}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!pending && (
          <section className="rounded-lg border border-border p-4">
            <DescList
              items={[
                { label: t.approvals.resolvedBy, value: item.reviewer_user_id ? userById(item.reviewer_user_id)?.full_name : t.approvals.system },
                { label: t.approvals.resolvedAt, value: item.resolved_at ? fmt.dateTime(item.resolved_at) : "—" },
              ]}
            />
            {item.admin_notes && <p className="mt-3 rounded-md bg-surface-2/60 p-3 text-sm">{item.admin_notes}</p>}
          </section>
        )}
      </div>

      {pending && (
        <div className="space-y-3 border-t border-border bg-surface-2/30 p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">{t.approvals.notes}</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.approvals.notesPlaceholder} rows={2} />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="danger" onClick={() => decide(item.item_id, "REJECTED", notes)}>
              <ShieldX className="h-4 w-4" />
              {t.approvals.reject}
            </Button>
            <Button variant="success" onClick={() => decide(item.item_id, "APPROVED", notes)}>
              <ShieldCheck className="h-4 w-4" />
              {t.approvals.approve}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalsView() {
  const { t } = usePrefs();
  const { state } = useGateway();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const pending = state.hitl.filter((h) => h.decision === "PENDING").sort((a, b) => a.timeout_at - b.timeout_at);
  const history = state.hitl.filter((h) => h.decision !== "PENDING").sort((a, b) => (b.resolved_at ?? 0) - (a.resolved_at ?? 0));
  const list = tab === "pending" ? pending : history;

  const paramId = params.get("item");
  const selected = state.hitl.find((h) => h.item_id === paramId) ?? list[0] ?? null;
  const select = (id: string) => router.replace(`/approvals?item=${id}`, { scroll: false });

  return (
    <>
      <PageHeader title={t.approvals.title} subtitle={t.approvals.subtitle} />
      <Card className="grid overflow-hidden lg:h-[calc(100vh-13rem)] lg:min-h-[600px] lg:grid-cols-[340px_1fr]">
        <div className="flex min-h-0 flex-col border-b border-border lg:border-e lg:border-b-0">
          <div role="tablist" className="flex gap-1 border-b border-border p-2">
            {(["pending", "history"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn("flex-1 rounded-md px-3 py-1.5 text-sm transition", tab === k ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}
              >
                {k === "pending" ? t.approvals.pendingTab : t.approvals.historyTab}
                <span className="ms-1.5 font-mono text-xs text-muted">{k === "pending" ? pending.length : history.length}</span>
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto lg:max-h-none lg:flex-1">
            {list.length === 0 ? (
              <EmptyState icon={<Inbox className="h-7 w-7" />} title={t.approvals.emptyTitle} body={t.approvals.emptyBody} />
            ) : (
              <QueueList items={list} selectedId={selected?.item_id ?? null} onSelect={select} />
            )}
          </div>
        </div>
        <div className="min-h-0">
          {selected ? <Detail key={selected.item_id} item={selected} /> : <EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title={t.approvals.selectHint} />}
        </div>
      </Card>
    </>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense>
      <ApprovalsView />
    </Suspense>
  );
}
