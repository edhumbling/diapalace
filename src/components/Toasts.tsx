"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Icon, type IconName } from "./glass/icons";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const TOAST_STYLE: Record<ToastType, { icon: IconName; cls: string; iconCls: string }> = {
  success: { icon: "checkCircle", cls: "border-mint/30", iconCls: "text-mint" },
  error: { icon: "alertCircle", cls: "border-coral/30", iconCls: "text-coral" },
  info: { icon: "info", cls: "border-sky/30", iconCls: "text-sky" },
  warning: { icon: "alertTriangle", cls: "border-honey/30", iconCls: "text-honey" },
};

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-24 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 lg:bottom-6 lg:right-6">
        {toasts.map((t) => {
          const s = TOAST_STYLE[t.type];
          return (
            <div
              key={t.id}
              className={`toast-in g-panel-2 pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 ${s.cls}`}
            >
              <span className={`mt-0.5 shrink-0 ${s.iconCls}`}>
                <Icon name={s.icon} size={16} />
              </span>
              <p className="flex-1 text-xs font-semibold leading-relaxed text-ink">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 rounded-lg p-0.5 text-faint transition-colors hover:text-ink"
                aria-label="Dismiss"
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
