"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { usePrefs } from "@/lib/i18n/preferences";
import { Button } from "./button";

function useDialogBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  // نحفظ الدالة في مرجع حتى لا يُعاد تشغيل التأثير مع كل تحديث للبيانات فيقفز التركيز
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("input, textarea, select, button:not([data-close])");
    (first ?? panelRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open]);
  return panelRef;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  tone,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  tone?: "danger";
}) {
  const { t } = usePrefs();
  const titleId = useId();
  const panelRef = useDialogBehavior(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "animate-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-2xl outline-none sm:rounded-2xl",
          { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }[size],
          tone === "danger" && "border-danger/40",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className={cn("text-base font-semibold", tone === "danger" && "text-danger")}>
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t.common.close} data-close>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
}) {
  const { t } = usePrefs();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={body}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { t } = usePrefs();
  const titleId = useId();
  const panelRef = useDialogBehavior(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 end-0 flex w-full max-w-xl flex-col border-s border-border bg-surface shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t.common.close} data-close>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
