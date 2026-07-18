"use client";

import React, { useState } from "react";
import NeuralField from "./glass/NeuralField";
import { GlassTile, Icon } from "./glass/icons";
import { db } from "../lib/db";

interface LoginScreenProps {
  onLoginSuccess: (operatorName: string) => void;
}

const CAPABILITIES: { label: string; sub: string; icon: "box" | "card" | "file"; tone: "violet" | "emerald" | "blue" }[] = [
  { label: "Catalog", sub: "Stock control", icon: "box", tone: "violet" },
  { label: "Payments", sub: "Cash & MoMo", icon: "card", tone: "emerald" },
  { label: "Receipts", sub: "Print & share", icon: "file", tone: "blue" },
];

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      if (password === "edith123" || password === "Edith123") {
        db.setSession("Operator");
        onLoginSuccess("Operator");
      } else {
        setError("Invalid operator passcode. Please try again.");
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <NeuralField />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Brand */}
        <div className="rise mb-7 flex flex-col items-center text-center" style={{ "--d": "0ms" } as React.CSSProperties}>
          <div className="floaty">
            <GlassTile name="gem" tone="brand" size={72} glyphSize={38} />
          </div>
          <h1 className="font-display mt-5 text-[34px] font-bold leading-none tracking-tight text-ink">
            DiaPalace
          </h1>
          <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.3em] text-faint">
            Liquid Commerce OS
          </p>
        </div>

        {/* Access card */}
        <div
          className={`g-panel-2 rise rounded-[30px] p-6 md:p-7 ${error ? "shake" : ""}`}
          style={{ "--d": "90ms" } as React.CSSProperties}
        >
          <div className="mb-6">
            <h2 className="font-display text-xl font-bold tracking-tight text-ink">
              Unlock the workspace
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-dim">
              Authorized access for DiaPalace staff and managers.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="pill-coral flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-[11px] font-bold normal-case tracking-normal">
                <Icon name="shield" size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="lbl">Workspace</label>
              <div className="g-deep flex items-center gap-3 rounded-2xl px-3.5 py-3">
                <GlassTile tone="brand" size={34}>
                  <span className="text-[10px] font-extrabold">DP</span>
                </GlassTile>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-ink">DiaPalace Operations</div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-faint">
                    Company Platform
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="passcode" className="lbl">Passcode</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint">
                  <Icon name="lock" size={16} />
                </span>
                <input
                  id="passcode"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter passcode"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl py-3.5 pl-11 pr-12 text-sm font-semibold"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-faint transition-colors hover:text-ink"
                  aria-label={showPassword ? "Hide passcode" : "Show passcode"}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-aurora mt-1 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[11px] font-extrabold uppercase tracking-[0.18em]"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0a0c18]/30 border-t-[#0a0c18]" />
              ) : (
                <>
                  <span>Enter Workspace</span>
                  <Icon name="arrowRight" size={15} strokeWidth={2.2} />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
            <Icon name="shield" size={12} className="text-faint" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-faint">
              Authorized staff only
            </span>
          </div>
        </div>

        {/* Capability chips */}
        <div className="rise mt-5 grid grid-cols-3 gap-2.5" style={{ "--d": "180ms" } as React.CSSProperties}>
          {CAPABILITIES.map((c) => (
            <div key={c.label} className="g-chip flex flex-col items-center gap-2 rounded-2xl px-2 py-3.5 text-center">
              <GlassTile name={c.icon} tone={c.tone} size={30} />
              <div>
                <div className="text-[11px] font-bold text-ink">{c.label}</div>
                <div className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-faint">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <p
          className="rise mt-6 text-center text-[9px] font-extrabold uppercase tracking-[0.3em] text-faint"
          style={{ "--d": "260ms" } as React.CSSProperties}
        >
          diapalace.com · Accra
        </p>
      </div>
    </div>
  );
}
