"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border border-border bg-surface-2/60 px-3 text-sm text-fg placeholder:text-muted/70 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-10", className)} {...props} />;
});

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-20 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "h-10 cursor-pointer pe-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  tone = "primary",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  tone?: "primary" | "danger";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50",
        checked ? (tone === "danger" ? "border-danger bg-danger" : "border-primary bg-primary") : "border-border bg-surface-2",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all",
          checked ? "start-[18px]" : "start-0.5",
        )}
      />
    </button>
  );
}

/** مجموعة خيارات متعددة على شكل رقائق قابلة للتبديل */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="space-y-1.5">
      <span id={id} className="block text-xs font-medium">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition",
                on ? "border-primary/40 bg-primary-soft text-primary" : "border-border text-muted hover:text-fg",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
