"use client";

import { Crosshair, Fingerprint, Radar, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { BarList, Legend, StackedBars } from "@/components/charts/charts";
import { RequestDetails } from "@/components/request-details";
import { HttpBadge, threatColor } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { Drawer } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { THREATS, countBy, isThreat, percentileOf } from "@/lib/analytics";
import { ATTACK_CORPUS, INJECTION_SIGNATURES } from "@/lib/engine/signatures";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway, useLookup } from "@/lib/store/gateway-store";
import type { ThreatCategory, ToolCallRequest } from "@/lib/types";

function Stat({ label, value, foot, icon: Icon, tone }: { label: string; value: React.ReactNode; foot: React.ReactNode; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className={cn("grid h-7 w-7 place-items-center rounded-md", tone)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{foot}</div>
    </Card>
  );
}

export default function ThreatsPage() {
  const { t, fmt, locale } = usePrefs();
  const { state } = useGateway();
  const { agentById, resourceById } = useLookup();
  const [openId, setOpenId] = useState<string | null>(null);

  const { requests, dailyThreats } = state;

  const data = useMemo(() => {
    const startToday = new Date().setHours(0, 0, 0, 0);
    const today = requests.filter((r) => r.received_at >= startToday && isThreat(r));
    const todayCounts = countBy(today, (r) => r.threat_category);
    const days = dailyThreats;
    const thisWeek = [...days.slice(-6).map((d) => d.counts), Object.fromEntries(THREATS.map((c) => [c, todayCounts.get(c) ?? 0])) as Record<ThreatCategory, number>];
    const prevWeek = days.slice(-13, -6).map((d) => d.counts);
    const sum = (rows: Record<ThreatCategory, number>[]) => rows.reduce((s, r) => s + THREATS.reduce((a, c) => a + r[c], 0), 0);
    const byCat = THREATS.map((c) => ({ c, n: thisWeek.reduce((s, r) => s + r[c], 0) }));
    const total = sum(thisWeek);
    const top = [...byCat].sort((a, b) => b.n - a.n)[0];
    const dayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-GB", { weekday: "short" });
    const columns = [...days.slice(-6).map((d) => d.day), startToday].map((day, i) => ({
      label: i === 6 ? t.common.today : dayFmt.format(day),
      values: THREATS.map((c) => thisWeek[i][c]),
    }));
    const targets = [...countBy(today, (r) => r.resource_id)].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const injectionTimes = requests.slice(0, 300).map((r) => r.pipeline.find((s) => s.id === "INJECTION")).filter((s) => s && s.result !== "SKIP").map((s) => s!.duration_ms);

    // مكتبة الحمولات: تجميع حسب الأداة والتوقيع الأول
    const groups = new Map<string, { sample: ToolCallRequest; count: number }>();
    for (const r of requests) {
      if (!r.threat_category || r.threat_category === "EXCESSIVE_AGENCY") continue;
      const key = `${r.tool_name}|${r.matched_signatures[0] ?? r.dlp_redactions[0]?.type ?? r.threat_category}`;
      const g = groups.get(key);
      if (g) g.count++;
      else groups.set(key, { sample: r, count: 1 });
    }
    return {
      total,
      prevTotal: sum(prevWeek),
      top,
      columns,
      byCat,
      targets,
      median: percentileOf(injectionTimes, 50),
      library: [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 6),
      feed: requests.filter(isThreat).slice(0, 10),
    };
  }, [requests, dailyThreats, t, locale]);

  const change = data.prevTotal ? (data.total - data.prevTotal) / data.prevTotal : 0;
  const open = openId ? state.requests.find((r) => r.request_id === openId) : null;

  return (
    <>
      <PageHeader title={t.threats.title} subtitle={t.threats.subtitle} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label={t.threats.week}
          value={<span className="font-mono tabular-nums">{fmt.num(data.total)}</span>}
          foot={<span className={change > 0 ? "text-danger" : "text-success"}>{`${change > 0 ? "+" : ""}${fmt.pct(change)} ${t.threats.vsLastWeek}`}</span>}
          icon={Radar}
          tone="bg-danger-soft text-danger"
        />
        <Stat label={t.threats.topVector} value={<span className="text-lg">{t.threat[data.top.c]}</span>} foot={t.threats.ofAll(fmt.pct(data.total ? data.top.n / data.total : 0))} icon={Crosshair} tone="bg-warning-soft text-warning" />
        <Stat label={t.threats.detection} value={<span className="font-mono tabular-nums" dir="ltr">{data.median.toFixed(1)} ms</span>} foot={t.threats.detectionSub} icon={Timer} tone="bg-info-soft text-info" />
        <Stat label={t.threats.signatures} value={<span className="font-mono tabular-nums">{INJECTION_SIGNATURES.length}</span>} foot={t.threats.signaturesSub(ATTACK_CORPUS.length)} icon={Fingerprint} tone="bg-primary-soft text-primary" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t.threats.timeline} subtitle={t.threats.timelineSub} action={<Legend items={THREATS.map((c) => ({ color: threatColor[c], label: t.threat[c] }))} />} />
          <div className="px-5 pb-5">
            <StackedBars columns={data.columns} series={THREATS.map((c) => ({ label: c, color: threatColor[c] }))} height={220} />
          </div>
        </Card>
        <Card>
          <CardHeader title={t.overview.categories} subtitle={t.overview.categoriesSub} />
          <ul className="space-y-4 px-5 pb-5">
            {data.byCat.map(({ c, n }) => (
              <li key={c}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: threatColor[c] }} />
                    {t.threat[c]}
                  </span>
                  <span className="font-mono text-xs tabular-nums">{fmt.pct(data.total ? n / data.total : 0)}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{t.threatDesc[c]}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t.threats.library} subtitle={t.threats.librarySub} />
          {data.library.length === 0 ? (
            <EmptyState title={t.threats.emptyLibrary} />
          ) : (
            <div className="grid gap-3 px-5 pb-5 md:grid-cols-2">
              {data.library.map(({ sample: r, count }) => (
                <button key={r.request_id} type="button" onClick={() => setOpenId(r.request_id)} className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2/30 p-3 text-start transition hover:border-primary/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: threatColor[r.threat_category!] }} />
                      {t.threat[r.threat_category!]}
                    </span>
                    <HttpBadge code={r.http_status} />
                  </div>
                  <pre dir="ltr" className="line-clamp-3 rounded-md bg-bg/60 p-2 text-start font-mono text-[11px] whitespace-pre-wrap break-all text-fg/85">
                    {JSON.stringify(r.sanitized_arguments)}
                  </pre>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <dt className="text-muted">{t.threats.matched}</dt>
                    <dd className="truncate font-mono" dir="ltr">
                      {r.matched_signatures.length ? INJECTION_SIGNATURES.find((s) => s.id === r.matched_signatures[0])?.label : r.dlp_redactions.map((d) => d.token).join(" ") || "—"}
                    </dd>
                    <dt className="text-muted">{t.approvals.source}</dt>
                    <dd className="truncate">{t.source[r.source]}</dd>
                    <dt className="text-muted">{t.approvals.agent}</dt>
                    <dd className="truncate">
                      <bdi>{agentById(r.agent_id)?.agent_name}</bdi>
                    </dd>
                  </dl>
                  <span className="text-[11px] text-muted">× {fmt.num(count)}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title={t.threats.targets} subtitle={t.threats.targetsSub} />
            <div className="px-5 pb-5">
              {data.targets.length === 0 ? (
                <p className="text-xs text-muted">{t.overview.noThreats}</p>
              ) : (
                <BarList items={data.targets.map(([id, n]) => ({ label: resourceById(id)?.name ?? String(id), value: n, color: "var(--danger)" }))} format={(n) => fmt.num(n)} />
              )}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title={t.threats.feed} action={<span className="live-dot h-2 w-2 rounded-full bg-danger text-danger" />} />
            <ul className="divide-y divide-border">
              {data.feed.map((r) => (
                <li key={r.request_id}>
                  <button type="button" onClick={() => setOpenId(r.request_id)} className="animate-in flex w-full items-center gap-3 px-5 py-2.5 text-start hover:bg-surface-2/50">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: threatColor[r.threat_category!] }} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <bdi className="block truncate font-mono text-xs">{r.tool_name}</bdi>
                      <span className="text-[11px] text-muted">
                        {t.threat[r.threat_category!]} · {fmt.relative(r.received_at, state.now)}
                      </span>
                    </span>
                    <HttpBadge code={r.http_status} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={t.requests.drawerTitle}>
        {open && <RequestDetails r={open} />}
      </Drawer>
    </>
  );
}
