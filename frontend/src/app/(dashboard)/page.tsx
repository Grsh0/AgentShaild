"use client";

import { ArrowUpLeft, Bot, CheckCircle2, Clock, Database, EyeOff, FileText, Globe, Hourglass, Mail, Radar, ShieldCheck, ShieldOff, Terminal, Timer, Workflow } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BarList, Legend, LineChart } from "@/components/charts/charts";
import { Badge, HttpBadge, RiskPill, threatColor } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { WINDOW_MS, THREATS, buckets, inWindow, isMasked, isStopped, isThreat, mean, percentileOf, type WindowKey } from "@/lib/analytics";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway, useLookup } from "@/lib/store/gateway-store";
import type { ResourceKind } from "@/lib/types";

const KIND_ICON: Record<ResourceKind, React.ComponentType<{ className?: string }>> = { DATABASE: Database, FILES: FileText, EMAIL: Mail, HTTP: Globe, SHELL: Terminal };

function Kpi({ label, value, unit, icon: Icon, tone = "neutral", foot }: { label: string; value: string; unit?: string; icon: React.ComponentType<{ className?: string }>; tone?: "neutral" | "success" | "danger" | "warning" | "primary" | "info"; foot?: React.ReactNode }) {
  const toneCls = { neutral: "bg-surface-2 text-muted", success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger", warning: "bg-warning-soft text-warning", primary: "bg-primary-soft text-primary", info: "bg-info-soft text-info" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <span className={cn("grid h-7 w-7 place-items-center rounded-md", toneCls)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tabular-nums" dir="ltr">
          {value}
        </span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      {foot && <div className="mt-1 text-[11px]">{foot}</div>}
    </Card>
  );
}

