"use client";

import { Printer, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { threatColor } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { THREATS, inWindow, isMasked, isStopped, mean } from "@/lib/analytics";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway } from "@/lib/store/gateway-store";
import type { ThreatCategory } from "@/lib/types";

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold">
        <span className="me-2 font-mono text-primary">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function ReportsPage() {
  const { t, fmt, locale } = usePrefs();
  const { state } = useGateway();
  const { userById, agentById } = { userById: (id: string) => state.users.find((u) => u.user_id === id), agentById: (id: string) => state.agents.find((a) => a.agent_id === id) };
  const [period, setPeriod] = useState<"last7" | "prev7">("last7");

  const r = useMemo(() => {
    const startToday = new Date(state.now).setHours(0, 0, 0, 0);
    const days = state.dailyThreats;
    const live24 = inWindow(state.requests, state.now, 86_400_000);
    const todayLive = state.requests.filter((x) => x.received_at >= startToday);
    const rows = period === "last7" ? days.slice(-6) : days.slice(-13, -6);
    const counts = Object.fromEntries(THREATS.map((c) => [c, rows.reduce((s, d) => s + d.counts[c], 0) + (period === "last7" ? todayLive.filter((x) => x.threat_category === c).length : 0)])) as Record<ThreatCategory, number>;
    const intercepted = rows.reduce((s, d) => s + d.intercepted, 0) + (period === "last7" ? todayLive.length : 0);
    const threats = THREATS.reduce((s, c) => s + counts[c], 0);
    const from = period === "last7" ? startToday - 6 * 86_400_000 : startToday - 13 * 86_400_000;
    const to = period === "last7" ? state.now : startToday - 6 * 86_400_000 - 1;
    const top = [...THREATS].sort((a, b) => counts[b] - counts[a])[0];
    const detailed = period === "last7";
    return {
      from,
      to,
      intercepted,
      threats,
      counts,
      top,
      masked: detailed ? live24.filter(isMasked).length : null,
      hitl: detailed ? state.hitl.filter((h) => h.decision !== "PENDING" && (h.resolved_at ?? 0) >= state.now - 86_400_000).length : null,
      latency: detailed ? mean(live24.filter((x) => x.http_status !== 503).map((x) => x.latency_ms)) : null,
      blocked: detailed ? live24.filter((x) => isStopped(x) && x.http_status !== 400).sort((a, b) => b.risk_score - a.risk_score).slice(0, 6) : [],
    };
  }, [state, period]);

  const reportId = `WSR-${new Date(r.to).getFullYear()}-${String(isoWeek(new Date(r.to))).padStart(2, "0")}`;
  const lowTrust = state.agents.filter((a) => a.is_active && a.trust_tier === "LOW").map((a) => a.agent_name);
  const toolsOff = state.tools.filter((x) => !x.enabled).length;
  const pending = state.hitl.filter((h) => h.decision === "PENDING").length;
  const v = state.verification;
  const admin = userById("u-admin");

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={t.reports.title}
          subtitle={t.reports.subtitle}
          actions={
            <>
              <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="radiogroup" aria-label={t.reports.period}>
                {(["last7", "prev7"] as const).map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className={cn("rounded-md px-3 py-1.5 text-xs transition", period === p ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}>
                    {t.reports[p]}
                  </button>
                ))}
              </div>
              <Button variant="primary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                {t.common.print}
              </Button>
            </>
          }
        />
      </div>

      <Card className="mx-auto max-w-4xl p-6 sm:p-10 print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-primary pb-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">
                {t.app.name} · {t.reports.reportTitle}
              </h1>
              <p className="text-xs text-muted">{t.app.tagline}</p>
            </div>
          </div>
          <dl className="space-y-0.5 text-xs">
            <div className="flex gap-2">
              <dt className="text-muted">{t.reports.reportId}:</dt>
              <dd className="font-mono">{reportId}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">{t.reports.period}:</dt>
              <dd>
                {fmt.date(r.from)} – {fmt.date(r.to)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">{t.reports.generated}:</dt>
              <dd>{fmt.dateTime(state.now)}</dd>
            </div>
          </dl>
        </header>

        <div className="mt-6 space-y-8">
          <Section n={1} title={t.reports.summary}>
            <p className="text-sm leading-loose">{t.reports.summaryText(fmt.num(r.intercepted), state.agents.filter((a) => a.is_active).length, fmt.num(r.threats), r.masked === null ? "—" : fmt.num(r.masked))}</p>
          </Section>

          <Section n={2} title={t.reports.metrics}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted">
                  <th className="py-1.5 text-start font-medium">{t.reports.metric}</th>
                  <th className="py-1.5 text-start font-medium">{t.reports.value}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  [t.reports.rows.intercepted, fmt.num(r.intercepted)],
                  [t.reports.rows.threats, fmt.num(r.threats)],
                  [t.reports.rows.masked, r.masked === null ? t.reports.na : fmt.num(r.masked)],
                  [t.reports.rows.hitl, r.hitl === null ? t.reports.na : fmt.num(r.hitl)],
                  [t.reports.rows.latency, r.latency === null ? t.reports.na : `${fmt.num(r.latency)} ms · ${t.overview.slo(state.settings.latency_alert_ms)}`],
                  [t.reports.rows.chain, v ? (v.status === "INTACT" ? `${t.audit.intactTitle} (${fmt.num(v.checked)})` : `${t.audit.compromisedTitle} #${v.index}`) : t.reports.notVerified],
                ].map(([k, val]) => (
                  <tr key={k}>
                    <td className="py-2 text-muted">{k}</td>
                    <td className="py-2 font-medium">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted">{t.reports.detailNote}</p>
          </Section>

          <Section n={3} title={t.reports.distribution}>
            <div className="flex h-3 overflow-hidden rounded-full" dir="ltr">
              {THREATS.map((c) => (
                <div key={c} style={{ width: `${r.threats ? (r.counts[c] / r.threats) * 100 : 25}%`, background: threatColor[c] }} />
              ))}
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {THREATS.map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: threatColor[c] }} />
                  <span className="flex-1">{t.threat[c]}</span>
                  <span className="font-mono text-xs tabular-nums">{fmt.num(r.counts[c])}</span>
                  <span className="w-12 text-end font-mono text-xs text-muted tabular-nums">{fmt.pct(r.threats ? r.counts[c] / r.threats : 0)}</span>
                </li>
              ))}
            </ul>
          </Section>

          {r.blocked.length > 0 && (
            <Section n={4} title={t.reports.topBlocked}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-muted">
                    {[t.requests.time, t.requests.agent, t.requests.tool, t.requests.threat, t.requests.http, t.requests.risk].map((h) => (
                      <th key={h} className="py-1.5 text-start font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {r.blocked.map((x) => (
                    <tr key={x.request_id}>
                      <td className="py-2 text-xs text-muted">{fmt.dateTime(x.received_at)}</td>
                      <td className="py-2 text-xs">
                        <bdi>{agentById(x.agent_id)?.agent_name}</bdi>
                      </td>
                      <td className="py-2 font-mono text-xs">
                        <bdi>{x.tool_name}</bdi>
                      </td>
                      <td className="py-2 text-xs">{x.threat_category ? t.threat[x.threat_category] : "—"}</td>
                      <td className="py-2 font-mono text-xs">{x.http_status}</td>
                      <td className="py-2 font-mono text-xs">{x.risk_score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          <Section n={r.blocked.length ? 5 : 4} title={t.reports.posture}>
            <ul className="list-disc space-y-2 ps-5 text-sm leading-relaxed">
              <li>{t.reports.recs.policies(state.policies.filter((p) => p.is_active).length, state.policies.length)}</li>
              <li>{t.reports.recs.queue(pending)}</li>
              <li>{t.reports.recs.top(t.threat[r.top], fmt.pct(r.threats ? r.counts[r.top] / r.threats : 0))}</li>
              {lowTrust.length > 0 && <li>{t.reports.recs.lowTrust(lowTrust.join(locale === "ar" ? "، " : ", "))}</li>}
              {toolsOff > 0 && <li>{t.reports.recs.toolsOff(toolsOff)}</li>}
            </ul>
          </Section>

          <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5 text-xs text-muted">
            <div>
              <div>{t.reports.preparedBy}</div>
              <div className="mt-1 text-sm text-fg">{admin?.full_name}</div>
              <bdi className="font-mono">{admin?.email}</bdi>
            </div>
            <div className="text-end">
              <bdi className="font-mono">AgentShield v0.1.0 · {reportId}</bdi>
              <div>GDPR Art. 25 · Privacy by design</div>
            </div>
          </footer>
        </div>
      </Card>
    </>
  );
}
