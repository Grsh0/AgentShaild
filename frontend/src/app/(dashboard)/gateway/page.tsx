"use client";

import { ArrowLeft, CheckCircle2, Cpu, Gauge, Power, Server } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, HttpBadge } from "@/components/ui/badge";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/data";
import { cn } from "@/lib/cn";
import { isExecuted, mean } from "@/lib/analytics";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway } from "@/lib/store/gateway-store";
import type { HttpStatus } from "@/lib/types";

const CODES: HttpStatus[] = [200, 202, 400, 401, 403, 408, 503];

const BODIES: Record<HttpStatus, object> = {
  200: { trace_id: "8f3a…c21d", decision: "ALLOW", risk_score: 0.18, redactions: ["[REDACTED_EMAIL]"], result: { rows: 1 } },
  202: { trace_id: "8f3a…c21d", decision: "HITL_REQUIRED", task_id: "b71e…09aa", risk_score: 0.84, reason: "DESTRUCTIVE_OP", poll: "/v1/tasks/b71e…09aa" },
  400: { trace_id: "8f3a…c21d", error: "INVALID_REQUEST", detail: "tool_name is required" },
  401: { trace_id: "8f3a…c21d", error: "AUTH_FAILED", detail: "agent certificate invalid or revoked" },
  403: { trace_id: "8f3a…c21d", error: "FORBIDDEN", rule_id: "POL-004", reason: "deny_payroll_others" },
  408: { trace_id: "8f3a…c21d", error: "HITL_TIMEOUT", task_id: "b71e…09aa", timeout_seconds: 300 },
  503: { trace_id: "8f3a…c21d", error: "KILL_SWITCH_ACTIVE" },
};

const SNIPPETS: Record<string, string> = {
  cURL: `curl -X POST http://gateway:8000/api/v1/execute \\
  -H "Authorization: Bearer <user-jwt>" \\
  -H "X-Agent-Certificate: <signed-agent-cert>" \\
  -H "Content-Type: application/json" \\
  -d '{"tool_name":"query_database","arguments":{"sql":"SELECT id FROM customers"}}'`,
  Python: `import httpx

resp = httpx.post(
    "http://gateway:8000/api/v1/execute",
    headers={"Authorization": f"Bearer {user_jwt}", "X-Agent-Certificate": agent_cert},
    json={"tool_name": "query_database", "arguments": {"sql": sql}},
)
if resp.status_code == 202:
    task_id = resp.json()["task_id"]  # poll /api/v1/tasks/{task_id}`,
  LangChain: `from langchain_core.tools import tool
from agentshield import GatewayClient

gw = GatewayClient("http://gateway:8000", user_jwt=jwt, agent_cert=cert)

@tool
def query_database(sql: str) -> str:
    """Read-only query on the CRM database."""
    return gw.execute("query_database", {"sql": sql})`,
  CrewAI: `from crewai.tools import BaseTool
from agentshield import GatewayClient

gw = GatewayClient("http://gateway:8000", user_jwt=jwt, agent_cert=cert)

class SendEmail(BaseTool):
    name: str = "send_email"
    description: str = "Send an email through the corporate relay"
    def _run(self, to: str, body: str) -> str:
        return gw.execute("send_email", {"to": to, "body": body})`,
};

