"use client";

import { AlertTriangle, Bell, Bot, Clock, OctagonX, UserCheck, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway } from "@/lib/store/gateway-store";
import type { Notice } from "@/lib/types";

const ICONS = { HITL_NEW: UserCheck, LATENCY_BREACH: Clock, KILL_SWITCH: OctagonX, AGENT_DEACTIVATED: Bot, TOOL_DISABLED: Wrench };
const TONE = { HITL_NEW: "text-warning bg-warning-soft", LATENCY_BREACH: "text-danger bg-danger-soft", KILL_SWITCH: "text-danger bg-danger-soft", AGENT_DEACTIVATED: "text-info bg-info-soft", TOOL_DISABLED: "text-info bg-info-soft" };

function useNoticeText() {
  const { t } = usePrefs();
  const { state } = useGateway();
  return (n: Notice) => {
    switch (n.kind) {
      case "HITL_NEW":
        return t.notice.HITL_NEW((n.value ?? 0).toFixed(2));
      case "LATENCY_BREACH":
        return t.notice.LATENCY_BREACH(n.value ?? 0);
      case "KILL_SWITCH":
        return t.notice.KILL_SWITCH;
      case "AGENT_DEACTIVATED":
        return t.notice.AGENT_DEACTIVATED(state.agents.find((a) => a.agent_id === n.ref)?.agent_name ?? "");
      case "TOOL_DISABLED":
        return t.notice.TOOL_DISABLED(n.ref ?? "");
    }
  };
}

function noticeHref(n: Notice) {
  if (n.kind === "HITL_NEW") return `/approvals?item=${n.ref}`;
  if (n.kind === "LATENCY_BREACH") return "/performance";
  if (n.kind === "AGENT_DEACTIVATED") return "/agents";
  if (n.kind === "TOOL_DISABLED") return "/resources";
  return "/";
}

export function NotificationBell() {
  const { t, fmt } = usePrefs();
  const { state, readNotices } = useGateway();
  const text = useNoticeText();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = state.notices.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label={t.topbar.notifications} aria-expanded={open} className="relative">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="animate-in absolute end-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">{t.topbar.notifications}</span>
            {unread > 0 && (
              <button type="button" onClick={readNotices} className="text-xs text-primary hover:underline">
                {t.topbar.markRead}
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {state.notices.length === 0 && <li className="px-4 py-8 text-center text-xs text-muted">{t.topbar.noNotifications}</li>}
            {state.notices.slice(0, 20).map((n) => {
              const Icon = ICONS[n.kind];
              return (
                <li key={n.id}>
                  <Link
                    href={noticeHref(n)}
                    onClick={() => {
                      setOpen(false);
                      readNotices();
                    }}
                    className={cn("flex items-start gap-3 px-4 py-3 hover:bg-surface-2/60", !n.read && "bg-primary-soft/30")}
                  >
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", TONE[n.kind])}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-relaxed">{text(n)}</span>
                      <span className="text-[11px] text-muted">{fmt.relative(n.at, state.now)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** إشعارات منبثقة للأحداث الجديدة أثناء العمل في أي صفحة (FR-19) */
export function Toasts() {
  const { t } = usePrefs();
  const { state } = useGateway();
  const text = useNoticeText();
  const [visible, setVisible] = useState<Notice[]>([]);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(state.notices.map((n) => n.id));
      return;
    }
    const fresh = state.notices.filter((n) => !seen.current!.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current!.add(n.id));
    setVisible((v) => [...fresh, ...v].slice(0, 3));
    const ids = fresh.map((n) => n.id);
    setTimeout(() => setVisible((v) => v.filter((n) => !ids.includes(n.id))), 7000);
  }, [state.notices]);

  if (!visible.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 start-4 z-[55] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {visible.map((n) => {
        const Icon = n.kind === "LATENCY_BREACH" ? AlertTriangle : ICONS[n.kind];
        return (
          <div key={n.id} role="status" className="animate-in pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-2xl">
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", TONE[n.kind])}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{text(n)}</p>
              <Link href={noticeHref(n)} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                {t.notice.open}
              </Link>
            </div>
            <button type="button" aria-label={t.common.close} onClick={() => setVisible((v) => v.filter((x) => x.id !== n.id))} className="rounded p-1 text-muted hover:text-fg">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
