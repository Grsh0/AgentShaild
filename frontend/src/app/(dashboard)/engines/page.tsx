"use client";

import { ChevronLeft, Gauge, ScanSearch, ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { JsonView } from "@/components/ui/data";
import { Switch, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { isMasked, mean } from "@/lib/analytics";
import { scanDlp, scanInjection } from "@/lib/engine/inspect";
import { ATTACK_CORPUS, INJECTION_SIGNATURES } from "@/lib/engine/signatures";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway } from "@/lib/store/gateway-store";
import type { GatewaySettings, StageId } from "@/lib/types";

const STAGES: StageId[] = ["SCHEMA", "KILL_SWITCH", "AUTH", "TOOL", "ABAC", "INJECTION", "DLP", "RISK", "ROUTE", "OUTBOUND_DLP"];
type ModuleKey = keyof GatewaySettings["modules"];

function EngineCard({ title, desc, icon: Icon, on, children }: { title: string; desc: string; icon: React.ComponentType<{ className?: string }>; on: boolean; children: React.ReactNode }) {
  const { t } = usePrefs();
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", on ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted")}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{title}</h2>
            <Badge tone={on ? "success" : "neutral"} dot>
              {on ? t.engines.enforcing : t.engines.off}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{desc}</p>
        </div>
      </div>
      <div className="mt-4 flex-1 space-y-3">{children}</div>
    </Card>
  );
}

