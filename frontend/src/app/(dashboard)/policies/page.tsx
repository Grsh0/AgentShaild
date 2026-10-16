"use client";

import { Check, FlaskConical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { DecisionBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { ChipGroup, Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { evaluateAbac } from "@/lib/engine/abac";
import { usePrefs } from "@/lib/i18n/preferences";
import { CURRENT_ADMIN_ID, DEPARTMENTS, ROLES } from "@/lib/mock-data";
import { useGateway } from "@/lib/store/gateway-store";
import type { AbacDecision, AbacPolicy, OperationType, Sensitivity, TrustTier } from "@/lib/types";

const EFFECTS: AbacDecision[] = ["ALLOW", "DENY", "HITL_REQUIRED"];
const TIERS: TrustTier[] = ["HIGH", "MEDIUM", "LOW"];
const SENS: Sensitivity[] = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"];
const OPS: OperationType[] = ["READ", "WRITE", "DELETE", "EXEC"];

const effectAccent: Record<AbacDecision, string> = { ALLOW: "border-s-success", DENY: "border-s-danger", HITL_REQUIRED: "border-s-warning" };

function Conditions({ label, values }: { label: string; values: string[] }) {
  const { t } = usePrefs();
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] text-muted">{label}</div>
      <div className="flex flex-wrap gap-1">
        {values.length === 0 ? (
          <span className="text-xs text-muted/70 italic">{t.policies.anyValue}</span>
        ) : (
          values.map((v) => (
            <bdi key={v} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px]">
              {v}
            </bdi>
          ))
        )}
      </div>
    </div>
  );
}

function emptyPolicy(id: string): AbacPolicy {
  const now = Date.now();
  return {
    policy_id: id,
    policy_name: "",
    description: "",
    subject_rule: { roles: [], departments: [], trust_tiers: [] },
    resource_rule: { tools: [], sensitivity: [] },
    action_rule: { operations: [] },
    effect: "DENY",
    priority: 100,
    is_active: true,
    evaluations: 0,
    created_by: CURRENT_ADMIN_ID,
    created_at: now,
    updated_at: now,
  };
}

function PolicyEditor({ initial, isNew, onClose }: { initial: AbacPolicy; isNew: boolean; onClose: () => void }) {
  const { t } = usePrefs();
  const { state, savePolicy } = useGateway();
  const [p, setP] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = p.policy_name.trim();
    if (!name) return setError(t.policies.nameRequired);
    if (state.policies.some((x) => x.policy_name === name && x.policy_id !== p.policy_id)) return setError(t.policies.nameTaken);
    savePolicy({ ...p, policy_name: name }, isNew);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? t.policies.createTitle : t.policies.editTitle}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" type="submit" form="policy-form">
            {t.common.save}
          </Button>
        </>
      }
    >
      <form id="policy-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label={t.policies.name} error={error ?? undefined} htmlFor="pname">
            <Input
              id="pname"
              dir="ltr"
              className="font-mono"
              value={p.policy_name}
              onChange={(e) => {
                setError(null);
                setP({ ...p, policy_name: e.target.value.replace(/\s+/g, "_") });
              }}
              placeholder="deny_external_post"
            />
          </Field>
          <Field label={t.policies.priority} hint={t.policies.priorityHint} htmlFor="pprio">
            <Input id="pprio" type="number" min={1} max={1000} dir="ltr" value={p.priority} onChange={(e) => setP({ ...p, priority: Number(e.target.value) || 1 })} />
          </Field>
        </div>
        <Field label={t.policies.description} htmlFor="pdesc">
          <Textarea id="pdesc" rows={2} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-medium">{t.policies.effect}</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.policies.effect}>
            {EFFECTS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={p.effect === e}
                onClick={() => setP({ ...p, effect: e })}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition",
                  p.effect === e
                    ? { ALLOW: "border-success bg-success-soft text-success", DENY: "border-danger bg-danger-soft text-danger", HITL_REQUIRED: "border-warning bg-warning-soft text-warning" }[e]
                    : "border-border text-muted hover:text-fg",
                )}
              >
                {t.decision[e]}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-xs font-semibold text-primary">{t.policies.subject}</legend>
          <ChipGroup label={t.policies.roles} options={ROLES.map((r) => ({ value: r, label: r }))} value={p.subject_rule.roles} onChange={(roles) => setP({ ...p, subject_rule: { ...p.subject_rule, roles } })} />
          <ChipGroup label={t.policies.departments} options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} value={p.subject_rule.departments} onChange={(departments) => setP({ ...p, subject_rule: { ...p.subject_rule, departments } })} />
          <ChipGroup label={t.policies.tiers} options={TIERS.map((x) => ({ value: x, label: t.tier[x] }))} value={p.subject_rule.trust_tiers} onChange={(trust_tiers) => setP({ ...p, subject_rule: { ...p.subject_rule, trust_tiers } })} />
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-xs font-semibold text-primary">{t.policies.resource}</legend>
          <ChipGroup label={t.policies.tools} options={state.tools.map((x) => ({ value: x.tool_name, label: x.tool_name }))} value={p.resource_rule.tools} onChange={(tools) => setP({ ...p, resource_rule: { ...p.resource_rule, tools } })} />
          <ChipGroup label={t.policies.sensitivity} options={SENS.map((x) => ({ value: x, label: t.sensitivity[x] }))} value={p.resource_rule.sensitivity} onChange={(sensitivity) => setP({ ...p, resource_rule: { ...p.resource_rule, sensitivity } })} />
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-xs font-semibold text-primary">{t.policies.action}</legend>
          <ChipGroup label={t.policies.operations} options={OPS.map((x) => ({ value: x, label: t.op[x] }))} value={p.action_rule.operations} onChange={(operations) => setP({ ...p, action_rule: { operations } })} />
        </fieldset>

        <label className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/50 px-4 py-3 text-sm">
          {p.is_active ? t.common.active : t.common.inactive}
          <Switch checked={p.is_active} onChange={(is_active) => setP({ ...p, is_active })} label={t.common.active} />
        </label>
      </form>
    </Modal>
  );
}

