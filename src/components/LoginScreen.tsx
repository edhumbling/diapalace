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

    // Simulate small delay for premium feels
    setTimeout(() => {
      // The secure passcode specifically for Edith
      if (password === "edith123" || password === "Edith123") {
        db.setSession("Edith");
        onLoginSuccess("Edith");
      } else {
        setError("Invalid operator passcode. Please try again.");
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 flex items-center justify-center relative overflow-hidden px-4">
      {/* Visual background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md relative z-10">
        
        {/* Soft glass panel */}
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl flex flex-col items-center">
          
          {/* Logo */}
          <div className="relative w-24 h-24 mb-6">
            <Image
              src="/logo.png"
              alt="DiaPalace Logo"
              fill
              className="object-contain"
              priority
            />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              DiaPalace POS
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Authorized Operator Login for Edith
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
            {error && (
              <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs py-3 px-4 rounded-xl">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Operator Profile
              </label>
              <div className="w-full bg-zinc-950 border border-zinc-800/60 rounded-xl px-4 py-3 text-sm text-zinc-300 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 flex items-center justify-center text-[10px] font-bold text-zinc-950">
                  ED
                </div>
                <div>
                  <div className="font-semibold text-zinc-200">Edith</div>
                  <div className="text-[10px] text-zinc-500">Store Operator</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 relative">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                Passcode
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter passcode"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl py-3 pl-12 pr-12 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-400/50 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-rose-400 to-amber-300 hover:opacity-90 active:scale-[0.98] text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/10 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Unlock Register</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Hint */}
          <div className="mt-8 text-center bg-zinc-950/40 border border-zinc-900 px-4 py-2 rounded-xl">
            <span className="text-[10px] font-medium text-zinc-600">
              Demo Access Hint: Use passcode <code className="text-rose-300/80 font-mono">edith123</code>
            </span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-zinc-700 mt-6 uppercase tracking-widest">
          diapalace.com Secure POS Terminal
        </p>
      </div>
    </div>
  );
}
