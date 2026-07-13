"use client";

import React, { useState } from "react";
import { Plus, Users, Search, Save, Calendar, FileText, Phone, ArrowRight } from "lucide-react";
import { Customer, Transaction, db } from "../lib/db";

interface CustomersModuleProps {
  customers: Customer[];
  transactions: Transaction[];
  onCustomersChange: (newCustomers: Customer[]) => void;
  onViewReceipt: (tx: Transaction) => void;
}

export default function CustomersModule({
  customers,
  transactions,
  onCustomersChange,
  onViewReceipt
}: CustomersModuleProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    customers.length > 0 ? customers[0].id : null
  );

  // Form states
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  // Filtered customer list
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  // Filter transactions linked to selected customer
  const customerTransactions = activeCustomer
    ? transactions.filter((t) => t.customer?.id === activeCustomer.id)
    : [];

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName || !formPhone) {
      alert("Name and Phone number are required.");
      return;
    }

    const newCustomer: Customer = {
      id: `c-${Date.now()}`,
      name: formName,
      phone: formPhone,
      notes: formNotes,
      createdAt: new Date().toISOString()
    };

    const updated = [newCustomer, ...customers];
    onCustomersChange(updated);
    db.saveCustomers(updated);

    setSelectedCustomerId(newCustomer.id);
    setIsAddingNew(false);
    setFormName("");
    setFormPhone("");
    setFormNotes("");
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 relative">
      
      {/* Left Column: Customer Directory (lg:col-span-7) */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Controls Panel */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/40 p-4 border border-zinc-900 rounded-2xl">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search clients by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-400/50"
            />
          </div>
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-400 to-amber-300 hover:opacity-90 active:scale-[0.98] text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer</span>
          </button>
        </div>

        {/* Customer Directory List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((c) => {
              const isSelected = selectedCustomerId === c.id;
              const txCount = transactions.filter((t) => t.customer?.id === c.id).length;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setIsAddingNew(false);
                  }}
                  className={`glass-panel p-5 rounded-2xl border cursor-pointer hover:border-rose-400/40 transition-all duration-300 flex items-center justify-between ${
                    isSelected ? "border-violet-500/60 bg-violet-600/[0.04]" : "border-zinc-900 bg-zinc-900/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500/20 to-amber-500/10 flex items-center justify-center font-bold text-rose-300 text-xs">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">{c.name}</h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{c.phone}</p>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-950 border border-zinc-900 font-semibold text-zinc-500 uppercase">
                    {txCount} bills
                  </span>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center text-zinc-500 text-sm glass-panel rounded-2xl">
              No customers found in directory.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Add Client OR View Profile (lg:col-span-5) */}
      <div className="w-full lg:w-96 flex flex-col gap-6 flex-shrink-0">
        {isAddingNew ? (
          /* Add Customer Form */
          <div className="glass-panel p-6 rounded-3xl shadow-xl flex flex-col gap-5 border border-zinc-800/50">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Register Customer
              </h3>
              <button
                onClick={() => setIsAddingNew(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCustomerSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ama Mensah"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-rose-400/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                  Phone Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. +233 24 412 3456"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-rose-400/50"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                  Notes
                </label>
                <textarea
                  placeholder="Preferences, standard sizes, or skin considerations..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-rose-400/50 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-400 to-amber-300 hover:opacity-90 active:scale-[0.98] text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/10 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Profile</span>
              </button>
            </form>
          </div>
        ) : activeCustomer ? (
          /* Profile Details & Linked transactions */
          <div className="glass-panel p-6 rounded-3xl shadow-xl flex flex-col gap-5 border border-zinc-800/50">
            <div className="border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 flex items-center justify-center text-sm font-black text-zinc-950">
                  {activeCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">{activeCustomer.name}</h3>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
                    <Phone className="w-3 h-3" />
                    <span className="font-mono">{activeCustomer.phone}</span>
                  </div>
                </div>
              </div>
              {activeCustomer.notes && (
                <div className="mt-4 p-3 bg-zinc-950/60 rounded-xl text-[10px] text-zinc-400 leading-relaxed italic border border-zinc-900">
                  "{activeCustomer.notes}"
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                <span>Purchase History</span>
                <span className="text-zinc-600 font-mono">({customerTransactions.length} bills)</span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
                {customerTransactions.length > 0 ? (
                  customerTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-[10px] font-bold text-zinc-300 flex items-center gap-1.5">
                          <span>{tx.id}</span>
                          {tx.isVoided && (
                            <span className="text-[8px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold px-1 rounded">
                              Voided
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-zinc-500 font-mono mt-1">
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-rose-300 font-mono">
                          GH₵ {tx.total.toFixed(2)}
                        </span>
                        <button
                          onClick={() => onViewReceipt(tx)}
                          className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer border border-zinc-800"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-zinc-600 text-center py-6">
                    No transactions registered for this client.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-6 rounded-3xl text-center py-16 text-zinc-500 text-xs border border-zinc-800/50">
            Select a customer profile to review transaction logs
          </div>
        )}
      </div>

    </div>
  );
}
