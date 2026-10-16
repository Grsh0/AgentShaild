"use client";

import { Check, OctagonX } from "lucide-react";
import { useState } from "react";
import { KillSwitchDialogs } from "@/components/layout/kill-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Input, Switch } from "@/components/ui/form";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway, useLookup } from "@/lib/store/gateway-store";
import type { GatewaySettings, RiskWeights } from "@/lib/types";

type Draft = Pick<GatewaySettings, "hitl_timeout_seconds" | "risk_threshold" | "similarity_threshold" | "entropy_threshold" | "latency_alert_ms" | "error_rate_alert_pct" | "risk_weights" | "modules">;
const KEYS: (keyof Draft)[] = ["hitl_timeout_seconds", "risk_threshold", "similarity_threshold", "entropy_threshold", "latency_alert_ms", "error_rate_alert_pct", "risk_weights", "modules"];
const WEIGHT_KEYS: (keyof RiskWeights)[] = ["injection", "operation", "abac", "dlp", "trust"];

function pickDraft(s: GatewaySettings): Draft {
  return Object.fromEntries(KEYS.map((k) => [k, s[k]])) as Draft;
}

function SliderRow({ id, label, hint, value, onChange, min, max, step, unit, digits = 0 }: { id: string; label: string; hint?: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit?: string; digits?: number }) {
  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_320px] md:items-center">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-3" dir="ltr">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer accent-[var(--primary)]" aria-label={label} />
        <div className="relative w-28">
          <Input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={Number(value.toFixed(digits))}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
            }}
            className="pe-10 font-mono tabular-nums"
          />
          {unit && <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t, fmt } = usePrefs();
  const { state, updateSettings } = useGateway();
  const { userById } = useLookup();
  const [draft, setDraft] = useState<Draft>(() => pickDraft(state.settings));
  const [saved, setSaved] = useState(false);
  const [killMode, setKillMode] = useState<"activate" | "deactivate" | null>(null);

  const current = pickDraft(state.settings);
  const changed = KEYS.filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(current[k]));
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [k]: v }));
  };
  const setWeight = (k: keyof RiskWeights) => (v: number) => set("risk_weights")({ ...draft.risk_weights, [k]: v });
  const setModule = (k: keyof GatewaySettings["modules"]) => (v: boolean) => set("modules")({ ...draft.modules, [k]: v });

  const save = () => {
    const wSum = WEIGHT_KEYS.reduce((s, k) => s + draft.risk_weights[k], 0) || 1;
    const normalized = Object.fromEntries(WEIGHT_KEYS.map((k) => [k, Math.round((draft.risk_weights[k] / wSum) * 100) / 100])) as unknown as RiskWeights;
    const next = { ...draft, risk_weights: normalized };
    updateSettings(Object.fromEntries(changed.map((k) => [k, next[k]])) as Partial<GatewaySettings>);
    setDraft(next);
    setSaved(true);
  };

  const s = state.settings;
  const wSum = WEIGHT_KEYS.reduce((acc, k) => acc + draft.risk_weights[k], 0) || 1;
  const modules: { k: keyof GatewaySettings["modules"]; label: string }[] = [
    { k: "injection_signatures", label: t.engines.signatures },
    { k: "injection_semantic", label: t.engines.semantic },
    { k: "dlp_secrets", label: t.engines.secrets },
    { k: "dlp_entropy", label: t.engines.entropy },
    { k: "dlp_pii", label: t.engines.pii },
    { k: "outbound_dlp", label: t.engines.outbound },
  ];

  return (
    <>
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title={t.settings.hitlSection} />
            <div className="divide-y divide-border border-t border-border">
              <SliderRow id="hitl" label={t.settings.hitlTimeout} hint={t.settings.hitlTimeoutHint} value={draft.hitl_timeout_seconds} onChange={set("hitl_timeout_seconds")} min={30} max={1800} step={30} unit="s" />
            </div>
          </Card>

          <Card>
            <CardHeader title={t.settings.riskSection} />
            <div className="divide-y divide-border border-t border-border">
              <SliderRow id="risk" label={t.settings.riskThreshold} hint={t.settings.riskThresholdHint} value={draft.risk_threshold} onChange={set("risk_threshold")} min={0.1} max={1} step={0.01} digits={2} />
              <div className="px-5 pt-4 pb-1">
                <div className="text-sm font-medium">{t.settings.weights}</div>
                <p className="mt-0.5 text-xs text-muted">{t.settings.weightsHint}</p>
              </div>
              {WEIGHT_KEYS.map((k) => (
                <SliderRow key={k} id={`w-${k}`} label={`${t.risk[k]} · ${(draft.risk_weights[k] / wSum).toFixed(2)}`} value={draft.risk_weights[k]} onChange={setWeight(k)} min={0} max={1} step={0.05} digits={2} />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title={t.settings.detectionSection} />
            <div className="divide-y divide-border border-t border-border">
              <SliderRow id="sim" label={t.settings.similarity} hint={t.settings.similarityHint} value={draft.similarity_threshold} onChange={set("similarity_threshold")} min={0.5} max={0.99} step={0.01} digits={2} />
              <SliderRow id="ent" label={t.settings.entropy} hint={t.settings.entropyHint} value={draft.entropy_threshold} onChange={set("entropy_threshold")} min={3} max={6} step={0.1} digits={1} unit="bits" />
              <div className="px-5 py-4">
                <div className="mb-3 text-sm font-medium">{t.settings.modules}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {modules.map((m) => (
                    <label key={m.k} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs">
                      {m.label}
                      <Switch checked={draft.modules[m.k]} onChange={setModule(m.k)} label={m.label} />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={t.settings.alertsSection} />
            <div className="divide-y divide-border border-t border-border">
              <SliderRow id="lat" label={t.settings.latencyAlert} hint={t.settings.latencyAlertHint} value={draft.latency_alert_ms} onChange={set("latency_alert_ms")} min={50} max={500} step={10} unit="ms" />
              <SliderRow id="err" label={t.settings.errorAlert} hint={t.settings.errorAlertHint} value={draft.error_rate_alert_pct} onChange={set("error_rate_alert_pct")} min={1} max={50} step={1} unit="%" />
            </div>
          </Card>

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 px-5 py-3 shadow-lg backdrop-blur">
            <span className="text-xs text-muted">
              {changed.length > 0 ? (
                <span className="text-warning">{t.settings.unsaved}</span>
              ) : saved ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <Check className="h-3.5 w-3.5" />
                  {t.common.saved}
                </span>
              ) : (
                t.settings.lastModified(userById(s.last_modified_by)?.full_name ?? "—", fmt.dateTime(s.last_modified_at))
              )}
            </span>
            <div className="flex gap-2">
              <Button disabled={!changed.length} onClick={() => setDraft(current)}>
                {t.common.reset}
              </Button>
              <Button variant="primary" disabled={!changed.length} onClick={save}>
                {t.common.save}
              </Button>
            </div>
          </div>
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold">{t.settings.killSection}</h2>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-2/50 px-4 py-3">
            <span className="text-xs text-muted">{t.settings.killState}</span>
            <Badge tone={s.kill_switch_active ? "danger" : "success"} dot>
              {s.kill_switch_active ? t.common.active : t.common.inactive}
            </Badge>
          </div>
          <p className="mt-3 text-xs text-muted">{t.kill.activateBody}</p>
          <Button className="mt-4 w-full justify-center" variant={s.kill_switch_active ? "secondary" : "danger"} onClick={() => setKillMode(s.kill_switch_active ? "deactivate" : "activate")}>
            <OctagonX className="h-4 w-4" />
            {s.kill_switch_active ? t.kill.deactivate : t.kill.button}
          </Button>
          <p className="mt-3 text-[11px] text-muted">{t.settings.killHint}</p>
        </Card>
      </div>

      <KillSwitchDialogs mode={killMode} onClose={() => setKillMode(null)} />
    </>
  );
}