function Simulator() {
  const { t } = usePrefs();
  const { state } = useGateway();
  const [agentId, setAgentId] = useState(state.agents[0]?.agent_id ?? "");
  const [userId, setUserId] = useState(state.users.find((u) => !u.is_admin)?.user_id ?? "");
  const [toolName, setToolName] = useState(state.tools[0]?.tool_name ?? "");

  const agent = state.agents.find((a) => a.agent_id === agentId);
  const user = state.users.find((u) => u.user_id === userId);
  const tool = state.tools.find((x) => x.tool_name === toolName);
  const resource = tool ? state.resources.find((r) => r.resource_id === tool.resource_id) ?? null : null;
  const result = agent && user && tool ? evaluateAbac({ agent, user, tool, resource }, state.policies) : null;

  return (
    <Card className="h-fit">
      <CardHeader title={t.policies.simulator} subtitle={t.policies.simulatorSub} action={<FlaskConical className="h-4 w-4 text-muted" />} />
      <div className="space-y-3 px-5 pb-5">
        <Field label={t.agents.name} htmlFor="sa">
          <Select id="sa" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {state.agents.map((a) => (
              <option key={a.agent_id} value={a.agent_id}>
                {a.agent_name} · {t.tier[a.trust_tier]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.approvals.user} htmlFor="su">
          <Select id="su" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {state.users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.username} · {u.role}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.approvals.tool} htmlFor="st">
          <Select id="st" value={toolName} onChange={(e) => setToolName(e.target.value)} dir="ltr">
            {state.tools.map((x) => (
              <option key={x.tool_name} value={x.tool_name}>
                {x.tool_name} · {x.operation_type}
              </option>
            ))}
          </Select>
        </Field>

        {result && (
          <div className="animate-in rounded-lg border border-border bg-surface-2/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <DecisionBadge decision={result.decision} />
              <span className="text-[11px] text-muted">{t.policies.decidedBy}</span>
            </div>
            <div className="mt-2 text-sm">
              {result.policy ? <bdi className="font-mono text-xs">{`${result.policy.policy_id} · ${result.policy.policy_name}`}</bdi> : <span className="text-xs">{t.stageNote[result.rule ?? "DEFAULT"]}</span>}
            </div>
            {result.evaluated.length > 0 && (
              <ol className="mt-3 space-y-1 border-t border-border pt-3">
                {result.evaluated.map(({ policy, matched }) => (
                  <li key={policy.policy_id} className={cn("flex items-center gap-2 text-[11px]", matched ? "text-fg" : "text-muted")}>
                    {matched ? <Check className="h-3 w-3 text-success" /> : <X className="h-3 w-3" />}
                    <span className="font-mono">{policy.priority}</span>
                    <bdi className="truncate font-mono">{policy.policy_name}</bdi>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        <div>
          <div className="mb-1 text-xs font-medium">{t.policies.order}</div>
          <p className="text-[11px] leading-relaxed text-muted">{t.policies.orderNote}</p>
        </div>
      </div>
    </Card>
  );
}

function PoliciesView() {
  const { t, fmt } = usePrefs();
  const { state, togglePolicy, deletePolicy, newId } = useGateway();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [effect, setEffect] = useState<AbacDecision | "">("");
  const [editing, setEditing] = useState<{ policy: AbacPolicy; isNew: boolean } | null>(() =>
    params.get("new") ? { policy: emptyPolicy(`POL-${String(Date.now()).slice(-3)}`), isNew: true } : null,
  );
  const [deleting, setDeleting] = useState<AbacPolicy | null>(null);

  const policies = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...state.policies]
      .filter((p) => (!effect || p.effect === effect) && (!needle || p.policy_name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle)))
      .sort((a, b) => a.priority - b.priority);
  }, [state.policies, q, effect]);

  const active = state.policies.filter((p) => p.is_active).length;

  return (
    <>
      <PageHeader
        title={t.policies.title}
        subtitle={t.policies.subtitle}
        actions={
          <Button variant="primary" onClick={() => setEditing({ policy: emptyPolicy(`POL-${newId().slice(0, 4).toUpperCase()}`), isNew: true })}>
            <Plus className="h-4 w-4" />
            {t.policies.new}
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-60 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.policies.searchPlaceholder} className="ps-9" aria-label={t.common.search} />
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
              {(["", ...EFFECTS] as const).map((e) => (
                <button key={e || "all"} type="button" onClick={() => setEffect(e)} aria-pressed={effect === e} className={cn("rounded-md px-3 py-1.5 text-xs transition", effect === e ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}>
                  {e ? t.decision[e] : t.common.all}
                </button>
              ))}
            </div>
            <span className="ms-auto text-xs text-muted">{t.policies.summary(active, state.policies.length)}</span>
          </div>

          {policies.length === 0 ? (
            <Card>
              <EmptyState title={state.policies.length ? t.common.noResults : t.policies.emptyTitle} />
            </Card>
          ) : (
            <div className="space-y-3">
              {policies.map((p) => (
                <Card key={p.policy_id} className={cn("border-s-4 p-4 transition", effectAccent[p.effect], !p.is_active && "opacity-60")}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="grid h-8 min-w-8 place-items-center rounded-md bg-surface-2 px-1.5 font-mono text-xs text-muted" title={t.policies.priority}>
                      {p.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-muted">{p.policy_id}</span>
                        <bdi className="font-mono text-sm font-semibold">{p.policy_name}</bdi>
                        <DecisionBadge decision={p.effect} />
                      </div>
                      {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={p.is_active} onChange={() => togglePolicy(p.policy_id)} label={p.policy_name} />
                      <Button variant="ghost" size="icon" onClick={() => setEditing({ policy: p, isNew: false })} aria-label={`${t.common.edit} ${p.policy_name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(p)} aria-label={`${t.common.delete} ${p.policy_name}`} className="hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 border-t border-border pt-3 sm:grid-cols-3 2xl:grid-cols-6">
                    <Conditions label={t.policies.roles} values={p.subject_rule.roles} />
                    <Conditions label={t.policies.departments} values={p.subject_rule.departments} />
                    <Conditions label={t.policies.tiers} values={p.subject_rule.trust_tiers.map((x) => t.tier[x])} />
                    <Conditions label={t.policies.tools} values={p.resource_rule.tools} />
                    <Conditions label={t.policies.sensitivity} values={p.resource_rule.sensitivity.map((x) => t.sensitivity[x])} />
                    <Conditions label={t.policies.operations} values={p.action_rule.operations.map((x) => t.op[x])} />
                  </div>
                  <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-muted">
                    <span>{t.policies.evaluations(fmt.num(p.evaluations))}</span>
                    <span>
                      {t.policies.updated}: {fmt.dateTime(p.updated_at)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        <Simulator />
      </div>

      {editing && <PolicyEditor key={editing.policy.policy_id} initial={editing.policy} isNew={editing.isNew} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deletePolicy(deleting.policy_id)}
        title={t.policies.deleteTitle}
        body={deleting ? t.policies.deleteBody(deleting.policy_name) : ""}
        confirmLabel={t.common.delete}
      />
    </>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense>
      <PoliciesView />
    </Suspense>
  );
}
