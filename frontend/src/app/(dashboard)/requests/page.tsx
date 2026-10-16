"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RequestDetails } from "@/components/request-details";
import { Button } from "@/components/ui/button";
import { HttpBadge, OpBadge, RiskPill, StatusBadge, threatColor } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Mono } from "@/components/ui/data";
import { Input, Select } from "@/components/ui/form";
import { Drawer } from "@/components/ui/modal";
import { THREATS } from "@/lib/analytics";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway, useLookup } from "@/lib/store/gateway-store";
import type { HttpStatus, OperationType, RequestStatus, ThreatCategory } from "@/lib/types";

const STATUSES: RequestStatus[] = ["ALLOWED", "BLOCKED", "PENDING_HITL", "HITL_APPROVED", "HITL_REJECTED", "HITL_TIMED_OUT", "KILL_SWITCH_BLOCKED", "AUTH_FAILED", "INVALID_REQUEST"];
const OPS: OperationType[] = ["READ", "WRITE", "DELETE", "EXEC"];
const CODES: HttpStatus[] = [200, 202, 400, 401, 403, 408, 503];
const PAGE = 30;

export default function RequestsPage() {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  const { agentById, userById } = useLookup();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [code, setCode] = useState<HttpStatus | "">("");
  const [op, setOp] = useState<OperationType | "">("");
  const [threat, setThreat] = useState<ThreatCategory | "">("");
  const [agentId, setAgentId] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.requests.filter((r) => {
      if (status && r.status !== status) return false;
      if (code && r.http_status !== code) return false;
      if (op && r.operation_type !== op) return false;
      if (threat && r.threat_category !== threat) return false;
      if (agentId && r.agent_id !== agentId) return false;
      if (!needle) return true;
      const agent = state.agents.find((a) => a.agent_id === r.agent_id);
      return r.tool_name.includes(needle) || r.request_id.includes(needle) || !!agent?.agent_name.toLowerCase().includes(needle);
    });
  }, [state.requests, state.agents, q, status, code, op, threat, agentId]);

  const open = openId ? state.requests.find((r) => r.request_id === openId) : null;
  const headers = [t.requests.time, t.requests.trace, t.requests.tool, t.requests.operation, t.requests.agent, t.requests.user, t.requests.threat, t.requests.risk, t.requests.status, t.requests.http, t.requests.latency];

  return (
    <>
      <PageHeader title={t.requests.title} subtitle={t.requests.subtitle} />

      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1fr_repeat(5,minmax(0,150px))]">
          <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.requests.searchPlaceholder} className="ps-9" aria-label={t.common.search} />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as RequestStatus | "")} aria-label={t.requests.statusFilter}>
            <option value="">{t.requests.statusFilter}: {t.common.all}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{t.status[s]}</option>
            ))}
          </Select>
          <Select value={code} onChange={(e) => setCode(e.target.value ? (Number(e.target.value) as HttpStatus) : "")} aria-label={t.requests.http}>
            <option value="">{t.requests.http}: {t.common.all}</option>
            {CODES.map((c) => (
              <option key={c} value={c}>{c} · {t.http[c]}</option>
            ))}
          </Select>
          <Select value={threat} onChange={(e) => setThreat(e.target.value as ThreatCategory | "")} aria-label={t.requests.threat}>
            <option value="">{t.requests.threat}: {t.common.all}</option>
            {THREATS.map((c) => (
              <option key={c} value={c}>{t.threat[c]}</option>
            ))}
          </Select>
          <Select value={op} onChange={(e) => setOp(e.target.value as OperationType | "")} aria-label={t.requests.opFilter}>
            <option value="">{t.requests.opFilter}: {t.common.all}</option>
            {OPS.map((o) => (
              <option key={o} value={o}>{t.op[o]}</option>
            ))}
          </Select>
          <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label={t.requests.agent}>
            <option value="">{t.requests.agent}: {t.common.all}</option>
            {state.agents.map((a) => (
              <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] text-muted">
                {headers.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, limit).map((r) => (
                <tr
                  key={r.request_id}
                  onClick={() => setOpenId(r.request_id)}
                  onKeyDown={(e) => e.key === "Enter" && setOpenId(r.request_id)}
                  tabIndex={0}
                  className="cursor-pointer transition hover:bg-surface-2/50 focus-visible:bg-surface-2 focus-visible:outline-none"
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-muted tabular-nums">{fmt.time(r.received_at)}</td>
                  <td className="px-3 py-2.5">
                    <Mono value={r.request_id} chars={6} copy={false} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <bdi>{r.tool_name}</bdi>
                  </td>
                  <td className="px-3 py-2.5">
                    <OpBadge op={r.operation_type} />
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <bdi>{agentById(r.agent_id)?.agent_name}</bdi>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted">{userById(r.user_id)?.username}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.threat_category ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="h-2 w-2 rounded-full" style={{ background: threatColor[r.threat_category] }} />
                        {t.threat[r.threat_category]}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <RiskPill score={r.risk_score} threshold={state.settings.risk_threshold} />
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <HttpBadge code={r.http_status} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted tabular-nums">
                    <bdi>{r.latency_ms} ms</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyState title={t.common.noResults} />}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
          <span>{t.audit.showing(Math.min(limit, filtered.length), filtered.length)}</span>
          {limit < filtered.length && (
            <Button size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              {t.common.loadMore}
            </Button>
          )}
        </div>
      </Card>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={t.requests.drawerTitle}>
        {open && <RequestDetails r={open} />}
      </Drawer>
    </>
  );
}
