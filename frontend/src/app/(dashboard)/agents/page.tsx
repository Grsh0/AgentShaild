"use client";

import { Bot, KeyRound, Pencil, Plus, Power, PowerOff, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Badge, FrameworkBadge, RiskPill, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Mono } from "@/components/ui/data";
import { ChipGroup, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { isStopped, mean } from "@/lib/analytics";
import { usePrefs } from "@/lib/i18n/preferences";
import { FRAMEWORKS, MODELS, certificateFor } from "@/lib/mock-data";
import { useGateway, useLookup } from "@/lib/store/gateway-store";
import type { Agent, AgentFramework, TrustTier } from "@/lib/types";

const TIERS: TrustTier[] = ["HIGH", "MEDIUM", "LOW"];

function AgentEditor({ initial, isNew, onClose }: { initial: Agent; isNew: boolean; onClose: () => void }) {
  const { t } = usePrefs();
  const { state, saveAgent } = useGateway();
  const [a, setA] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const owners = state.users.filter((u) => !u.is_admin);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = a.agent_name.trim();
    if (!name) return setError(t.agents.nameRequired);
    saveAgent({ ...a, agent_name: name, certificate_fingerprint: isNew ? certificateFor(name) : a.certificate_fingerprint }, isNew);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? t.agents.createTitle : t.agents.editTitle}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" type="submit" form="agent-form">
            {t.common.save}
          </Button>
        </>
      }
    >
      <form id="agent-form" onSubmit={submit} className="space-y-4">
        <Field label={t.agents.name} error={error ?? undefined} htmlFor="aname">
          <Input
            id="aname"
            dir="ltr"
            className="font-mono"
            value={a.agent_name}
            onChange={(e) => {
              setError(null);
              setA({ ...a, agent_name: e.target.value });
            }}
            placeholder="Logistics-Bot-07"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.agents.framework} htmlFor="afw">
            <Select id="afw" value={a.framework} onChange={(e) => setA({ ...a, framework: e.target.value as AgentFramework })}>
              {FRAMEWORKS.map((f) => (
                <option key={f} value={f}>
                  {t.framework[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.agents.model} htmlFor="amodel">
            <Input id="amodel" dir="ltr" list="models" value={a.model} onChange={(e) => setA({ ...a, model: e.target.value })} placeholder="GPT-4o / Llama-3-8B" />
            <datalist id="models">
              {MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium">{t.agents.tier}</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.agents.tier}>
            {TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                role="radio"
                aria-checked={a.trust_tier === tier}
                onClick={() => setA({ ...a, trust_tier: tier })}
                className={cn("rounded-lg border px-3 py-2 text-sm transition", a.trust_tier === tier ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-fg")}
              >
                {t.tier[tier]}
              </button>
            ))}
          </div>
        </div>
        <Field label={t.agents.owner} htmlFor="aowner">
          <Select id="aowner" value={a.owner_user_id} onChange={(e) => setA({ ...a, owner_user_id: e.target.value })}>
            {owners.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.full_name} ({u.username})
              </option>
            ))}
          </Select>
        </Field>
        <ChipGroup label={t.agents.tools} options={state.tools.map((x) => ({ value: x.tool_name, label: x.tool_name }))} value={a.allowed_tools} onChange={(allowed_tools) => setA({ ...a, allowed_tools })} />
        <Field label={t.agents.purpose} htmlFor="apurpose">
          <Textarea id="apurpose" rows={2} value={a.purpose} onChange={(e) => setA({ ...a, purpose: e.target.value })} placeholder={t.agents.purposePlaceholder} />
        </Field>
      </form>
    </Modal>
  );
}

