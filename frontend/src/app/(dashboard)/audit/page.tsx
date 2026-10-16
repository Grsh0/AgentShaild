"use client";

import { ChevronDown, Download, FlaskConical, Link2, RotateCcw, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { JsonView, Mono } from "@/components/ui/data";
import { Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway, useLookup } from "@/lib/store/gateway-store";
import type { AbacDecision, AuditEventType, AuditLog } from "@/lib/types";

const EVENT_TYPES: AuditEventType[] = [
  "TOOL_CALL_ALLOWED",
  "TOOL_CALL_BLOCKED",
  "AUTH_FAILED",
  "INVALID_REQUEST",
  "HITL_ESCALATED",
  "HITL_APPROVED",
  "HITL_REJECTED",
  "HITL_TIMED_OUT",
  "KILL_SWITCH_ACTIVATED",
  "KILL_SWITCH_DEACTIVATED",
  "KILL_SWITCH_BLOCKED",
  "POLICY_CREATED",
  "POLICY_UPDATED",
  "POLICY_DELETED",
  "AGENT_REGISTERED",
  "AGENT_UPDATED",
  "AGENT_DEACTIVATED",
  "AGENT_ACTIVATED",
  "TOOL_DISABLED",
  "TOOL_ENABLED",
  "USER_CREATED",
  "USER_UPDATED",
  "SETTINGS_UPDATED",
];

function eventTone(e: AuditEventType): Tone {
  if (e === "TOOL_CALL_ALLOWED" || e === "HITL_APPROVED" || e === "AGENT_ACTIVATED" || e === "TOOL_ENABLED") return "success";
  if (e.startsWith("KILL_SWITCH") || e === "TOOL_CALL_BLOCKED" || e === "AUTH_FAILED" || e === "HITL_REJECTED" || e === "AGENT_DEACTIVATED" || e === "POLICY_DELETED" || e === "TOOL_DISABLED") return "danger";
  if (e === "HITL_ESCALATED" || e === "HITL_TIMED_OUT" || e === "INVALID_REQUEST") return "warning";
  return "info";
}

const PAGE = 30;

interface Filters {
  q: string;
  event: AuditEventType | "";
  user: string;
  agent: string;
  tool: string;
  decision: AbacDecision | "";
  riskMin: string;
  riskMax: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { q: "", event: "", user: "", agent: "", tool: "", decision: "", riskMin: "", riskMax: "", from: "", to: "" };

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: AuditLog[]) {
  const head = ["index", "timestamp", "event_type", "actor_user_id", "request_id", "payload_hash", "hmac_signature", "previous_entry_hash", "event_details"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    head.join(","),
    ...rows.map((r) =>
      [r.index, new Date(r.timestamp).toISOString(), r.event_type, r.actor_user_id, r.request_id, r.payload_hash, r.hmac_signature, r.previous_entry_hash, JSON.stringify(r.event_details)].map(esc).join(","),
    ),
  ].join("\n");
}

export default function AuditPage() {
  const { t, fmt } = usePrefs();
  const { state, verifyAudit, tamperAudit, restoreAudit } = useGateway();
  const { userById } = useLookup();
  const [f, setF] = useState<Filters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [verifying, setVerifying] = useState(false);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setLimit(PAGE);
  };

  const rows = useMemo(() => {
    const needle = f.q.trim().toLowerCase();
    const from = f.from ? new Date(f.from).getTime() : null;
    const to = f.to ? new Date(f.to).getTime() : null;
    const min = f.riskMin === "" ? null : Number(f.riskMin);
    const max = f.riskMax === "" ? null : Number(f.riskMax);
    return [...state.audit].reverse().filter((e) => {
      const d = e.event_details as Record<string, unknown>;
      if (f.event && e.event_type !== f.event) return false;
      if (f.user && d.user_id !== f.user && e.actor_user_id !== f.user) return false;
      if (f.agent && d.agent_id !== f.agent) return false;
      if (f.tool && d.tool !== f.tool) return false;
      if (f.decision && d.abac_decision !== f.decision) return false;
      if (min !== null && !(typeof d.risk_score === "number" && d.risk_score >= min)) return false;
      if (max !== null && !(typeof d.risk_score === "number" && d.risk_score <= max)) return false;
      if (from !== null && e.timestamp < from) return false;
      if (to !== null && e.timestamp > to) return false;
      if (!needle) return true;
      return (
        (e.request_id ?? "").includes(needle) ||
        e.payload_hash.includes(needle) ||
        e.hmac_signature.includes(needle) ||
        JSON.stringify(e.event_details).toLowerCase().includes(needle)
      );
    });
  }, [state.audit, f]);

  const activeFilters = Object.entries(f).filter(([k, v]) => k !== "q" && v !== "").length;
  const v = state.verification;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return (
    <>
      <PageHeader
        title={t.audit.title}
        subtitle={t.audit.subtitle}
        actions={
          <>
            <Button onClick={() => download(`audit-${stamp}.csv`, toCsv(rows), "text/csv;charset=utf-8")}>
              <Download className="h-4 w-4" />
              {t.audit.exportCsv}
            </Button>
            <Button onClick={() => download(`audit-${stamp}.json`, JSON.stringify(rows, null, 2), "application/json")}>
              <Download className="h-4 w-4" />
              {t.audit.exportJson}
            </Button>
            <Button
              variant="primary"
              disabled={verifying}
              onClick={() => {
                setVerifying(true);
                setTimeout(() => {
                  verifyAudit();
                  setVerifying(false);
                }, 450);
              }}
            >
              <Link2 className="h-4 w-4" />
              {verifying ? t.audit.verifying : t.audit.verify}
            </Button>
          </>
        }
      />

      {v && (
        <div
          role="status"
          className={cn(
            "animate-in mb-4 flex flex-wrap items-start gap-3 rounded-xl border p-4",
            v.status === "INTACT" ? "border-success/40 bg-success-soft" : "border-danger/50 bg-danger-soft",
          )}
        >
          {v.status === "INTACT" ? <ShieldCheck className="h-6 w-6 shrink-0 text-success" /> : <ShieldAlert className="h-6 w-6 shrink-0 text-danger" />}
          <div className="min-w-0 flex-1">
            <div className={cn("font-semibold", v.status === "INTACT" ? "text-success" : "text-danger")}>
              {v.status === "INTACT" ? t.audit.intactTitle : t.audit.compromisedTitle}
            </div>
            <p className="mt-0.5 text-sm">
              {v.status === "INTACT" ? t.audit.intactBody(v.checked) : t.audit.compromisedBody(v.index, t.audit.reasons[v.reason])}
            </p>
            <p className="mt-1 text-[11px] text-muted">{fmt.dateTime(v.at)}</p>
          </div>
          {v.status === "COMPROMISED" && (
            <Button
              size="sm"
              onClick={() => {
                setF(EMPTY);
                setLimit(state.audit.length);
                const target = state.audit.find((e) => e.index === v.index);
                if (target) {
                  setExpanded(target.log_id);
                  setTimeout(() => document.getElementById(`log-${target.log_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                }
              }}
            >
              #{v.index}
            </Button>
          )}
        </div>
      )}

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder={t.audit.searchPlaceholder} className="ps-9" aria-label={t.common.search} />
          </div>
          <Select value={f.event} onChange={(e) => set("event", e.target.value as AuditEventType | "")} className="w-auto min-w-48" aria-label={t.audit.eventType}>
            <option value="">
              {t.audit.eventType}: {t.common.all}
            </option>
            {EVENT_TYPES.map((e) => (
              <option key={e} value={e}>
                {t.event[e]}
              </option>
            ))}
          </Select>
          <Button onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            {t.audit.filters}
            {activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-fg">{activeFilters}</span>}
            <ChevronDown className={cn("h-4 w-4 transition", showFilters && "rotate-180")} />
          </Button>
          {(activeFilters > 0 || f.q) && (
            <Button variant="ghost" onClick={() => setF(EMPTY)}>
              {t.audit.clearFilters}
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="animate-in mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.audit.user} htmlFor="fu">
              <Select id="fu" value={f.user} onChange={(e) => set("user", e.target.value)}>
                <option value="">{t.common.all}</option>
                {state.users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.audit.agent} htmlFor="fa">
              <Select id="fa" value={f.agent} onChange={(e) => set("agent", e.target.value)}>
                <option value="">{t.common.all}</option>
                {state.agents.map((a) => (
                  <option key={a.agent_id} value={a.agent_id}>
                    {a.agent_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.audit.tool} htmlFor="ft">
              <Select id="ft" value={f.tool} onChange={(e) => set("tool", e.target.value)}>
                <option value="">{t.common.all}</option>
                {state.tools.map((x) => (
                  <option key={x.tool_name} value={x.tool_name}>
                    {x.tool_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.audit.decision} htmlFor="fd">
              <Select id="fd" value={f.decision} onChange={(e) => set("decision", e.target.value as AbacDecision | "")}>
                <option value="">{t.common.all}</option>
                {(["ALLOW", "DENY", "HITL_REQUIRED"] as const).map((d) => (
                  <option key={d} value={d}>
                    {t.decision[d]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`${t.audit.dateRange} — ${t.common.from}`} htmlFor="ffrom">
              <Input id="ffrom" type="datetime-local" dir="ltr" value={f.from} onChange={(e) => set("from", e.target.value)} />
            </Field>
            <Field label={`${t.audit.dateRange} — ${t.common.to}`} htmlFor="fto">
              <Input id="fto" type="datetime-local" dir="ltr" value={f.to} onChange={(e) => set("to", e.target.value)} />
            </Field>
            <Field label={`${t.audit.riskRange} — ${t.common.from}`} htmlFor="frmin">
              <Input id="frmin" type="number" min={0} max={1} step={0.05} dir="ltr" placeholder="0.00" value={f.riskMin} onChange={(e) => set("riskMin", e.target.value)} />
            </Field>
            <Field label={`${t.audit.riskRange} — ${t.common.to}`} htmlFor="frmax">
              <Input id="frmax" type="number" min={0} max={1} step={0.05} dir="ltr" placeholder="1.00" value={f.riskMax} onChange={(e) => set("riskMax", e.target.value)} />
            </Field>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] text-muted">
                <th className="w-8 px-3" aria-hidden />
                {[t.audit.index, t.audit.time, t.audit.eventType, t.audit.actor, t.audit.request, t.audit.payloadHash, t.audit.signature, t.audit.prevHash].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.slice(0, limit).map((e) => {
                const open = expanded === e.log_id;
                const broken = v?.status === "COMPROMISED" && v.index === e.index;
                return (
                  <Fragment key={e.log_id}>
                    <tr
                      id={`log-${e.log_id}`}
                      onClick={() => setExpanded(open ? null : e.log_id)}
                      className={cn("cursor-pointer transition hover:bg-surface-2/50", broken && "bg-danger-soft")}
                    >
                      <td className="px-3 text-muted">
                        <ChevronDown className={cn("h-4 w-4 transition", open ? "rotate-180" : "rtl:rotate-90 ltr:-rotate-90")} />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted tabular-nums">{e.index}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap text-muted">{fmt.dateTime(e.timestamp)}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={eventTone(e.event_type)}>{t.event[e.event_type]}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{e.actor_user_id ? userById(e.actor_user_id)?.full_name : <span className="text-muted">{t.approvals.system}</span>}</td>
                      <td className="px-3 py-2.5">{e.request_id ? <Mono value={e.request_id} chars={6} copy={false} /> : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <Mono value={e.payload_hash} chars={8} copy={false} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Mono value={e.hmac_signature} chars={8} copy={false} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Mono value={e.previous_entry_hash} chars={8} copy={false} />
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-surface-2/30">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <div className="mb-1.5 text-xs font-medium text-muted">{t.audit.eventDetails}</div>
                              <JsonView value={e.event_details} />
                            </div>
                            <dl className="space-y-3">
                              {[
                                [t.audit.payloadHash, e.payload_hash],
                                [t.audit.signature, e.hmac_signature],
                                [t.audit.prevHash, e.previous_entry_hash],
                                ...(e.request_id ? [[t.approvals.traceId, e.request_id]] : []),
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <dt className="text-[11px] text-muted">{label}</dt>
                                  <dd>
                                    <Mono value={value} chars={40} className="break-all text-fg" />
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <EmptyState title={t.common.noResults} />}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted">
          <span>{t.audit.showing(Math.min(limit, rows.length), rows.length)}</span>
          <div className="flex items-center gap-2">
            {state.tampered ? (
              <Button size="sm" variant="ghost" onClick={restoreAudit}>
                <RotateCcw className="h-3.5 w-3.5" />
                {t.audit.restore}
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={tamperAudit} title={t.audit.tamperHint}>
                <FlaskConical className="h-3.5 w-3.5" />
                {t.audit.tamperDemo}
              </Button>
            )}
            {limit < rows.length && (
              <Button size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                {t.common.loadMore}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
