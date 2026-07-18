"use client";

import React from "react";
import { GlassTile, Icon, type IconName, type TileTone } from "./glass/icons";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  operator: string;
}

const MENU: { id: string; name: string; short: string; icon: IconName; tone: TileTone; keyHint: string }[] = [
  { id: "pos", name: "Sales Register", short: "POS", icon: "pos", tone: "cyan", keyHint: "1" },
  { id: "inventory", name: "Inventory", short: "Stock", icon: "box", tone: "violet", keyHint: "2" },
  { id: "customers", name: "Customers", short: "Clients", icon: "users", tone: "rose", keyHint: "3" },
  { id: "analytics", name: "Reports", short: "Reports", icon: "chart", tone: "emerald", keyHint: "4" },
];

export default function Sidebar({ activeTab, setActiveTab, onLogout, operator }: SidebarProps) {
  return (
    <>
      {/* ------- Desktop: floating glass command rail ------- */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 p-4 pr-0 lg:block">
        <div className="g-panel rise flex h-full flex-col rounded-[28px] p-4">
          <div className="flex items-center gap-3 px-1 pb-5 pt-1">
            <GlassTile name="gem" tone="brand" size={42} />
            <div className="min-w-0">
              <h1 className="font-display truncate text-[17px] font-bold leading-tight tracking-tight text-ink">
                DiaPalace
              </h1>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-faint">
                Liquid Commerce OS
              </span>
            </div>
          </div>

          <div className="h-px w-full bg-white/[0.07]" />

          <nav className="mt-4 flex flex-1 flex-col gap-1.5">
            {MENU.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2.5 text-left transition-all duration-200 ${
                    isActive
                      ? "border-white/[0.16] bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_24px_-12px_rgba(0,0,0,0.7)]"
                      : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.04]"
                  }`}
                >
                  <GlassTile
                    name={item.icon}
                    tone={item.tone}
                    size={36}
                    className={isActive ? "scale-105" : "opacity-80 saturate-[0.7] group-hover:opacity-100 group-hover:saturate-100"}
                  />
                  <span className="flex-1 min-w-0">
                    <span className={`block truncate text-[13px] font-bold leading-tight ${isActive ? "text-ink" : "text-dim group-hover:text-ink"}`}>
                      {item.name}
                    </span>
                    <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
                      {item.id === "pos" ? "Checkout" : item.id === "inventory" ? "Catalog" : item.id === "customers" ? "Directory" : "Analytics"}
                    </span>
                  </span>
                  <span className={`kbd transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}>
                    {item.keyHint}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 flex flex-col gap-2">
            <div className="g-deep flex items-center gap-3 rounded-2xl p-3">
              <GlassTile tone="slate" size={36} className="glass-tile-clear">
                <span className="text-[11px] font-extrabold">
                  {operator.substring(0, 2).toUpperCase()}
                </span>
              </GlassTile>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-ink">{operator}</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">
                  Store Operator
                </p>
              </div>
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-mint text-mint" />
            </div>
            <button
              onClick={onLogout}
              className="btn-ghost flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[10px] font-extrabold uppercase tracking-[0.18em]"
            >
              <Icon name="logout" size={14} />
              <span>Lock Workspace</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ------- Mobile: floating liquid dock ------- */}
      <nav className="g-panel-2 fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-end gap-1.5 rounded-[26px] px-2.5 py-2 lg:hidden">
        {MENU.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center gap-1 px-1 pb-0.5 pt-1"
              aria-label={item.name}
            >
              <GlassTile
                name={item.icon}
                tone={item.tone}
                size={42}
                className={`transition-all duration-300 ${
                  isActive
                    ? "-translate-y-1.5 scale-110"
                    : "opacity-75 saturate-[0.65] active:scale-95"
                }`}
                style={
                  isActive
                    ? { boxShadow: `0 0 0 1.5px rgba(255,255,255,0.5), 0 14px 28px -8px rgba(0,0,0,0.7)` }
                    : undefined
                }
              />
              <span className={`text-[7.5px] font-extrabold uppercase tracking-[0.14em] ${isActive ? "text-ink" : "text-faint"}`}>
                {item.short}
              </span>
            </button>
          );
        })}
        <span className="mx-1 mb-4 h-8 w-px bg-white/10" />
        <button onClick={onLogout} className="flex flex-col items-center gap-1 px-1 pb-0.5 pt-1" aria-label="Lock workspace">
          <GlassTile name="logout" tone="slate" size={42} className="opacity-75 saturate-[0.65] active:scale-95" />
          <span className="text-[7.5px] font-extrabold uppercase tracking-[0.14em] text-faint">Lock</span>
        </button>
      </nav>
    </>
  );
}
