"use client";

import React from "react";
import { GlassTile, Icon } from "./glass/icons";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const trapRef = useFocusTrap(open);

  if (!open) return null;

  return (
    <div className="g-backdrop fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={onCancel}>
      <div
        ref={trapRef}
        className="g-panel-2 pop flex w-full max-w-sm flex-col gap-5 rounded-[26px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <GlassTile
            name="alertTriangle"
            tone={variant === "danger" ? "rose" : "amber"}
            size={40}
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[15px] font-bold tracking-tight text-ink">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-dim">{message}</p>
          </div>
          <button onClick={onCancel} className="btn-ico h-8 w-8 shrink-0">
            <Icon name="x" size={13} />
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="btn-ghost rounded-xl px-4 py-2.5 text-xs font-bold"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-xs font-extrabold ${
              variant === "danger" ? "btn-danger" : "btn-aurora"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
