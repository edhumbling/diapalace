"use client";

import React from "react";
import Image from "next/image";
import {
  ShoppingBag,
  Package,
  Users,
  BarChart3,
  LogOut,
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  operatorName: string;
  onLogout: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  operatorName,
  onLogout
}: SidebarProps) {
  const menuItems = [
    { id: "pos", name: "Checkout POS", icon: ShoppingBag },
    { id: "inventory", name: "Inventory", icon: Package },
    { id: "customers", name: "Customers", icon: Users },
    { id: "analytics", name: "Reports", icon: BarChart3 }
  ];

  return (
    <>
      {/* Desktop Sidebar (visible on md and up) */}
      <aside className="command-rail hidden md:flex md:w-64 flex-col border-r border-zinc-900 flex-shrink-0 min-h-screen relative z-30 shadow-2xl">
        
        {/* Header/Logo area */}
        <div className="p-6 border-b border-zinc-900 flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0 rounded-2xl bg-white p-1.5 shadow-lg">
            <Image
              src="/logo.png"
              alt="DiaPalace Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">
              DiaPalace.com
            </h1>
            <span className="text-[10px] text-rose-300 font-black tracking-[0.22em] uppercase">
              Retail Command POS
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-black uppercase tracking-[0.1em] transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-rose-500/15 to-amber-500/5 text-rose-300 border border-rose-400/30 shadow-lg shadow-black/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 border border-transparent"
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                  isActive ? "border-rose-400/30 bg-rose-400/15" : "border-white/10 bg-white/5"
                }`}>
                  <Icon className={`w-4 h-4 ${isActive ? "text-rose-300" : "text-zinc-500"}`} />
                </span>
                <span className="text-left leading-tight">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer / Operator Account */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950/40 flex flex-col gap-3">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/40 p-3">
            <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-400 to-amber-300 flex items-center justify-center text-[11px] font-black text-zinc-950">
              {operatorName.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-zinc-200 truncate">
                {operatorName}
              </p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Store Operator</p>
            </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-zinc-800 hover:border-zinc-700/80 text-zinc-400 hover:text-zinc-200 text-[11px] font-black tracking-[0.16em] uppercase bg-zinc-900/10 cursor-pointer transition-all active:scale-[0.98]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock Terminal</span>
          </button>
        </div>
      </aside>
      {/* Mobile Bottom Navigation (visible on mobile only) */}
      <nav className="mobile-command-nav md:hidden fixed bottom-4 left-3 right-3 z-40 bg-zinc-950/85 backdrop-blur-xl border border-zinc-900/80 rounded-3xl flex items-center justify-around py-2.5 px-2 shadow-2xl shadow-black/80">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl cursor-pointer relative transition-all active:scale-[0.93] ${
                isActive ? "bg-rose-400/10" : ""
              }`}
            >
              <Icon
                className={`w-4.5 h-4.5 ${
                  isActive ? "text-rose-400 scale-105" : "text-zinc-500 hover:text-zinc-300"
                } transition-all`}
              />
              <span
                className={`text-[8px] font-black tracking-widest uppercase ${
                  isActive ? "text-rose-400" : "text-zinc-500"
                }`}
              >
                {item.id === "pos" ? "POS" : item.id === "inventory" ? "Catalog" : item.id === "customers" ? "Clients" : "Reports"}
              </span>
              {isActive && (
                <span className="absolute bottom-[-1px] w-1 h-1 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              )}
            </button>
          );
        })}
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl cursor-pointer transition-all active:scale-[0.93]"
        >
          <LogOut className="w-4.5 h-4.5 text-zinc-600 hover:text-rose-400" />
          <span className="text-[8px] font-extrabold tracking-widest text-zinc-600 uppercase">Lock</span>
        </button>
      </nav>
    </>
  );
}
