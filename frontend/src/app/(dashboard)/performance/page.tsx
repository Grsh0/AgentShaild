"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BarList, StackedBars } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { mean, percentileOf } from "@/lib/analytics";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway } from "@/lib/store/gateway-store";
import { LAB_CASES, type LabModule } from "@/lib/test-cases";
import type { StageId } from "@/lib/types";

const STAGES: StageId[] = ["SCHEMA", "KILL_SWITCH", "AUTH", "TOOL", "ABAC", "INJECTION", "DLP", "RISK", "ROUTE", "OUTBOUND_DLP"];

// قيم مرجعية تقديرية لاختبار التحميل، تُستبدل بالقياس الفعلي في الفصل الخامس
const BENCHMARK = [
  { agents: 1, load: 8, p50: 21, p95: 43, p99: 62, thr: 8, err: 0 },
  { agents: 10, load: 42, p50: 32, p95: 71, p99: 91, thr: 41.7, err: 0 },
  { agents: 25, load: 86, p50: 48, p95: 103, p99: 127, thr: 84.9, err: 0.2 },
  { agents: 50, load: 124, p50: 64, p95: 136, p99: 168, thr: 120.8, err: 0.7 },
];

const ACCURACY: { module: LabModule; target: number }[] = [
  { module: "INJECTION", target: 0.9 },
  { module: "DLP", target: 0.95 },
  { module: "ABAC", target: 1 },
  { module: "HITL", target: 1 },
  { module: "AUTH", target: 1 },
];

export default function PerformancePage() {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  const slo = state.settings.latency_alert_ms;

  const data = useMemo(() => {
    const recent = state.requests.slice(0, 500).filter((r) => r.http_status !== 503 && r.http_status !== 400);
    const lat = recent.map((r) => r.latency_ms);
    const edges = [10, 20, 30, 40, 50, 60, 80, 100, 150, Infinity];
    const hist = edges.map((e, i) => ({ label: e === Infinity ? `${edges[i - 1]}+` : `<${e}`, n: lat.filter((v) => v < e && v >= (edges[i - 1] ?? 0)).length }));
    const stage = (id: StageId) => mean(recent.map((r) => r.pipeline.find((s) => s.id === id)).filter((s) => s && s.result !== "SKIP").map((s) => s!.duration_ms));
    return {
      p50: percentileOf(lat, 50),
      p95: percentileOf(lat, 95),
      p99: percentileOf(lat, 99),
      under: lat.length ? lat.filter((v) => v < slo).length / lat.length : 1,
      rate: state.requests.filter((r) => r.received_at >= state.now - 60_000).length,
      hist,
      stages: STAGES.map((id) => ({ label: t.stage[id], value: Math.round(stage(id) * 10) / 10, color: id === "INJECTION" || id === "DLP" ? "var(--primary)" : "var(--info)" })),
      dlp: stage("DLP"),
    };
  }, [state.requests, state.now, slo, t]);

  const accuracy = ACCURACY.map(({ module, target }) => {
    const cases = LAB_CASES.filter((c) => c.module === module);
    const runs = cases.map((c) => state.labRuns[c.id]).filter(Boolean);
    return { module, target, runs: runs.length, total: cases.length, rate: runs.length ? runs.filter((r) => r.passed).length / runs.length : null };
  });
  const anyRuns = accuracy.some((a) => a.rate !== null);

  return (
    <>
      <PageHeader title={t.performance.title} subtitle={t.performance.subtitle} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: t.performance.p50, value: `${fmt.num(data.p50)} ms` },
          { label: t.performance.p95, value: `${fmt.num(data.p95)} ms`, tone: data.p95 > slo ? "text-danger" : "text-success", foot: t.performance.target(slo) },
          { label: t.performance.p99, value: `${fmt.num(data.p99)} ms` },
          { label: t.performance.rate, value: `${data.rate}`, foot: t.topbar.perMinute },
          { label: t.performance.dlpSpeed, value: `${data.dlp.toFixed(1)} ms`, tone: data.dlp < 10 ? "text-success" : "text-danger", foot: t.performance.dlpSpeedSub },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-muted">{k.label}</div>
            <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", k.tone)} dir="ltr">
              {k.value}
            </div>
            {k.foot && <div className="mt-1 text-[11px] text-muted">{k.foot}</div>}
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title={t.performance.distribution} subtitle={t.performance.distributionSub} action={<Badge tone={data.under >= 0.95 ? "success" : "warning"}>{t.performance.underTarget(fmt.pct(data.under))}</Badge>} />
          <div className="px-5 pb-5">
            <StackedBars columns={data.hist.map((h) => ({ label: h.label, values: [h.n] }))} series={[{ label: "ms", color: "var(--primary)" }]} height={200} />
          </div>
        </Card>
        <Card>
          <CardHeader title={t.performance.stages} subtitle={t.performance.stagesSub} />
          <div className="px-5 pb-5">
            <BarList items={data.stages} format={(n) => `${n} ms`} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <CardHeader title={t.performance.benchmark} subtitle={t.performance.benchmarkSub} action={<Badge tone="warning">{t.common.simulated}</Badge>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-border bg-surface-2/50 text-[11px] text-muted">
                  {[t.performance.agents, t.performance.load, "p50", "p95", "p99", t.performance.throughput, t.performance.errors].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs tabular-nums">
                {BENCHMARK.map((b) => (
                  <tr key={b.agents}>
                    <td className="px-4 py-2.5">{b.agents}</td>
                    <td className="px-4 py-2.5" dir="ltr">{b.load} req/s</td>
                    <td className="px-4 py-2.5" dir="ltr">{b.p50} ms</td>
                    <td className={cn("px-4 py-2.5", b.p95 > slo && "text-danger")} dir="ltr">{b.p95} ms</td>
                    <td className={cn("px-4 py-2.5", b.p99 > slo && "text-danger")} dir="ltr">{b.p99} ms</td>
                    <td className="px-4 py-2.5" dir="ltr">{b.thr} req/s</td>
                    <td className="px-4 py-2.5">{b.err}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title={t.performance.accuracy} subtitle={t.performance.accuracySub} />
          <div className="px-5 pb-5">
            {!anyRuns ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <FlaskConical className="h-7 w-7 text-muted" />
                <p className="text-sm text-muted">{t.performance.noRuns}</p>
                <Link href="/lab?run=1" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg">
                  {t.performance.openLab}
                </Link>
              </div>
            ) : (
              <ul className="space-y-4">
                {accuracy.map((a) => (
                  <li key={a.module}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span>{t.lab.moduleLabel[a.module]}</span>
                      <span className="font-mono tabular-nums">
                        {a.rate === null ? "—" : fmt.pct(a.rate)} <span className="text-muted">/ ≥ {fmt.pct(a.target)}</span>
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-surface-2" dir="ltr">
                      <div className={cn("h-full rounded-full", a.rate === null ? "" : a.rate >= a.target ? "bg-success" : "bg-danger")} style={{ width: `${(a.rate ?? 0) * 100}%` }} />
                      <span className="absolute -top-1 h-4 w-0.5 rounded bg-fg/70" style={{ left: `${a.target * 100}%` }} />
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted">
                      {a.runs}/{a.total}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
