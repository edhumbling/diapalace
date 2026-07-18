"use client";

import React, { useState, useMemo } from "react";
import { GlassTile, Icon } from "./glass/icons";
import { Customer, Transaction, db } from "../lib/db";
import { useToast } from "./Toasts";
import { useDebounce } from "../hooks/useDebounce";

interface CustomersModuleProps {
  customers: Customer[];
  transactions: Transaction[];
  onCustomersChange: (newCustomers: Customer[]) => void;
  onViewReceipt: (tx: Transaction) => void;
}

const AVATAR_TONES = ["rose", "violet", "cyan", "emerald", "amber", "blue"] as const;

function avatarTone(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export default function CustomersModule({
  customers,
  transactions,
  onCustomersChange,
  onViewReceipt
}: CustomersModuleProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    customers.length > 0 ? customers[0].id : null
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const debouncedSearch = useDebounce(searchQuery, 250);

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  const filteredCustomers = useMemo(() => {
    if (!debouncedSearch) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || c.phone.includes(debouncedSearch)
    );
  }, [customers, debouncedSearch]);

  const customerTransactions = activeCustomer
    ? transactions.filter((t) => t.customer?.id === activeCustomer.id)
    : [];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formName.trim()) e.name = "Name is required";
    if (!formPhone.trim()) e.phone = "Phone number is required";
    else if (customers.some((c) => c.phone === formPhone.trim() && c.id !== selectedCustomerId)) {
      e.phone = "Phone number already exists";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast("Please fix form errors.", "error");
      return;
    }

    const newCustomer: Customer = {
      id: `c-${Date.now()}`,
      name: formName.trim(),
      phone: formPhone.trim(),
      notes: formNotes.trim(),
      createdAt: new Date().toISOString()
    };

    const updated = [newCustomer, ...customers];
    onCustomersChange(updated);
    db.saveCustomers(updated);

    setSelectedCustomerId(newCustomer.id);
    setIsAddingNew(false);
    setFormName(""); setFormPhone(""); setFormNotes(""); setErrors({});
    toast("Customer registered.", "success");
  };

  const startAddNew = () => {
    setIsAddingNew(true);
    setFormName(""); setFormPhone(""); setFormNotes(""); setErrors({});
  };

  const cancelAdd = () => {
    setIsAddingNew(false);
    setErrors({});
  };

  const handleExport = () => {
    if (customers.length === 0) {
      toast("No customers to export.", "warning");
      return;
    }
    const csv = [
      "Name,Phone,Notes,Registered,Created At",
      ...customers.map((c) =>
        `"${c.name}","${c.phone}","${(c.notes || "").replace(/"/g, '""')}","${new Date(c.createdAt).toLocaleDateString()}","${c.createdAt}"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diapalace-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Customer list exported.", "success");
  };

  const inputCls = (hasError?: string) =>
    `w-full rounded-xl px-3 py-2 text-xs font-semibold ${hasError ? "!border-coral/60" : ""}`;

  return (
    <div className="relative flex flex-1 flex-col gap-4 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        {/* Toolbar */}
        <div className="g-panel flex flex-col items-stretch justify-between gap-3 rounded-3xl p-4 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
              <Icon name="search" size={14} />
            </span>
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl py-2.5 pl-10 pr-4 text-[13px] font-semibold"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={customers.length === 0}
              className="btn-ghost flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[11px] font-bold"
            >
              <Icon name="download" size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={startAddNew}
              className="btn-aurora flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.14em]"
            >
              <Icon name="plus" size={14} strokeWidth={2.2} />
              <span>New Customer</span>
            </button>
          </div>
        </div>

        {/* Directory grid */}
        <div className="grid grid-cols-1 gap-3 pr-0 md:grid-cols-2 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto lg:pr-1.5">
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((c) => {
              const isSelected = selectedCustomerId === c.id;
              const txCount = transactions.filter((t) => t.customer?.id === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomerId(c.id); setIsAddingNew(false); }}
                  className={`g-panel sheen flex items-center justify-between rounded-3xl p-4 text-left transition-all duration-200 ${
                    isSelected
                      ? "!border-coral/40 shadow-[0_0_30px_-8px_rgba(251,113,133,0.4)]"
                      : "hover:-translate-y-0.5 hover:border-white/[0.18]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <GlassTile tone={avatarTone(c.id)} size={40}>
                      <span className="!text-[11px]">{c.name.substring(0, 2).toUpperCase()}</span>
                    </GlassTile>
                    <div className="min-w-0">
                      <h4 className="truncate text-[13px] font-bold text-ink">{c.name}</h4>
                      <p className="num mt-0.5 text-[10px] text-faint">{c.phone}</p>
                    </div>
                  </div>
                  <span className="pill pill-plain shrink-0">{txCount} bills</span>
                </button>
              );
            })
          ) : (
            <div className="g-panel col-span-full rounded-3xl py-16 text-center text-sm text-faint">
              {debouncedSearch ? "No customers match your search." : "No customers in directory yet."}
            </div>
          )}
        </div>
      </div>

      {/* ------- Detail / register panel ------- */}
      <div className="flex w-full flex-shrink-0 flex-col gap-4 lg:w-96">
        {isAddingNew ? (
          <div className="g-panel pop flex flex-col gap-5 rounded-[28px] p-6">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-2.5">
                <GlassTile name="plus" tone="rose" size={30} />
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink">Register Customer</h3>
              </div>
              <button onClick={cancelAdd} className="btn-ico h-8 w-8">
                <Icon name="x" size={14} />
              </button>
            </div>
            <form onSubmit={handleCustomerSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="lbl">Full name *</label>
                <input type="text" placeholder="e.g. Ama Mensah" value={formName} onChange={(e) => setFormName(e.target.value)} className={inputCls(errors.name)} />
                {errors.name && <span className="text-[10px] font-semibold text-coral">{errors.name}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="lbl">Phone number *</label>
                <input type="text" placeholder="e.g. +233 24 412 3456" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className={`num ${inputCls(errors.phone)}`} />
                {errors.phone && <span className="text-[10px] font-semibold text-coral">{errors.phone}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="lbl">Notes</label>
                <textarea placeholder="Preferences, standard sizes…" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} className="w-full resize-none rounded-xl px-3 py-2 text-xs" />
              </div>
              <button type="submit" className="btn-aurora flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[10px] font-extrabold uppercase tracking-[0.16em]">
                <Icon name="save" size={14} strokeWidth={2} /><span>Save Profile</span>
              </button>
            </form>
          </div>
        ) : activeCustomer ? (
          <div className="g-panel flex flex-col gap-5 rounded-[28px] p-6">
            <div className="border-b border-white/[0.07] pb-5">
              <div className="flex items-center gap-3.5">
                <GlassTile tone={avatarTone(activeCustomer.id)} size={50}>
                  <span className="!text-[13px]">{activeCustomer.name.substring(0, 2).toUpperCase()}</span>
                </GlassTile>
                <div className="min-w-0">
                  <h3 className="font-display truncate text-lg font-bold text-ink">{activeCustomer.name}</h3>
                  <div className="num mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                    <Icon name="phone" size={11} />
                    <span>{activeCustomer.phone}</span>
                  </div>
                </div>
              </div>
              {activeCustomer.notes && (
                <div className="g-deep mt-4 rounded-2xl p-3.5 text-[11px] italic leading-relaxed text-dim">
                  &quot;{activeCustomer.notes}&quot;
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="lbl">Purchase history</span>
                <span className="num text-[10px] text-faint">({customerTransactions.length} bills)</span>
              </div>
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                {customerTransactions.length > 0 ? (
                  customerTransactions.map((tx) => (
                    <div key={tx.id} className="g-deep flex items-center justify-between rounded-2xl p-3">
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                          <span className="num">{tx.id}</span>
                          {tx.isVoided && <span className="pill pill-coral !px-1.5 !py-0 !text-[7.5px]">Voided</span>}
                          {tx.total < 0 && <span className="pill pill-honey !px-1.5 !py-0 !text-[7.5px]">Refund</span>}
                        </div>
                        <div className="num mt-1 text-[9px] text-faint">{new Date(tx.timestamp).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className={`num text-xs font-bold ${tx.total < 0 ? "text-honey" : "text-ice"}`}>
                          {tx.total < 0 ? "−" : ""}GH₵ {Math.abs(tx.total).toFixed(2)}
                        </span>
                        <button onClick={() => onViewReceipt(tx)} className="btn-ico h-7 w-7 !rounded-lg" title="View receipt">
                          <Icon name="file" size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-[11px] text-faint">No transactions for this client.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="g-panel flex flex-col items-center rounded-[28px] p-6 py-16 text-center">
            <GlassTile name="users" tone="slate" size={52} className="glass-tile-clear opacity-50" />
            <p className="mt-4 text-xs font-bold text-dim">Select a customer</p>
            <p className="mt-1 text-[10px] text-faint">Profiles and purchase history appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
