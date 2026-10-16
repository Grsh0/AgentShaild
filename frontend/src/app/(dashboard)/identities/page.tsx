"use client";

import { Bot, Info, KeyRound, Pencil, Plus, ServerCog, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { Badge, DecisionBadge, FrameworkBadge, SensitivityBadge, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Mono } from "@/components/ui/data";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";
import { DEPARTMENTS, ROLES } from "@/lib/mock-data";
import { useGateway, useLookup } from "@/lib/store/gateway-store";
import type { Sensitivity, User } from "@/lib/types";

const CLEARANCES: Sensitivity[] = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"];

function UserEditor({ initial, isNew, onClose }: { initial: User; isNew: boolean; onClose: () => void }) {
  const { t } = usePrefs();
  const { saveUser } = useGateway();
  const [u, setU] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!u.full_name.trim() || !u.username.trim()) return setError(t.identities.required);
    saveUser({ ...u, full_name: u.full_name.trim(), username: u.username.trim() }, isNew);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? t.identities.createTitle : t.identities.editTitle}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" type="submit" form="user-form">
            {t.common.save}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.identities.fullName} htmlFor="ufn" error={error ?? undefined}>
            <Input id="ufn" value={u.full_name} onChange={(e) => setU({ ...u, full_name: e.target.value })} />
          </Field>
          <Field label={t.identities.username} htmlFor="uun">
            <Input id="uun" dir="ltr" className="font-mono" value={u.username} onChange={(e) => setU({ ...u, username: e.target.value.replace(/\s+/g, "") })} />
          </Field>
        </div>
        <Field label={t.identities.email} htmlFor="uem">
          <Input id="uem" type="email" dir="ltr" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.identities.role} htmlFor="uro">
            <Select id="uro" dir="ltr" value={u.role} onChange={(e) => setU({ ...u, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label={t.identities.department} htmlFor="ude">
            <Select id="ude" dir="ltr" value={u.department} onChange={(e) => setU({ ...u, department: e.target.value })}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label={t.identities.clearance} htmlFor="ucl">
            <Select id="ucl" value={u.clearance} onChange={(e) => setU({ ...u, clearance: e.target.value as Sensitivity })}>
              {CLEARANCES.map((c) => (
                <option key={c} value={c}>
                  {t.sensitivity[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.identities.kind} htmlFor="uki">
            <Select id="uki" value={u.kind} onChange={(e) => setU({ ...u, kind: e.target.value as User["kind"] })}>
              <option value="HUMAN">{t.identities.human}</option>
              <option value="SERVICE">{t.identities.service}</option>
            </Select>
          </Field>
        </div>
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/50 px-4 py-2.5 text-sm">
            {t.identities.mfa}
            <Switch checked={u.mfa_enabled} onChange={(mfa_enabled) => setU({ ...u, mfa_enabled })} label={t.identities.mfa} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/50 px-4 py-2.5 text-sm">
            {t.identities.isAdmin}
            <Switch checked={u.is_admin} onChange={(is_admin) => setU({ ...u, is_admin })} label={t.identities.isAdmin} />
          </label>
        </div>
      </form>
    </Modal>
  );
}

export default function IdentitiesPage() {
  const { t, fmt } = usePrefs();
  const { state, setUserActive, newId } = useGateway();
  const { userById } = useLookup();
  const [tab, setTab] = useState<"users" | "roles" | "agents">("users");
  const [editing, setEditing] = useState<{ user: User; isNew: boolean } | null>(null);

  const humans = state.users.filter((u) => u.kind === "HUMAN").length;
  const services = state.users.length - humans;
  const admins = state.users.filter((u) => u.is_admin).length;

  const newUser = (): User => ({
    user_id: `u-${newId().slice(0, 6)}`,
    username: "",
    full_name: "",
    email: "",
    role: "Customer_Support",
    department: "Support",
    clearance: "INTERNAL",
    kind: "HUMAN",
    mfa_enabled: true,
    is_admin: false,
    is_active: true,
    created_at: Date.now(),
    last_login_at: null,
  });

  const kpis = [
    { label: t.identities.humans, value: humans, icon: Users },
    { label: t.identities.services, value: services, icon: ServerCog },
    { label: t.identities.agents, value: state.agents.length, icon: Bot },
    { label: t.identities.admins, value: admins, icon: ShieldCheck },
  ];

  return (
    <>
      <PageHeader
        title={t.identities.title}
        subtitle={t.identities.subtitle}
        actions={
          <Button variant="primary" onClick={() => setEditing({ user: newUser(), isNew: true })}>
            <Plus className="h-4 w-4" />
            {t.identities.addUser}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
              <k.icon className="h-5 w-5" />
            </span>
            <div>
              <div className="font-mono text-2xl font-semibold tabular-nums">{k.value}</div>
              <div className="text-xs text-muted">{k.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-4 flex items-start gap-3 border-primary/30 bg-primary-soft/40 p-4">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <div className="text-sm font-semibold">{t.identities.dualContext}</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.identities.dualContextBody}</p>
        </div>
      </Card>

      <div role="tablist" className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {(["users", "roles", "agents"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-md px-4 py-1.5 text-sm transition", tab === k ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}>
            {k === "users" ? t.identities.users : k === "roles" ? t.identities.roles : t.identities.agentIds}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-[11px] text-muted">
                  {[t.identities.identity, t.identities.role, t.identities.department, t.identities.clearance, t.identities.kind, t.identities.mfa, t.identities.session, t.identities.state, ""].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.users.map((u) => (
                  <tr key={u.user_id} className={cn(!u.is_active && "opacity-60")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-primary">{u.username.slice(0, 2).toUpperCase()}</span>
                        <div className="min-w-0 leading-tight">
                          <div className="truncate text-sm">
                            {u.full_name} {u.is_admin && <ShieldCheck className="inline h-3.5 w-3.5 text-primary" />}
                          </div>
                          <bdi className="font-mono text-[11px] text-muted">{u.username}</bdi>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <bdi>{u.role}</bdi>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <bdi>{u.department}</bdi>
                    </td>
                    <td className="px-4 py-3">
                      <SensitivityBadge level={u.clearance} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.kind === "HUMAN" ? "neutral" : "info"}>{u.kind === "HUMAN" ? t.identities.human : t.identities.service}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.mfa_enabled ? "success" : "warning"}>{u.mfa_enabled ? t.common.enabled : t.common.disabled}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{u.last_login_at ? fmt.relative(u.last_login_at, state.now) : "—"}</td>
                    <td className="px-4 py-3">
                      <Switch checked={u.is_active} onChange={(v) => setUserActive(u.user_id, v)} label={u.username} disabled={u.user_id === "u-admin"} />
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" onClick={() => setEditing({ user: u, isNew: false })} aria-label={`${t.common.edit} ${u.username}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "roles" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ROLES.map((role) => {
            const members = state.users.filter((u) => u.role === role);
            const policies = state.policies.filter((p) => p.subject_rule.roles.includes(role));
            return (
              <Card key={role} className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <bdi className="font-mono text-sm font-semibold">{role}</bdi>
                  <Badge>{t.identities.members(members.length)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {members.map((m) => (
                    <span key={m.user_id} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px]">
                      {m.full_name}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-[11px] text-muted">{t.identities.policiesFor}</div>
                <ul className="mt-1.5 space-y-1.5">
                  {policies.length === 0 && <li className="text-xs text-muted italic">{t.common.none}</li>}
                  {policies.map((p) => (
                    <li key={p.policy_id} className="flex items-center justify-between gap-2 text-xs">
                      <bdi className="truncate font-mono">{p.policy_name}</bdi>
                      <DecisionBadge decision={p.effect} />
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "agents" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-[11px] text-muted">
                  {[t.agents.name, t.agents.framework, t.agents.tier, t.agents.owner, t.agents.certificate, t.agents.certExpires, t.identities.state].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.agents.map((a) => (
                  <tr key={a.agent_id}>
                    <td className="px-4 py-3">
                      <bdi className="font-mono text-xs">{a.agent_name}</bdi>
                      <div className="text-[11px] text-muted">
                        <bdi>{a.model}</bdi>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <FrameworkBadge framework={a.framework} />
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={a.trust_tier} />
                    </td>
                    <td className="px-4 py-3 text-xs">{userById(a.owner_user_id)?.full_name}</td>
                    <td className="px-4 py-3">
                      <Mono value={a.certificate_fingerprint} chars={11} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{fmt.date(a.certificate_expires_at)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={a.is_active ? "success" : "danger"} dot>
                        {a.is_active ? t.common.active : t.agents.deactivate}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {t.identities.note}
      </p>

      {editing && <UserEditor key={editing.user.user_id} initial={editing.user} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </>
  );
}
