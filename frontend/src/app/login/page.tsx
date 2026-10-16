"use client";

import { Lock, LogIn, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo, PreferenceToggles } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { usePrefs } from "@/lib/i18n/preferences";

// واجهة فقط حالياً: التحقق الفعلي (JWT) يُبنى مع الخادم
export default function LoginPage() {
  const { t } = usePrefs();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError(t.login.required);
    setBusy(true);
    setTimeout(() => router.push("/"), 500);
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(var(--chart-grid)_1px,transparent_1px),linear-gradient(90deg,var(--chart-grid)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      />
      <div className="absolute end-4 top-4 flex items-center gap-1">
        <PreferenceToggles />
      </div>

      <div className="relative w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl sm:p-7">
          <div className="mb-6">
            <h1 className="text-lg font-semibold">{t.login.title}</h1>
            <p className="mt-1 text-sm text-muted">{t.login.subtitle}</p>
          </div>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label={t.login.username} htmlFor="username">
              <Input
                id="username"
                autoComplete="username"
                dir="ltr"
                value={username}
                onChange={(e) => {
                  setError(null);
                  setUsername(e.target.value);
                }}
              />
            </Field>
            <Field label={t.login.password} htmlFor="password">
              <div className="relative">
                <Lock className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  dir="ltr"
                  className="pe-9"
                  value={password}
                  onChange={(e) => {
                    setError(null);
                    setPassword(e.target.value);
                  }}
                />
              </div>
            </Field>
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="w-full justify-center" disabled={busy}>
              <LogIn className="h-4 w-4 rtl:-scale-x-100" />
              {busy ? t.login.submitting : t.login.submit}
            </Button>
          </form>
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t.login.footer}
        </p>
      </div>
    </div>
  );
}