function Counters({ items }: { items: { label: string; value: string; tone?: string }[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg bg-surface-2/50 px-3 py-2">
          <dt className="text-[10px] text-muted">{it.label}</dt>
          <dd className={cn("font-mono text-lg font-semibold tabular-nums", it.tone)}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ModuleRow({ label, hint, k }: { label: string; hint?: string; k?: ModuleKey }) {
  const { state, updateSettings } = useGateway();
  const on = k ? state.settings.modules[k] : true;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs">{label}</div>
        {hint && <div className="text-[11px] text-muted">{hint}</div>}
      </div>
      <Switch checked={on} disabled={!k} label={label} onChange={(v) => k && updateSettings({ modules: { ...state.settings.modules, [k]: v } })} />
    </div>
  );
}

function Probe() {
  const { t } = usePrefs();
  const { state } = useGateway();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ inj: ReturnType<typeof scanInjection>; dlp: ReturnType<typeof scanDlp> } | null>(null);

  const run = () => setResult({ inj: scanInjection({ text }, state.settings), dlp: scanDlp({ text }, state.settings) });

  return (
    <Card>
      <CardHeader title={t.engines.probe} subtitle={t.engines.probeSub} action={<Badge>{t.common.simulated}</Badge>} />
      <div className="space-y-3 px-5 pb-5">
        <Textarea dir="auto" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.engines.probePlaceholder} className="font-mono text-xs" />
        <Button variant="primary" onClick={run} disabled={!text.trim()}>
          <ScanSearch className="h-4 w-4" />
          {t.engines.probeRun}
        </Button>
        {result && (
          <div className="animate-in space-y-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted">{t.engines.probeScore}</span>
              <span className={cn("font-mono text-2xl font-semibold tabular-nums", result.inj.flagged ? "text-danger" : "text-success")}>{result.inj.score.toFixed(2)}</span>
              {result.inj.flagged ? <Badge tone="danger">{t.engine.INJECTION}</Badge> : result.dlp.redactions.length === 0 && <Badge tone="success">{t.engines.probeClean}</Badge>}
              {result.inj.decoded && <Badge tone="warning">{t.threats.decoded}</Badge>}
            </div>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted">{t.engines.signatures}</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {result.inj.matched.length
                    ? result.inj.matched.map((id) => (
                        <span key={id} className="rounded bg-danger-soft px-1.5 py-0.5 font-mono text-[11px] text-danger" dir="ltr">
                          {id} · {INJECTION_SIGNATURES.find((s) => s.id === id)?.label}
                        </span>
                      ))
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t.engines.semantic}</dt>
                <dd className="mt-1 font-mono" dir="ltr">
                  {result.inj.semantic_score.toFixed(2)}
                  {result.inj.semantic_sample && <span className="block truncate text-[11px] text-muted">≈ {result.inj.semantic_sample}</span>}
                </dd>
              </div>
            </dl>
            {result.dlp.redactions.length > 0 && (
              <div>
                <div className="mb-1 text-xs text-muted">{t.engines.probeSanitized}</div>
                <JsonView value={result.dlp.sanitized.text} />
                <div className="mt-2 flex flex-wrap gap-1">
                  {result.dlp.redactions.map((r, i) => (
                    <Badge key={i} tone="warning">
                      {t.redaction[r.type]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function EnginesPage() {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  const m = state.settings.modules;

  const stats = useMemo(() => {
    const recent = state.requests.slice(0, 200);
    const avg = Object.fromEntries(
      STAGES.map((id) => [id, mean(recent.map((r) => r.pipeline.find((s) => s.id === id)).filter((s) => s && s.result !== "SKIP").map((s) => s!.duration_ms))]),
    ) as Record<StageId, number>;
    const since = new Date(state.now).setHours(0, 0, 0, 0);
    const today = state.requests.filter((r) => r.received_at >= since);
    const hits = new Map<string, number>();
    for (const r of state.requests) for (const id of r.matched_signatures) hits.set(id, (hits.get(id) ?? 0) + 1);
    return {
      avg,
      injection: today.filter((r) => r.triggered_engines.includes("INJECTION")).length,
      semantic: today.filter((r) => r.injection_score >= state.settings.similarity_threshold && !r.matched_signatures.length).length,
      masked: today.filter(isMasked).length,
      secrets: today.filter((r) => r.dlp_redactions.some((d) => d.type === "SECRET" || d.type === "HIGH_ENTROPY")).length,
      pii: today.filter((r) => r.dlp_redactions.some((d) => !["SECRET", "HIGH_ENTROPY"].includes(d.type))).length,
      denied: today.filter((r) => r.abac_decision === "DENY").length,
      escalated: today.filter((r) => r.abac_decision === "HITL_REQUIRED").length,
      riskEsc: today.filter((r) => r.triggered_engines.includes("RISK")).length,
      hits,
    };
  }, [state.requests, state.now, state.settings.similarity_threshold]);

  const total = STAGES.reduce((s, id) => s + stats.avg[id], 0);
  const w = state.settings.risk_weights;
  const wSum = w.abac + w.injection + w.dlp + w.operation + w.trust || 1;

  return (
    <>
      <PageHeader title={t.engines.title} subtitle={t.engines.subtitle} />

      <Card className="mb-4">
        <CardHeader title={t.engines.pipeline} subtitle={t.engines.pipelineSub} action={<span className="font-mono text-sm tabular-nums" dir="ltr">{t.engines.total}: {total.toFixed(1)} ms</span>} />
        <div className="overflow-x-auto px-5 pb-5">
          <ol className="flex min-w-[900px] items-stretch gap-1">
            {STAGES.map((id, i) => (
              <li key={id} className="flex flex-1 items-center gap-1">
                <div className={cn("flex-1 rounded-lg border p-2.5", id === "INJECTION" || id === "DLP" ? "border-primary/40 bg-primary-soft/50" : "border-border bg-surface-2/40")}>
                  <div className="text-[11px] leading-tight">{t.stage[id]}</div>
                  <div className="mt-1 font-mono text-xs text-muted tabular-nums" dir="ltr">
                    {stats.avg[id].toFixed(1)} ms
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-surface-2" dir="ltr">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (stats.avg[id] / total) * 100 : 0}%` }} />
                  </div>
                </div>
                {i < STAGES.length - 1 && <ChevronLeft className="h-4 w-4 shrink-0 text-muted ltr:rotate-180" />}
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <EngineCard title={t.engines.injection} desc={t.engines.injectionDesc} icon={ShieldAlert} on={m.injection_signatures || m.injection_semantic}>
          <Counters
            items={[
              { label: t.engines.detected, value: fmt.num(stats.injection), tone: stats.injection ? "text-danger" : "" },
              { label: t.engines.semantic, value: fmt.num(stats.semantic) },
              { label: t.settings.similarity, value: state.settings.similarity_threshold.toFixed(2) },
            ]}
          />
          <ModuleRow label={t.engines.signatures} hint={`${INJECTION_SIGNATURES.length} regex`} k="injection_signatures" />
          <ModuleRow label={t.engines.semantic} hint={`${ATTACK_CORPUS.length} · cosine`} k="injection_semantic" />
          <ModuleRow label={t.engines.decode} hint="Base64" />
        </EngineCard>

        <EngineCard title={t.engines.dlp} desc={t.engines.dlpDesc} icon={ShieldCheck} on={m.dlp_secrets || m.dlp_pii || m.dlp_entropy}>
          <Counters
            items={[
              { label: t.engines.masked, value: fmt.num(stats.masked) },
              { label: t.redaction.SECRET, value: fmt.num(stats.secrets), tone: stats.secrets ? "text-danger" : "" },
              { label: t.engines.pii, value: fmt.num(stats.pii) },
            ]}
          />
          <ModuleRow label={t.engines.secrets} hint="sk- · AKIA · ghp_ · xox · DSN" k="dlp_secrets" />
          <ModuleRow label={t.engines.entropy} hint={`H(S) ≥ ${state.settings.entropy_threshold}`} k="dlp_entropy" />
          <ModuleRow label={t.engines.pii} hint="Email · Phone · SSN · IBAN · Card" k="dlp_pii" />
          <ModuleRow label={t.engines.outbound} hint="FR-15" k="outbound_dlp" />
        </EngineCard>

        <EngineCard title={t.engines.abac} desc={t.engines.abacDesc} icon={ScrollText} on>
          <Counters
            items={[
              { label: t.engines.activePolicies, value: `${state.policies.filter((p) => p.is_active).length}/${state.policies.length}` },
              { label: t.engines.denied, value: fmt.num(stats.denied), tone: stats.denied ? "text-danger" : "" },
              { label: t.engines.escalated, value: fmt.num(stats.escalated), tone: stats.escalated ? "text-warning" : "" },
            ]}
          />
        </EngineCard>

        <EngineCard title={t.engines.riskEngine} desc={t.engines.riskDesc} icon={Gauge} on>
          <Counters
            items={[
              { label: t.engines.threshold, value: state.settings.risk_threshold.toFixed(2) },
              { label: t.engines.escalated, value: fmt.num(stats.riskEsc), tone: stats.riskEsc ? "text-warning" : "" },
              { label: t.engines.weights, value: "5" },
            ]}
          />
          <ul className="space-y-2">
            {(["injection", "operation", "abac", "dlp", "trust"] as const).map((k) => (
              <li key={k} className="flex items-center gap-3 text-xs">
                <span className="w-28 shrink-0">{t.risk[k]}</span>
                <div className="h-1.5 flex-1 rounded-full bg-surface-2" dir="ltr">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(w[k] / wSum) * 100}%` }} />
                </div>
                <span className="w-10 font-mono text-muted tabular-nums">{(w[k] / wSum).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </EngineCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title={t.engines.library} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-surface-2/50 text-[11px] text-muted">
                  <th className="px-4 py-2 text-start font-medium">ID</th>
                  <th className="px-4 py-2 text-start font-medium">{t.threats.matched}</th>
                  <th className="px-4 py-2 text-start font-medium">{t.engines.hits}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {INJECTION_SIGNATURES.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-mono text-xs text-muted">{s.id}</td>
                    <td className="px-4 py-2 text-xs">
                      <bdi>{s.label}</bdi>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs tabular-nums">{fmt.num(stats.hits.get(s.id) ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Probe />
      </div>
    </>
  );
}
