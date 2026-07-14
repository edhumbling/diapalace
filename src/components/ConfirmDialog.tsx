"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";
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
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div
        ref={trapRef}
        className="glass-panel w-full max-w-sm rounded-2xl border border-zinc-800 p-5 flex flex-col gap-5 shadow-2xl animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl shrink-0 ${variant === "danger" ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} className="text-zinc-600 hover:text-zinc-300 cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              variant === "danger"
                ? "bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                : "bg-gradient-to-r from-rose-400 to-amber-300 text-zinc-950"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
