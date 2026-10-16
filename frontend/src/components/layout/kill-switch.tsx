"use client";

import { OctagonX, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";
import { useGateway } from "@/lib/store/gateway-store";

/** حوارا التفعيل والإلغاء. الإلغاء يحتاج تأكيداً صريحاً (AR-03) */
export function KillSwitchDialogs({ mode, onClose }: { mode: "activate" | "deactivate" | null; onClose: () => void }) {
  const { t } = usePrefs();
  const { activateKillSwitch, deactivateKillSwitch } = useGateway();
  const [confirmed, setConfirmed] = useState(false);

  const close = () => {
    setConfirmed(false);
    onClose();
  };

  return (
    <>
      <Modal
        open={mode === "activate"}
        onClose={close}
        title={t.kill.activateTitle}
        description={t.kill.activateBody}
        size="sm"
        tone="danger"
        footer={
          <>
            <Button onClick={close}>{t.common.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                activateKillSwitch();
                close();
              }}
            >
              <OctagonX className="h-4 w-4" />
              {t.kill.activateConfirm}
            </Button>
          </>
        }
      />
      <Modal
        open={mode === "deactivate"}
        onClose={close}
        title={t.kill.deactivateTitle}
        description={t.kill.deactivateBody}
        size="sm"
        footer={
          <>
            <Button onClick={close}>{t.common.cancel}</Button>
            <Button
              variant="primary"
              disabled={!confirmed}
              onClick={() => {
                deactivateKillSwitch();
                close();
              }}
            >
              {t.kill.deactivateConfirm}
            </Button>
          </>
        }
      >
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-2/50 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          {t.kill.deactivateCheck}
        </label>
      </Modal>
    </>
  );
}

export function KillSwitchButton({ onRequest }: { onRequest: (mode: "activate" | "deactivate") => void }) {
  const { t } = usePrefs();
  const { state } = useGateway();
  const active = state.settings.kill_switch_active;
  return (
    <Button
      variant={active ? "danger" : "outline-danger"}
      size="md"
      onClick={() => onRequest(active ? "deactivate" : "activate")}
      className={cn("font-semibold", active && "ring-2 ring-danger/40")}
      aria-pressed={active}
    >
      <OctagonX className="h-4 w-4" />
      <span className="hidden sm:inline">{active ? t.kill.activeButton : t.kill.button}</span>
    </Button>
  );
}

export function KillSwitchBanner({ onRequest }: { onRequest: (mode: "deactivate") => void }) {
  const { t, fmt } = usePrefs();
  const { state } = useGateway();
  if (!state.settings.kill_switch_active) return null;
  const since = state.settings.kill_switch_activated_at;
  return (
    <div role="alert" className="animate-in border-b border-danger/40 bg-danger text-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{t.kill.bannerTitle}</span>
          <span className="hidden opacity-90 md:inline"> — {t.kill.bannerBody(since ? fmt.time(since) : "")}</span>
        </div>
        <button
          type="button"
          onClick={() => onRequest("deactivate")}
          className="rounded-md bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25"
        >
          {t.kill.deactivate}
        </button>
      </div>
    </div>
  );
}