export default function GatewayPage() {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  const [lang, setLang] = useState<keyof typeof SNIPPETS>("cURL");
  const isolated = state.settings.kill_switch_active;

  const stats = useMemo(() => {
    const minute = state.requests.filter((r) => r.received_at >= state.now - 60_000);
    const recent = state.requests.slice(0, 200);
    const done = recent.filter((r) => r.status !== "PENDING_HITL");
    return {
      rate: minute.length,
      overhead: mean(recent.filter((r) => r.http_status !== 503).map((r) => r.latency_ms)),
      pass: done.length ? done.filter(isExecuted).length / done.length : 0,
      codes: CODES.map((c) => ({ c, n: recent.filter((r) => r.http_status === c).length })),
    };
  }, [state.requests, state.now]);

  const toolsOff = state.tools.filter((x) => !x.enabled).length;
  const flow = [
    { title: t.gateway.agent, sub: t.gateway.agentSub },
    { title: t.gateway.interceptor, sub: t.gateway.interceptorSub },
    { title: t.gateway.validate, sub: t.gateway.validateSub },
    { title: t.gateway.sanitize, sub: t.gateway.sanitizeSub },
    { title: t.gateway.auditStep, sub: t.gateway.auditStepSub },
    { title: t.gateway.target, sub: t.gateway.targetSub },
  ];

  return (
    <>
      <PageHeader title={t.gateway.title} subtitle={t.gateway.subtitle} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className={cn("p-4", isolated && "border-danger/40 bg-danger-soft")}>
          <div className="flex items-center justify-between text-xs text-muted">
            {t.gateway.state}
            <Power className={cn("h-4 w-4", isolated ? "text-danger" : "text-success")} />
          </div>
          <div className={cn("mt-2 text-2xl font-semibold", isolated ? "text-danger" : "text-success")}>{isolated ? t.gateway.isolated : t.gateway.online}</div>
          <bdi className="mt-1 block font-mono text-[11px] text-muted">{t.instance.name}</bdi>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            {t.gateway.throughput}
            <Gauge className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{stats.rate}</div>
          <div className="mt-1 text-[11px] text-muted">{t.topbar.perMinute}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            {t.gateway.overhead}
            <Cpu className="h-4 w-4 text-info" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums" dir="ltr">
            {fmt.num(stats.overhead)} ms
          </div>
          <div className="mt-1 text-[11px] text-muted">{t.overview.slo(state.settings.latency_alert_ms)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            {t.gateway.passRate}
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{fmt.pct(stats.pass)}</div>
          <div className={cn("mt-1 text-[11px]", toolsOff ? "text-danger" : "text-muted")}>{t.gateway.toolsDisabled(toolsOff)}</div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title={t.gateway.lifecycle} subtitle={t.gateway.lifecycleSub} />
        <div className="overflow-x-auto px-5 pb-5">
          <div className="relative min-w-[760px] rounded-xl border border-dashed border-primary/40 p-4 pt-6">
            <span className="absolute -top-2.5 start-4 bg-surface px-2 text-[11px] text-primary">{t.gateway.boundary}</span>
            <ol className="flex items-center gap-2">
              {flow.map((f, i) => (
                <li key={f.title} className="flex flex-1 items-center gap-2">
                  <div className={cn("flex-1 rounded-lg border p-3 text-center", i === 0 || i === flow.length - 1 ? "border-border bg-surface-2/50" : "border-primary/40 bg-primary-soft/50")}>
                    <div className="text-sm font-medium">{f.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{f.sub}</div>
                  </div>
                  {i < flow.length - 1 && <ArrowLeft className="h-4 w-4 shrink-0 text-primary ltr:rotate-180" />}
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.codes.map(({ c, n }) => (
              <span key={c} className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                <HttpBadge code={c} />
                <span className="text-muted">{t.http[c]}</span>
                <span className="font-mono tabular-nums">{n}</span>
              </span>
            ))}
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          <CardHeader title={t.gateway.integration} subtitle={t.gateway.integrationSub} />
          <div className="px-5 pb-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div role="tablist" className="flex gap-1 rounded-lg border border-border bg-surface-2/50 p-1">
                {(Object.keys(SNIPPETS) as (keyof typeof SNIPPETS)[]).map((k) => (
                  <button key={k} role="tab" aria-selected={lang === k} onClick={() => setLang(k)} className={cn("rounded-md px-3 py-1 text-xs transition", lang === k ? "bg-surface font-medium text-fg" : "text-muted hover:text-fg")}>
                    {k}
                  </button>
                ))}
              </div>
              <CopyButton value={SNIPPETS[lang]} />
            </div>
            <pre dir="ltr" className="overflow-x-auto rounded-lg border border-border bg-bg/70 p-4 text-start font-mono text-xs leading-relaxed text-fg/90">
              {SNIPPETS[lang]}
            </pre>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title={t.gateway.services} />
            <ul className="divide-y divide-border px-5 pb-2">
              {state.health.map((h) => (
                <li key={h.name} className="flex items-center gap-3 py-2.5">
                  <Server className="h-4 w-4 text-muted" />
                  <span className="flex-1 text-sm">{t.service[h.name]}</span>
                  <span className="font-mono text-[11px] text-muted" dir="ltr">
                    {h.latency_ms} ms
                  </span>
                  <Badge tone={h.status === "UP" ? "success" : "warning"} dot>
                    {t.service[h.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-semibold">{t.gateway.rules}</h2>
            <ul className="mt-3 space-y-2">
              {t.gateway.rulesList.map((r) => (
                <li key={r} className="flex items-start gap-2 text-xs leading-relaxed">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  {r}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title={t.gateway.contract} subtitle={t.gateway.contractSub} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-y border-border bg-surface-2/50 text-[11px] text-muted">
                {[t.gateway.code, t.gateway.meaning, t.gateway.when, t.gateway.body].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CODES.map((c) => (
                <tr key={c} className="align-top">
                  <td className="px-4 py-3">
                    <HttpBadge code={c} />
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">{t.http[c]}</td>
                  <td className="max-w-xs px-4 py-3 text-xs text-muted">{t.gateway.whenText[c]}</td>
                  <td className="px-4 py-3">
                    <pre dir="ltr" className="rounded-md bg-bg/60 p-2 text-start font-mono text-[11px] whitespace-pre-wrap text-fg/85">
                      {JSON.stringify(BODIES[c])}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