function EnforcementPath() {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  const isolated = state.settings.kill_switch_active;
  const agents = [...state.agents].filter((a) => a.is_active).sort((a, b) => (b.last_seen_at ?? 0) - (a.last_seen_at ?? 0)).slice(0, 4);
  const recent = state.requests.slice(0, 1)[0];
  const resources = state.resources.slice(0, 5);
  const evaluated = state.requests.filter((r) => r.received_at >= state.now - 60_000).length;
  return (
    <div className="grid items-center gap-4 px-5 pb-5 md:grid-cols-[1fr_auto_1fr]">
      <ul className="space-y-2">
        <li className="text-[11px] text-muted">{t.overview.agents}</li>
        {agents.map((a) => {
          const live = a.last_seen_at !== null && state.now - a.last_seen_at < 8_000;
          return (
            <li key={a.agent_id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2/40 px-3 py-2">
              <Bot className={cn("h-4 w-4 shrink-0", live ? "text-primary" : "text-muted")} />
              <div className="min-w-0 flex-1 leading-tight">
                <bdi className="block truncate font-mono text-xs">{a.agent_name}</bdi>
                <span className="text-[10px] text-muted">
                  {t.framework[a.framework]} · {t.tier[a.trust_tier]}
                </span>
              </div>
              <span className={cn("h-2 w-2 rounded-full", live ? "live-dot bg-primary text-primary" : "bg-border")} />
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col items-center gap-2 py-2">
        <div className="hidden h-px w-16 border-t border-dashed border-primary/50 md:block" />
        <div className={cn("relative grid w-44 place-items-center rounded-2xl border-2 p-4 text-center", isolated ? "border-danger/60 bg-danger-soft" : "border-primary/50 bg-primary-soft")}>
          {isolated ? <ShieldOff className="h-8 w-8 text-danger" /> : <ShieldCheck className="h-8 w-8 text-primary" />}
          <div className="mt-1 text-sm font-semibold">{t.app.name}</div>
          <div className="mt-0.5 font-mono text-[10px] text-muted" dir="ltr">
            ABAC · INJECTION · DLP
          </div>
          <div className={cn("mt-2 rounded-full px-2 py-0.5 text-[10px] font-medium", isolated ? "bg-danger text-white" : "bg-primary text-primary-fg")}>
            {isolated ? t.gateway.isolated : `${evaluated} / ${t.topbar.perMinute}`}
          </div>
          {recent && !isolated && (
            <div className="mt-2 max-w-full truncate font-mono text-[10px] text-muted" dir="ltr">
              {recent.tool_name} → {recent.http_status}
            </div>
          )}
        </div>
        <div className="hidden h-px w-16 border-t border-dashed border-primary/50 md:block" />
      </div>

      <ul className="space-y-2">
        <li className="text-[11px] text-muted">{t.overview.resources}</li>
        {resources.map((r) => {
          const Icon = KIND_ICON[r.kind];
          return (
            <li key={r.resource_id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2/40 px-3 py-2">
              <Icon className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1 leading-tight">
                <bdi className="block truncate font-mono text-xs">{r.resource_id}</bdi>
                <span className="text-[10px] text-muted">
                  {t.resourceKind[r.kind]} · {t.sensitivity[r.sensitivity]}
                </span>
              </div>
            </li>
          );
        })}
        {state.resources.length > resources.length && <li className="text-[11px] text-muted">+{fmt.num(state.resources.length - resources.length)}</li>}
      </ul>
    </div>
  );
}

export default function OverviewPage() {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  const { agentById } = useLookup();
  const [win, setWin] = useState<WindowKey>("1h");
  const { requests, hitl, settings, health, now } = state;
  const isolated = settings.kill_switch_active;
  const slo = settings.latency_alert_ms;

  const data = useMemo(() => {
    const ms = WINDOW_MS[win];
    const list = inWindow(requests, now, ms);
    const lat = list.filter((r) => r.http_status !== 503 && r.http_status !== 400).map((r) => r.latency_ms);
    const series = buckets(requests, now, ms, win === "24h" ? 24 : win === "1h" ? 30 : 15);
    const threats = list.filter(isThreat);
    const recent = requests.slice(0, 12);
    const agentsRank = state.agents
      .map((a) => {
        const mine = list.filter((r) => r.agent_id === a.agent_id);
        return { agent: a, calls: mine.length, risk: mean(mine.map((r) => r.risk_score)), stopped: mine.filter(isStopped).length };
      })
      .filter((x) => x.calls > 0)
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 5);
    return {
      total: list.length,
      threats: threats.length,
      masked: list.filter(isMasked).length,
      avg: mean(lat),
      p95: percentileOf(lat, 95),
      series,
      categories: THREATS.map((c) => ({ label: t.threat[c], value: threats.filter((r) => r.threat_category === c).length, color: threatColor[c] })),
      engines: [
        { label: t.engine.ABAC, value: list.filter((r) => r.abac_decision === "DENY").length, color: "var(--danger)" },
        { label: t.engine.INJECTION, value: list.filter((r) => r.triggered_engines.includes("INJECTION")).length, color: "var(--warning)" },
        { label: t.engine.DLP, value: list.filter(isMasked).length, color: "var(--info)" },
        { label: t.engine.DESTRUCTIVE_OP, value: list.filter((r) => r.triggered_engines.includes("DESTRUCTIVE_OP")).length, color: "var(--primary)" },
      ],
      level: mean(recent.map((r) => r.risk_score)),
      agentsRank,
    };
  }, [requests, state.agents, now, win, t]);

  const pending = hitl.filter((h) => h.decision === "PENDING").sort((a, b) => a.timeout_at - b.timeout_at);
  const activeAgents = state.agents.filter((a) => a.is_active).length;
  const level = data.level >= settings.risk_threshold ? "HIGH" : data.level >= settings.risk_threshold * 0.5 ? "ELEVATED" : "LOW";
  const levelCls = { LOW: "text-success", ELEVATED: "text-warning", HIGH: "text-danger" }[level];

  return (
    <>
      <Card className={cn("mb-4 flex flex-wrap items-center gap-4 p-5", isolated ? "border-danger/40 bg-danger-soft" : "bg-gradient-to-l from-primary-soft/60 to-surface")}>
        <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", isolated ? "bg-danger text-white" : "bg-primary text-primary-fg")}>
          {isolated ? <ShieldOff className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">{isolated ? t.overview.heroOff : t.overview.heroOn}</h1>
          <p className="mt-0.5 text-sm text-muted">{isolated ? t.overview.heroBodyOff : t.overview.heroBody}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge tone="primary">
              <Bot className="h-3 w-3" />
              {t.overview.agentsActive(activeAgents, state.agents.length)}
            </Badge>
            <Badge tone={pending.length ? "warning" : "neutral"}>
              <Hourglass className="h-3 w-3" />
              {t.topbar.pending(pending.length)}
            </Badge>
            <Badge tone={data.p95 > slo ? "danger" : "success"}>
              <Timer className="h-3 w-3" />
              p95 {fmt.num(data.p95)} ms
            </Badge>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="radiogroup" aria-label={t.window.label}>
          {(["15m", "1h", "24h"] as const).map((w) => (
            <button key={w} type="button" role="radio" aria-checked={win === w} onClick={() => setWin(w)} className={cn("rounded-md px-3 py-1.5 text-xs transition", win === w ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}>
              {t.window[w]}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label={t.overview.intercepted} value={fmt.num(data.total)} icon={Workflow} tone="primary" foot={<span className="text-muted">{t.window[win]}</span>} />
        <Kpi label={t.overview.threatsBlocked} value={fmt.num(data.threats)} icon={Radar} tone="danger" foot={<span className="text-muted">{data.total ? fmt.pct(data.threats / data.total) : "—"}</span>} />
        <Kpi label={t.overview.masked} value={fmt.num(data.masked)} icon={EyeOff} tone="info" foot={<span className="text-muted">{t.engine.DLP}</span>} />
        <Kpi label={t.overview.pending} value={fmt.num(pending.length)} icon={Hourglass} tone={pending.length ? "warning" : "neutral"} foot={<span className="text-muted">{fmt.num(settings.hitl_timeout_seconds)} {t.common.seconds}</span>} />
        <Kpi
          label={t.overview.avgLatency}
          value={fmt.num(data.avg)}
          unit={t.common.ms}
          icon={Timer}
          tone={data.p95 > slo ? "danger" : "success"}
          foot={<span className={data.p95 > slo ? "text-danger" : "text-muted"}>{data.p95 > slo ? t.overview.sloBreached : t.overview.slo(slo)}</span>}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t.overview.path} subtitle={t.overview.pathSub} action={<Badge tone={isolated ? "danger" : "success"} dot>{isolated ? t.common.paused : t.common.live}</Badge>} />
          <EnforcementPath />
        </Card>
        <Card>
          <CardHeader title={t.overview.threatLevel} subtitle={t.overview.threatLevelSub} />
          <div className="px-5 pb-5">
            <div className="flex items-end gap-3">
              <span className={cn("font-mono text-5xl font-semibold tabular-nums", levelCls)} dir="ltr">
                {Math.round(data.level * 100)}
              </span>
              <span className={cn("mb-2 text-sm font-medium", levelCls)}>{t.overview.levels[level]}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gradient-to-r from-success via-warning to-danger" dir="ltr">
              <div className="relative h-full" style={{ width: `${data.level * 100}%` }}>
                <span className="absolute -top-0.5 end-0 h-3 w-1 rounded bg-fg" />
              </div>
            </div>
            <div className="mt-6">
              <div className="mb-3 text-xs font-medium">{t.overview.categories}</div>
              {data.threats === 0 ? <p className="text-xs text-muted">{t.overview.noThreats}</p> : <BarList items={data.categories} format={(n) => fmt.num(n)} />}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t.overview.traffic}
            subtitle={t.window[win]}
            action={
              <Legend
                items={[
                  { color: "var(--primary)", label: t.overview.trafficSeries },
                  { color: "var(--danger)", label: t.overview.threatSeries },
                ]}
              />
            }
          />
          <div className="px-5 pb-5">
            <LineChart
              series={[
                { values: data.series.calls, color: "var(--primary)", label: t.overview.trafficSeries, fill: true },
                { values: data.series.threats, color: "var(--danger)", label: t.overview.threatSeries, fill: true },
              ]}
              height={200}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title={t.overview.engineTriggers} subtitle={t.window[win]} />
          <div className="px-5 pb-5">
            <BarList items={data.engines} format={(n) => fmt.num(n)} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title={t.overview.liveFeed}
            action={
              <Link href="/requests" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                {t.common.viewAll}
                <ArrowUpLeft className="h-3.5 w-3.5 ltr:-scale-x-100" />
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {requests.slice(0, 8).map((r) => (
              <li key={r.request_id} className="animate-in flex items-center gap-3 px-5 py-2.5 text-sm sm:gap-4">
                <span className="hidden w-16 shrink-0 font-mono text-xs text-muted tabular-nums sm:block">{fmt.time(r.received_at)}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <bdi className="block truncate font-mono text-xs">{r.tool_name}</bdi>
                  <bdi className="mt-0.5 block truncate text-[11px] text-muted">{agentById(r.agent_id)?.agent_name}</bdi>
                </span>
                {r.threat_category && (
                  <span className="hidden h-2 w-2 shrink-0 rounded-full md:block" style={{ background: threatColor[r.threat_category] }} title={t.threat[r.threat_category]} />
                )}
                <span className="hidden shrink-0 sm:block">
                  <RiskPill score={r.risk_score} threshold={settings.risk_threshold} />
                </span>
                <HttpBadge code={r.http_status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={t.overview.pendingApprovals} action={pending.length > 0 && <Link href="/approvals" className="text-xs text-primary hover:underline">{t.common.viewAll}</Link>} />
          {pending.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title={t.overview.noPending} />
          ) : (
            <ul className="divide-y divide-border">
              {pending.slice(0, 5).map((h) => {
                const r = requests.find((x) => x.request_id === h.request_id);
                if (!r) return null;
                const left = Math.max(0, Math.round((h.timeout_at - now) / 1000));
                return (
                  <li key={h.item_id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <bdi className="block truncate font-mono text-xs">{r.tool_name}</bdi>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <bdi className="truncate">{agentById(r.agent_id)?.agent_name}</bdi>
                        <span className="inline-flex items-center gap-1 text-warning">
                          <Clock className="h-3 w-3" />
                          <span className="font-mono tabular-nums" dir="ltr">
                            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
                          </span>
                        </span>
                      </div>
                    </div>
                    <RiskPill score={r.risk_score} threshold={settings.risk_threshold} />
                    <Link href={`/approvals?item=${h.item_id}`} className="rounded-md bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning hover:text-black">
                      {t.overview.review}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title={t.overview.ranking} subtitle={t.window[win]} />
          <ul className="divide-y divide-border">
            {data.agentsRank.map(({ agent, calls, risk, stopped }) => (
              <li key={agent.agent_id} className="flex items-center gap-3 px-5 py-2.5">
                <Bot className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1 leading-tight">
                  <bdi className="block truncate font-mono text-xs">{agent.agent_name}</bdi>
                  <span className="text-[11px] text-muted">
                    {t.framework[agent.framework]} · {fmt.num(calls)} {t.overview.trafficSeries}
                  </span>
                </div>
                <span className="text-[11px] text-muted">
                  {t.overview.blocked}: <span className="font-mono text-fg tabular-nums">{stopped}</span>
                </span>
                <RiskPill score={risk} threshold={settings.risk_threshold} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={t.overview.health} />
          <ul className="divide-y divide-border px-5 pb-2">
            {health.map((h) => (
              <li key={h.name} className="flex items-center gap-3 py-2.5">
                <span className={cn("live-dot h-2 w-2 rounded-full", h.status === "UP" ? "bg-success text-success" : h.status === "DEGRADED" ? "bg-warning text-warning" : "bg-danger text-danger")} />
                <span className="flex-1 text-sm">{t.service[h.name]}</span>
                <span className="font-mono text-xs text-muted tabular-nums" dir="ltr">
                  {h.latency_ms} ms
                </span>
                <Badge tone={h.status === "UP" ? "success" : h.status === "DEGRADED" ? "warning" : "danger"}>{t.service[h.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
