"use client";

import { Activity, Languages, LogOut, Menu, Moon, Search, ShieldCheck, Sun, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway, useGatewayOptional } from "@/lib/store/gateway-store";
import { CommandPalette } from "./command-palette";
import { KillSwitchBanner, KillSwitchButton, KillSwitchDialogs } from "./kill-switch";
import { NAV } from "./nav";
import { NotificationBell, Toasts } from "./notifications";

export function Logo({ className }: { className?: string }) {
  const { t } = usePrefs();
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold">{t.app.name}</div>
        <div className="text-[11px] text-muted">{t.app.tagline}</div>
      </div>
    </div>
  );
}

function useRatePerMinute() {
  const { state } = useGateway();
  return state.requests.filter((r) => r.received_at >= state.now - 60_000).length;
}

function InstanceCard() {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  const rate = useRatePerMinute();
  const isolated = state.settings.kill_switch_active;
  const pending = state.hitl.filter((h) => h.decision === "PENDING").length;
  const toolsOff = state.tools.filter((x) => !x.enabled).length;
  const stats = [
    { label: t.instance.intercepted, value: fmt.num(state.requests.length) },
    { label: t.instance.traffic, value: `${rate}/m` },
    { label: t.instance.approvals, value: String(pending), tone: pending ? "text-warning" : "" },
    { label: t.instance.toolsOff, value: String(toolsOff), tone: toolsOff ? "text-danger" : "" },
  ];
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-xs" dir="ltr">
            {t.instance.name}
          </div>
          <div className="font-mono text-[10px] text-muted" dir="ltr">
            v0.1.0 · docker
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold", isolated ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />
          {isolated ? t.gateway.isolated : t.common.live}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-surface px-2.5 py-1.5">
            <dt className="text-[10px] text-muted">{s.label}</dt>
            <dd className={cn("font-mono text-sm font-semibold tabular-nums", s.tone)}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = usePrefs();
  const pathname = usePathname();
  const { state } = useGateway();
  const pending = state.hitl.filter((h) => h.decision === "PENDING").length;
  const admin = state.users.find((u) => u.user_id === "u-admin");

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((s) => (
          <div key={s.key}>
            <div className="mb-1.5 px-3 text-[11px] font-medium tracking-wide text-muted/80">{t.nav[s.key]}</div>
            <ul className="space-y-0.5">
              {s.items.map((it) => {
                const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition",
                        active ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{t.nav[it.key]}</span>
                      {it.href === "/approvals" && pending > 0 && (
                        <span className="min-w-5 rounded-full bg-warning px-1.5 text-center text-[11px] font-semibold text-black tabular-nums">{pending}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-border p-3">
        <InstanceCard />
        <div className="flex items-center gap-3 px-1">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-primary">{admin?.username.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm">{admin?.full_name}</div>
            <div className="truncate font-mono text-[11px] text-muted" dir="ltr">
              {admin?.role}
            </div>
          </div>
          <Link href="/login" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label={t.nav.logout} title={t.nav.logout}>
            <LogOut className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PreferenceToggles() {
  const { t, theme, toggleTheme, toggleLocale } = usePrefs();
  return (
    <>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === "dark" ? t.topbar.lightMode : t.topbar.darkMode} title={theme === "dark" ? t.topbar.lightMode : t.topbar.darkMode}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={toggleLocale} aria-label={t.topbar.switchLangLabel} className="h-9">
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">{t.topbar.switchLang}</span>
      </Button>
    </>
  );
}

function Topbar({ onMenu, onKill, onSearch }: { onMenu: () => void; onKill: (m: "activate" | "deactivate") => void; onSearch: () => void }) {
  const { t } = usePrefs();
  const { state } = useGateway();
  const rate = useRatePerMinute();
  const pending = state.hitl.filter((h) => h.decision === "PENDING").length;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label={t.nav.openMenu}>
          <Menu className="h-5 w-5" />
        </Button>
        <button
          type="button"
          onClick={onSearch}
          className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted transition hover:text-fg md:w-72"
          aria-label={t.topbar.search}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden flex-1 truncate text-start md:inline">{t.topbar.search}</span>
          <kbd className="hidden rounded border border-border px-1.5 font-mono text-[10px] md:inline" dir="ltr">
            Ctrl K
          </kbd>
        </button>
        <div className="flex-1" />
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs xl:flex">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono tabular-nums">{rate}</span>
          <span className="text-muted">{t.topbar.perMinute}</span>
        </div>
        {pending > 0 && (
          <Link href="/approvals" className="hidden items-center gap-1.5 rounded-lg border border-warning/40 bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning sm:flex">
            <UserCheck className="h-3.5 w-3.5" />
            {t.topbar.pending(pending)}
          </Link>
        )}
        <NotificationBell />
        <PreferenceToggles />
        <KillSwitchButton onRequest={onKill} />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const gateway = useGatewayOptional();
  const { t } = usePrefs();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [killMode, setKillMode] = useState<"activate" | "deactivate" | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!gateway) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="text-xs text-muted">{t.app.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:ps-64">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 border-e border-border bg-surface lg:block print:hidden">
        <Sidebar />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} aria-hidden />
          <aside className="animate-in absolute inset-y-0 start-0 w-72 max-w-[85vw] border-e border-border bg-surface shadow-2xl">
            <Button variant="ghost" size="icon" className="absolute end-3 top-5" onClick={() => setMenuOpen(false)} aria-label={t.nav.closeMenu}>
              <X className="h-4 w-4" />
            </Button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="print:hidden">
        <Topbar onMenu={() => setMenuOpen(true)} onKill={setKillMode} onSearch={() => setSearchOpen(true)} />
        <KillSwitchBanner onRequest={setKillMode} />
      </div>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8 print:max-w-none print:p-0">{children}</main>
      <KillSwitchDialogs mode={killMode} onClose={() => setKillMode(null)} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} onKill={setKillMode} />
      <div className="print:hidden">
        <Toasts />
      </div>
    </div>
  );
}
