"use client";

import { CornerDownLeft, Search, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway } from "@/lib/store/gateway-store";
import { ALL_PAGES } from "./nav";

interface Entry {
  id: string;
  label: string;
  group: "pages" | "actions";
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

/** بحث شامل في الصفحات والإجراءات (Ctrl+K) */
export function CommandPalette({ open, onClose, onKill }: { open: boolean; onClose: () => void; onKill: (m: "activate" | "deactivate") => void }) {
  const { t, toggleTheme, toggleLocale } = usePrefs();
  const { state, verifyAudit } = useGateway();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const go = (href: string) => () => router.push(href);
    const kill = state.settings.kill_switch_active;
    return [
      ...ALL_PAGES.map((p) => ({ id: p.href, label: t.nav[p.key], group: "pages" as const, icon: p.icon, run: go(p.href) })),
      { id: "kill", label: kill ? t.palette.deactivateKill : t.palette.activateKill, group: "actions", icon: Zap, run: () => onKill(kill ? "deactivate" : "activate") },
      {
        id: "verify",
        label: t.palette.verifyAudit,
        group: "actions",
        icon: Zap,
        run: () => {
          verifyAudit();
          router.push("/audit");
        },
      },
      { id: "suite", label: t.palette.runSuite, group: "actions", icon: Zap, run: go("/lab?run=1") },
      { id: "policy", label: t.palette.newPolicy, group: "actions", icon: Zap, run: go("/policies?new=1") },
      { id: "agent", label: t.palette.registerAgent, group: "actions", icon: Zap, run: go("/agents?new=1") },
      { id: "theme", label: t.palette.toggleTheme, group: "actions", icon: Zap, run: toggleTheme },
      { id: "lang", label: t.palette.toggleLang, group: "actions", icon: Zap, run: toggleLocale },
    ];
  }, [t, router, state.settings.kill_switch_active, verifyAudit, onKill, toggleTheme, toggleLocale]);

  const filtered = entries.filter((e) => e.label.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const close = () => {
    setQ("");
    setIndex(0);
    onClose();
  };
  const choose = (e: Entry | undefined) => {
    if (!e) return;
    close();
    e.run();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={close} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={t.topbar.search} className="animate-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(filtered.length - 1, i + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter") choose(filtered[index]);
            }}
            placeholder={t.palette.placeholder}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={filtered[index] ? `pal-${filtered[index].id}` : undefined}
          />
        </div>
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t.palette.empty}</li>}
          {filtered.map((e, i) => {
            const showGroup = i === 0 || filtered[i - 1].group !== e.group;
            const Icon = e.icon;
            return (
              <li key={e.id} role="presentation">
                {showGroup && <div className="px-3 pt-2 pb-1 text-[11px] text-muted">{e.group === "pages" ? t.palette.pages : t.palette.actions}</div>}
                <button
                  id={`pal-${e.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(e)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm", i === index ? "bg-primary-soft text-primary" : "text-fg")}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{e.label}</span>
                  {i === index && <CornerDownLeft className="h-3.5 w-3.5 opacity-70" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border px-4 py-2 text-[11px] text-muted">{t.palette.hint}</div>
      </div>
    </div>,
    document.body,
  );
}
