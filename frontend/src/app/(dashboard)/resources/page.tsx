"use client";

import { AlertTriangle, Database, FileText, Globe, Info, Mail, Power, PowerOff, Terminal, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, OpBadge, SensitivityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { isStopped } from "@/lib/analytics";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway } from "@/lib/store/gateway-store";
import type { ResourceKind, Tool } from "@/lib/types";

const KIND_ICON: Record<ResourceKind, React.ComponentType<{ className?: string }>> = { DATABASE: Database, FILES: FileText, EMAIL: Mail, HTTP: Globe, SHELL: Terminal };

export default function ResourcesPage() {
  const { t, fmt } = usePrefs();
  const { state, setToolEnabled } = useGateway();
  const [tab, setTab] = useState<"tools" | "resources">("tools");
  const [disabling, setDisabling] = useState<Tool | null>(null);

  const stats = useMemo(() => {
    const since = state.now - 86_400_000;
    const today = state.requests.filter((r) => r.received_at >= since);
    const byTool = new Map<string, { calls: number; blocked: number }>();
    const byRes = new Map<string, number>();
    for (const r of today) {
      const s = byTool.get(r.tool_name) ?? { calls: 0, blocked: 0 };
      s.calls++;
      if (isStopped(r)) s.blocked++;
      byTool.set(r.tool_name, s);
      if (r.resource_id) byRes.set(r.resource_id, (byRes.get(r.resource_id) ?? 0) + 1);
    }
    return { byTool, byRes };
  }, [state.requests, state.now]);

  const resourceName = (id: string) => state.resources.find((r) => r.resource_id === id);

  return (
    <>
      <PageHeader title={t.resources.title} subtitle={t.resources.subtitle} />

      <div role="tablist" className="mb-4 inline-flex gap-1 rounded-lg border border-border bg-surface p-1">
        {(["tools", "resources"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-md px-4 py-1.5 text-sm transition", tab === k ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}>
            {k === "tools" ? t.resources.toolsTab : t.resources.resourcesTab}
            <span className="ms-1.5 font-mono text-xs text-muted">{k === "tools" ? state.tools.length : state.resources.length}</span>
          </button>
        ))}
      </div>

      {tab === "tools" ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {state.tools.map((tool) => {
            const s = stats.byTool.get(tool.tool_name) ?? { calls: 0, blocked: 0 };
            const res = resourceName(tool.resource_id);
            const Icon = res ? KIND_ICON[res.kind] : Wrench;
            return (
              <Card key={tool.tool_name} className={cn("flex flex-col p-5", !tool.enabled && "border-danger/40 bg-danger-soft/40")}>
                <div className="flex items-start gap-3">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", tool.enabled ? "bg-surface-2 text-fg" : "bg-danger-soft text-danger")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <bdi className="block truncate font-mono text-sm font-semibold">{tool.tool_name}</bdi>
                    <p className="mt-0.5 text-xs text-muted">{tool.description}</p>
                  </div>
                  <Badge tone={tool.enabled ? "success" : "danger"} dot>
                    {tool.enabled ? t.common.enabled : t.common.disabled}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <OpBadge op={tool.operation_type} />
                  {res && (
                    <Badge>
                      <bdi className="font-mono">{res.resource_id}</bdi>
                    </Badge>
                  )}
                  {res && <SensitivityBadge level={res.sensitivity} />}
                  {tool.destructive && (
                    <span title={t.resources.destructiveHint}>
                      <Badge tone="danger">
                        <AlertTriangle className="h-3 w-3" />
                        {t.resources.destructive}
                      </Badge>
                    </span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-surface-2/50 p-3">
                  <div>
                    <dt className="text-[10px] text-muted">{t.resources.calls}</dt>
                    <dd className="font-mono text-base font-semibold tabular-nums">{fmt.num(s.calls)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-muted">{t.resources.blocked}</dt>
                    <dd className="font-mono text-base font-semibold tabular-nums">{fmt.num(s.blocked)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-muted">{t.resources.blockRate}</dt>
                    <dd className={cn("font-mono text-base font-semibold tabular-nums", s.calls && s.blocked / s.calls > 0.25 ? "text-danger" : "")}>{fmt.pct(s.calls ? s.blocked / s.calls : 0)}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-4">
                  {tool.enabled ? (
                    <Button variant="outline-danger" className="w-full justify-center" onClick={() => setDisabling(tool)}>
                      <PowerOff className="h-4 w-4" />
                      {t.resources.disable}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-center text-[11px] text-danger">
                        {t.resources.disabledSince} {tool.disabled_at ? fmt.relative(tool.disabled_at, state.now) : ""}
                      </p>
                      <Button variant="primary" className="w-full justify-center" onClick={() => setToolEnabled(tool.tool_name, true)}>
                        <Power className="h-4 w-4" />
                        {t.resources.enable}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-[11px] text-muted">
                  {[t.approvals.resource, t.resources.kind, t.resources.endpoint, t.resources.sensitivity, t.resources.boundary, t.resources.toolsOn, t.resources.calls].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.resources.map((r) => {
                  const Icon = KIND_ICON[r.kind];
                  return (
                    <tr key={r.resource_id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 text-muted" />
                          <div className="leading-tight">
                            <bdi className="block font-mono text-xs">{r.resource_id}</bdi>
                            <span className="text-[11px] text-muted">{r.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{t.resourceKind[r.kind]}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted">
                        <bdi>{r.endpoint}</bdi>
                      </td>
                      <td className="px-4 py-3">
                        <SensitivityBadge level={r.sensitivity} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={r.internal ? "neutral" : "warning"}>{r.internal ? t.common.internal : t.common.external}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {state.tools
                            .filter((x) => x.resource_id === r.resource_id)
                            .map((x) => (
                              <bdi key={x.tool_name} className={cn("rounded px-1.5 py-0.5 font-mono text-[10px]", x.enabled ? "bg-surface-2" : "bg-danger-soft text-danger line-through")}>
                                {x.tool_name}
                              </bdi>
                            ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums">{fmt.num(stats.byRes.get(r.resource_id) ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {t.resources.note}
      </p>

      <ConfirmDialog
        open={!!disabling}
        onClose={() => setDisabling(null)}
        onConfirm={() => disabling && setToolEnabled(disabling.tool_name, false)}
        title={t.resources.disableTitle}
        body={disabling ? t.resources.disableBody(disabling.tool_name) : ""}
        confirmLabel={t.resources.disable}
      />
    </>
  );
}