function AgentsView() {
  const { t, fmt } = usePrefs();
  const { state, setAgentActive, newId } = useGateway();
  const { userById } = useLookup();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [fw, setFw] = useState<AgentFramework | "">("");
  const [deactivating, setDeactivating] = useState<Agent | null>(null);

  const newAgent = (): Agent => ({
    agent_id: `ag-${newId().slice(0, 8)}`,
    agent_name: "",
    framework: "LANGCHAIN",
    model: "GPT-4o",
    purpose: "",
    trust_tier: "LOW",
    owner_user_id: state.users.find((u) => !u.is_admin)?.user_id ?? "",
    allowed_tools: [],
    certificate_fingerprint: "",
    certificate_expires_at: Date.now() + 365 * 86_400_000,
    is_active: true,
    registered_at: Date.now(),
    deactivated_at: null,
    last_seen_at: null,
  });
  const [editing, setEditing] = useState<{ agent: Agent; isNew: boolean } | null>(() => (params.get("new") ? { agent: newAgent(), isNew: true } : null));

  const stats = useMemo(() => {
    const since = state.now - 86_400_000;
    const map = new Map<string, { total: number; blocked: number; risk: number }>();
    for (const a of state.agents) {
      const mine = state.requests.filter((r) => r.agent_id === a.agent_id && r.received_at >= since);
      map.set(a.agent_id, { total: mine.length, blocked: mine.filter(isStopped).length, risk: mean(mine.map((r) => r.risk_score)) });
    }
    return map;
  }, [state.requests, state.agents, state.now]);

  const agents = state.agents.filter((a) => (!fw || a.framework === fw) && (!q.trim() || a.agent_name.toLowerCase().includes(q.trim().toLowerCase())));
  const usedFrameworks = FRAMEWORKS.filter((f) => state.agents.some((a) => a.framework === f));

  return (
    <>
      <PageHeader
        title={t.agents.title}
        subtitle={t.agents.subtitle}
        actions={
          <>
            <Badge tone="success" dot>
              {t.agents.active(state.agents.filter((a) => a.is_active).length)}
            </Badge>
            <Button variant="primary" onClick={() => setEditing({ agent: newAgent(), isNew: true })}>
              <Plus className="h-4 w-4" />
              {t.agents.register}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.agents.searchPlaceholder} className="ps-9" aria-label={t.common.search} />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {(["", ...usedFrameworks] as const).map((f) => (
            <button key={f || "all"} type="button" onClick={() => setFw(f)} aria-pressed={fw === f} className={cn("rounded-md px-3 py-1.5 text-xs transition", fw === f ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}>
              {f ? t.framework[f] : t.agents.allFrameworks}
            </button>
          ))}
        </div>
      </div>

      {agents.length === 0 ? (
        <Card>
          <EmptyState title={t.common.noResults} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {agents.map((a) => {
            const s = stats.get(a.agent_id) ?? { total: 0, blocked: 0, risk: 0 };
            const owner = userById(a.owner_user_id);
            const live = a.last_seen_at !== null && state.now - a.last_seen_at < 10_000;
            return (
              <Card key={a.agent_id} className={cn("flex flex-col p-5", !a.is_active && "border-dashed opacity-75")}>
                <div className="flex items-start gap-3">
                  <span className={cn("relative grid h-11 w-11 shrink-0 place-items-center rounded-xl", a.is_active ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted")}>
                    <Bot className="h-5 w-5" />
                    {live && <span className="live-dot absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success text-success" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <bdi className="truncate font-mono text-sm font-semibold">{a.agent_name}</bdi>
                      <TierBadge tier={a.trust_tier} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <FrameworkBadge framework={a.framework} />
                      <bdi>{a.model}</bdi>
                    </div>
                  </div>
                  <Badge tone={a.is_active ? "success" : "danger"} dot>
                    {a.is_active ? t.common.active : t.agents.deactivate}
                  </Badge>
                </div>

                {a.purpose && <p className="mt-3 text-sm leading-relaxed text-muted">{a.purpose}</p>}

                <div className="mt-3 flex flex-wrap gap-1">
                  {a.allowed_tools.length ? (
                    a.allowed_tools.map((tool) => (
                      <bdi key={tool} className="rounded border border-border bg-surface-2/60 px-1.5 py-0.5 font-mono text-[11px]">
                        {tool}
                      </bdi>
                    ))
                  ) : (
                    <span className="text-xs text-muted italic">{t.agents.noTools}</span>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-4 gap-2 rounded-lg bg-surface-2/50 p-3">
                  <div>
                    <dt className="text-[10px] text-muted">{t.agents.requests24h}</dt>
                    <dd className="font-mono text-base font-semibold tabular-nums">{fmt.num(s.total)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-muted">{t.agents.blockedRate}</dt>
                    <dd className={cn("font-mono text-base font-semibold tabular-nums", s.total && s.blocked / s.total > 0.2 ? "text-danger" : "")}>{fmt.pct(s.total ? s.blocked / s.total : 0)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[10px] text-muted">{t.agents.avgRisk}</dt>
                    <dd className="mt-1">
                      <RiskPill score={s.risk} threshold={state.settings.risk_threshold} />
                    </dd>
                  </div>
                </dl>

                <dl className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{t.agents.owner}</dt>
                    <dd>{owner?.full_name}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{t.agents.lastSeen}</dt>
                    <dd>{a.last_seen_at ? fmt.relative(a.last_seen_at, state.now) : t.common.never}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="inline-flex items-center gap-1 text-muted">
                      <KeyRound className="h-3 w-3" />
                      {t.agents.certificate}
                    </dt>
                    <dd>
                      <Mono value={a.certificate_fingerprint} chars={8} />
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted">
                  <span>{a.is_active ? `${t.agents.certExpires}: ${fmt.date(a.certificate_expires_at)}` : `${t.agents.deactivatedAt}: ${a.deactivated_at ? fmt.date(a.deactivated_at) : "—"}`}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing({ agent: a, isNew: false })}>
                      <Pencil className="h-3.5 w-3.5" />
                      {t.common.edit}
                    </Button>
                    {a.is_active ? (
                      <Button variant="ghost" size="sm" className="hover:text-danger" onClick={() => setDeactivating(a)}>
                        <PowerOff className="h-3.5 w-3.5" />
                        {t.agents.deactivate}
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-primary" onClick={() => setAgentActive(a.agent_id, true)}>
                        <Power className="h-3.5 w-3.5" />
                        {t.agents.activate}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && <AgentEditor key={editing.agent.agent_id} initial={editing.agent} isNew={editing.isNew} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deactivating}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && setAgentActive(deactivating.agent_id, false)}
        title={t.agents.deactivateTitle}
        body={deactivating ? t.agents.deactivateBody(deactivating.agent_name) : ""}
        confirmLabel={t.agents.deactivate}
      />
    </>
  );
}

export default function AgentsPage() {
  return (
    <Suspense>
      <AgentsView />
    </Suspense>
  );
}
