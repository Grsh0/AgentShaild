"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

interface Series {
  values: number[];
  color: string;
  label: string;
  fill?: boolean;
  dashed?: boolean;
}

const W = 600;

function path(values: number[], max: number, h: number) {
  const step = values.length > 1 ? W / (values.length - 1) : W;
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
}

/** رسم خطي/مساحي بسيط. الزمن يتقدم دائماً من اليسار لليمين حتى في الواجهة العربية */
export function LineChart({
  series,
  height = 180,
  max: maxProp,
  reference,
  unit,
}: {
  series: Series[];
  height?: number;
  max?: number;
  reference?: { value: number; label: string };
  unit?: string;
}) {
  const id = useId();
  const all = series.flatMap((s) => s.values);
  const max = maxProp ?? Math.max(1, ...all, reference?.value ?? 0) * 1.15;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <div dir="ltr" className="relative">
      <div className="absolute inset-y-0 left-0 flex w-9 flex-col justify-between pb-0 text-[10px] text-muted tabular-nums">
        {[...ticks].reverse().map((t) => (
          <span key={t} className="-translate-y-1/2 first:translate-y-0 last:-translate-y-full">
            {t}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="ms-9 block w-[calc(100%-2.25rem)]" style={{ height }} role="img" aria-label={series.map((s) => s.label).join(", ")}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`${id}-g${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={height * f} y2={height * f} stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {reference && (
          <line
            x1="0"
            x2={W}
            y1={height - (reference.value / max) * height}
            y2={height - (reference.value / max) * height}
            stroke="var(--danger)"
            strokeDasharray="4 4"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {series.map((s, i) => {
          const d = path(s.values, max, height);
          return (
            <g key={i}>
              {s.fill && <path d={`${d} L${W},${height} L0,${height} Z`} fill={`url(#${id}-g${i})`} />}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dashed ? "5 4" : undefined}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>
      {reference && (
        <span
          className="absolute right-1 rounded bg-danger-soft px-1.5 text-[10px] text-danger"
          style={{ top: `calc(${(1 - reference.value / max) * 100}% - 18px)` }}
        >
          {reference.label}
        </span>
      )}
      {unit && <span className="sr-only">{unit}</span>}
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded"
            style={{ background: it.dashed ? `repeating-linear-gradient(90deg, ${it.color} 0 4px, transparent 4px 7px)` : it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** أشرطة أفقية لمقارنة القيم */
export function BarList({ items, format }: { items: { label: string; value: number; color: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-fg">{it.label}</span>
            <span className="font-mono text-muted tabular-nums">{format(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(it.value / max) * 100}%`, background: it.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** شريط مقسّم يوضح نسب القرارات */
export function SplitBar({ items, format }: { items: { label: string; value: number; color: string }[]; format: (n: number) => string }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {items.map((it) => (
          <div key={it.label} className="h-full transition-[width] duration-500" style={{ width: `${(it.value / total) * 100}%`, background: it.color }} title={`${it.label}: ${it.value}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: it.color }} />
            <span className="min-w-0 flex-1 truncate text-muted">{it.label}</span>
            <span className={cn("font-mono tabular-nums")}>{format(it.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** أعمدة مكدّسة حسب الفئة لكل فترة زمنية */
export function StackedBars({
  columns,
  series,
  height = 200,
}: {
  columns: { label: string; values: number[] }[];
  series: { label: string; color: string }[];
  height?: number;
}) {
  const max = Math.max(1, ...columns.map((c) => c.values.reduce((a, b) => a + b, 0)));
  return (
    <div dir="ltr">
      <div className="flex items-end gap-2" style={{ height }}>
        {columns.map((c) => {
          const total = c.values.reduce((a, b) => a + b, 0);
          return (
            <div key={c.label} className="group relative flex h-full flex-1 flex-col justify-end" title={`${c.label}: ${total}`}>
              <span className="mb-1 text-center font-mono text-[10px] text-muted tabular-nums opacity-0 transition group-hover:opacity-100">{total}</span>
              <div className="flex flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(total / max) * 100}%` }}>
                {c.values.map((v, i) => (
                  <div key={series[i].label} style={{ height: `${total ? (v / total) * 100 : 0}%`, background: series[i].color }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {columns.map((c) => (
          <span key={c.label} className="flex-1 truncate text-center text-[10px] text-muted">
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
