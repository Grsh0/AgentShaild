"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";

/** عرض JSON مع إبراز رموز الإخفاء مثل [REDACTED_EMAIL] */
export function JsonView({ value, className }: { value: unknown; className?: string }) {
  const text = JSON.stringify(value, null, 2);
  const parts = text.split(/(\[REDACTED_[A-Z_]+\])/g);
  return (
    <pre
      dir="ltr"
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-bg/60 p-3 text-start font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg/90",
        className,
      )}
    >
      {parts.map((p, i) =>
        /^\[REDACTED_/.test(p) ? (
          <mark key={i} className="rounded bg-warning-soft px-1 text-warning">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </pre>
  );
}

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const { t } = usePrefs();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? t.common.copied : t.common.copy}
      title={done ? t.common.copied : t.common.copy}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className={cn("rounded p-1 text-muted transition hover:bg-surface-2 hover:text-fg", className)}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** معرّف أو بصمة مختصرة مع زر نسخ */
export function Mono({ value, chars = 8, copy = true, className }: { value: string; chars?: number; copy?: boolean; className?: string }) {
  const short = value.length > chars * 2 + 1 ? `${value.slice(0, chars)}…${value.slice(-4)}` : value;
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-xs text-muted", className)} dir="ltr" title={value}>
      {short}
      {copy && <CopyButton value={value} />}
    </span>
  );
}

export function DescList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] text-muted">{it.label}</dt>
          <dd className="mt-0.5 truncate text-sm">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** شريط درجة مع علامة الحد */
export function ScoreMeter({ label, value, threshold, hint }: { label: string; value: number; threshold?: number; hint?: string }) {
  const danger = threshold !== undefined && value >= threshold;
  const warn = threshold !== undefined && !danger && value >= threshold * 0.6;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <span className={cn("font-mono text-lg font-semibold tabular-nums", danger ? "text-danger" : warn ? "text-warning" : "text-success")} dir="ltr">
          {value.toFixed(2)}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-2" dir="ltr">
        <div
          className={cn("h-full rounded-full", danger ? "bg-danger" : warn ? "bg-warning" : "bg-success")}
          style={{ width: `${Math.min(100, value * 100)}%` }}
        />
        {threshold !== undefined && (
          <div className="absolute -top-1 h-4 w-0.5 rounded bg-fg/70" style={{ left: `${threshold * 100}%` }} aria-hidden />
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
