"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Lock, Eye, EyeOff, ShieldAlert, ArrowRight } from "lucide-react";
import { db } from "../lib/db";

interface LoginScreenProps {
  onLoginSuccess: (operatorName: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate a short authentication delay.
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
    <div className="min-h-screen w-full overflow-hidden bg-background px-4 py-6 md:p-8">
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 shadow-sm md:grid-cols-[1fr_0.92fr]">
        <section className="command-rail relative hidden flex-col justify-between overflow-hidden p-8 md:flex lg:p-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 rounded-xl bg-white p-2">
                <Image
                  src="/logo.png"
                  alt="DiaPalace Logo"
                  fill
                  className="object-contain p-1"
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">DiaPalace.com</h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300">
                  Business operations platform
                </p>
              </div>
            </div>

            <div className="mt-20 max-w-lg">
              <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white lg:text-5xl">
                Secure access for retail operations.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-zinc-400">
                Manage catalog, checkout, customer records, receipts, and reporting from a single controlled workspace.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              ["Catalog", "Stock control"],
              ["Payments", "Cash and MoMo"],
              ["Receipts", "Print and share"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</div>
                <div className="mt-2 text-sm font-semibold text-zinc-200">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center bg-zinc-950 p-5 md:p-10">
          <div className="w-full max-w-md animate-scale-up">
            <div className="mb-8 flex items-center justify-center gap-3 md:hidden">
              <div className="relative h-12 w-12 rounded-2xl bg-white p-2 shadow-lg">
                <Image
                  src="/logo.png"
                  alt="DiaPalace Logo"
                  fill
                  className="object-contain p-1"
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-zinc-200">DiaPalace.com</h1>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-300">Retail POS</p>
              </div>
            </div>

            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <div className="mb-8">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-300">
                  <Lock className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-200">
                  Sign in to workspace
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                  Authorized access for DiaPalace staff and managers.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
                {error && (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Workspace
                  </label>
                  <div className="flex w-full items-center gap-3 rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-[11px] font-semibold text-zinc-950">
                      DP
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-200">DiaPalace Operations</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Company Platform</div>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    Passcode
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter passcode"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950 py-3 pl-12 pr-12 text-sm font-medium text-zinc-100 placeholder-zinc-600 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-500 hover:text-zinc-300"
                      aria-label={showPassword ? "Hide passcode" : "Show passcode"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="primary-action mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold uppercase tracking-[0.12em] shadow-none transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-xl border border-zinc-900 bg-zinc-950/40 px-4 py-3 text-center">
                <span className="text-[10px] font-bold text-zinc-600">
                  Authorized staff access only
                </span>
              </div>
            </div>

            <p className="mt-5 text-center text-[10px] font-black uppercase tracking-[0.22em] text-zinc-700">
              diapalace.com business operations platform
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
