"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ar, type Dictionary } from "./ar";
import { en } from "./en";

export type Locale = "ar" | "en";
export type Theme = "dark" | "light";

const dictionaries: Record<Locale, Dictionary> = { ar, en };

interface Preferences {
  locale: Locale;
  theme: Theme;
  t: Dictionary;
  dir: "rtl" | "ltr";
  toggleLocale: () => void;
  toggleTheme: () => void;
  fmt: Formatters;
}

export interface Formatters {
  time: (ms: number) => string;
  dateTime: (ms: number) => string;
  date: (ms: number) => string;
  relative: (ms: number, now: number) => string;
  num: (n: number, digits?: number) => string;
  pct: (n: number) => string;
}

// أرقام لاتينية في الواجهة العربية لأنها أوضح مع المعرّفات والبصمات
function makeFormatters(locale: Locale): Formatters {
  const tag = locale === "ar" ? "ar-u-nu-latn" : "en-GB";
  const timeF = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dateTimeF = new Intl.DateTimeFormat(tag, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const dateF = new Intl.DateTimeFormat(tag, { year: "numeric", month: "short", day: "numeric" });
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto", style: "short" });
  return {
    time: (ms) => timeF.format(ms),
    dateTime: (ms) => dateTimeF.format(ms),
    date: (ms) => dateF.format(ms),
    relative: (ms, now) => {
      const s = Math.round((ms - now) / 1000);
      const abs = Math.abs(s);
      if (abs < 60) return rtf.format(s, "second");
      if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
      if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
      return rtf.format(Math.round(s / 86400), "day");
    },
    num: (n, digits = 0) => new Intl.NumberFormat(tag, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n),
    pct: (n) => new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 1 }).format(n),
  };
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

const Ctx = createContext<Preferences | null>(null);

export function PreferencesProvider({
  initialLocale,
  initialTheme,
  children,
}: {
  initialLocale: Locale;
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => {
      const next: Locale = prev === "ar" ? "en" : "ar";
      setCookie("locale", next);
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      setCookie("theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  const value = useMemo<Preferences>(
    () => ({
      locale,
      theme,
      t: dictionaries[locale],
      dir: locale === "ar" ? "rtl" : "ltr",
      toggleLocale,
      toggleTheme,
      fmt: makeFormatters(locale),
    }),
    [locale, theme, toggleLocale, toggleTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Preferences {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrefs must be used inside PreferencesProvider");
  return ctx;
}
