import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  Landmark,
  Printer,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { brand } from "@/lib/brand";

const money = (amount: number) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", currencyDisplay: "symbol", maximumFractionDigits: 2 })
    .format(amount)
    .replace("GHS", "GH₵");

const DIFFERENCE_REASONS = ["Wrong change given", "Counting error", "Missing cash", "Business expense", "Refund issue", "Other"];

const DENOMINATIONS = [
  { value: 200, label: "GH₵ 200" },
  { value: 100, label: "GH₵ 100" },
  { value: 50, label: "GH₵ 50" },
  { value: 20, label: "GH₵ 20" },
  { value: 10, label: "GH₵ 10" },
  { value: 5, label: "GH₵ 5" },
  { value: 2, label: "GH₵ 2" },
  { value: 1, label: "GH₵ 1" },
  { value: 0.5, label: "50p" },
  { value: 0.2, label: "20p" },
  { value: 0.1, label: "10p" },
  { value: 0.05, label: "5p" },
];

type OpenShiftInfo = {
  id: string;
  branchId: string;
  registerId: string;
  registerName?: string;
  cashierName?: string;
  openingCash: number;
  openedAt: string;
  status: "OPEN" | "CLOSED";
};

type ExpectedInfo = {
  totalSales: number;
  cashSales: number;
  cashRefunds: number;
  expectedCash: number;
  breakdown: Array<{ method: string; expected: number }>;
};

type ClosingRow = {
  id: string;
  shiftId: string;
  registerId: string;
  registerName: string;
  cashierName: string;
  openingCash: number;
  totalSales: number;
  cashRefunds: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  breakdown: Array<{ method: string; expected: number; counted: number }>;
  reason: string;
  explanation: string;
  status: "CLOSED" | "SHORT" | "OVER";
  closedAt: string;
  acknowledged: boolean;
  acknowledgedBy: string;
  acknowledgedNote: string;
  reopened: boolean;
  reopenedReason: string;
};

type ShiftContext = {
  branchId: string;
  branchName: string;
  registers: Array<{ id: string; name: string }>;
  paymentMethods: string[];
  openShifts: OpenShiftInfo[];
  closings: ClosingRow[];
  current: { shift: OpenShiftInfo | null; expected: ExpectedInfo | null };
  canOpenShift: boolean;
  canReopen: boolean;
  canAcknowledge: boolean;
};

type ClosingResult = {
  duplicate: boolean;
  closing: {
    id: string;
    shiftId: string;
    openingCash: number;
    totalSales: number;
    cashRefunds: number;
    expectedCash: number;
    countedCash: number;
    difference: number;
    breakdown: Array<{ method: string; expected: number; counted: number }>;
    reason: string;
    explanation: string;
    status: "CLOSED" | "SHORT" | "OVER";
    closedAt: string;
  };
};

function authHeaders(token: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusPill({ tone, children }: { tone: "success" | "danger" | "warning" | "neutral" | "blue"; children: React.ReactNode }) {
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{children}</span>;
}

export function CashUpView({ branchId, userRole, userName, token, onNotify, onShiftChanged }: {
  branchId: string;
  userRole: string;
  userName: string;
  token: string | null;
  onNotify: (message: string) => void;
  onShiftChanged: () => void;
}) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [context, setContext] = useState<ShiftContext | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastClosing, setLastClosing] = useState<ClosingResult | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch(`/api/shifts?branchId=${encodeURIComponent(branchId)}`, { headers: authHeaders(token) });
      const data = (await response.json()) as ShiftContext & { error?: string };
      if (!response.ok) {
        setError(data.error || "We couldn't load this shift.");
        setState("error");
        return;
      }
      setContext(data);
      setState("ready");
    } catch {
      setError("We couldn't load today's shift. Check your connection and try again.");
      setState("error");
    }
  }, [branchId, token]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  useEffect(() => {
    if (state !== "ready") return;
    const interval = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(interval);
  }, [state, load]);

  const afterChange = (message: string) => {
    onNotify(message);
    onShiftChanged();
    setReloadKey((key) => key + 1);
  };

  const handleClosed = (result: ClosingResult) => {
    setLastClosing(result);
    afterChange(result.duplicate ? "This cash-up was already saved. Your count was not submitted again." : result.closing.difference < 0 ? `Shift closed. Cash shortage of ${money(Math.abs(result.closing.difference))} reported to your owner.` : result.closing.difference > 0 ? `Shift closed. Cash overage of ${money(result.closing.difference)} reported to your owner.` : "Shift closed. Everything matches.");
  };

  if (state === "loading") {
    return (
      <>
        <PageHeader eyebrow="End of shift" title="Close Shift" description="Count the register, reconcile every payment method, and close the shift." />
        <section className="panel cashup-state"><span className="spinner" /><p>Loading today&apos;s shift…</p></section>
      </>
    );
  }

  if (state === "error") {
    return (
      <>
        <PageHeader eyebrow="End of shift" title="Close Shift" description="Count the register, reconcile every payment method, and close the shift." />
        <section className="panel cashup-state">
          <CircleAlert size={26} className="cashup-state-icon error" />
          <h2>We couldn&apos;t load this shift</h2>
          <p>{error}</p>
          <button className="button primary" onClick={() => void load()}><RefreshCcw size={16} /> Try again</button>
        </section>
      </>
    );
  }

  if (!context) return null;

  const headerAction = <div className="cashup-header-actions"><StatusPill tone={context.current?.shift ? "success" : "neutral"}>{context.current?.shift ? "Shift open" : "No active shift"}</StatusPill><button className="button secondary" aria-label="Refresh shift" onClick={() => setReloadKey((key) => key + 1)}><RefreshCcw size={15} /> Refresh</button></div>;

  return (
    <>
      <PageHeader eyebrow="End of shift" title="Close Shift" description="Count the register, reconcile every payment method, and close the shift." action={headerAction} />
      {lastClosing ? (
        <ClosingSuccess
          result={lastClosing}
          userName={userName}
          userRole={userRole}
          branchName={context.branchName}
          registerName={context.current?.shift?.registerName || context.openShifts[0]?.registerName || "Register"}
          onDone={() => setLastClosing(null)}
        />
      ) : context.current?.shift ? (
        <ShiftWorksheet
          key={context.current.shift.id}
          context={context}
          userName={userName}
          userRole={userRole}
          token={token}
          onClosed={handleClosed}
        />
      ) : context.canOpenShift ? (
        <OpenShiftForm context={context} token={token} onOpened={() => afterChange("Shift opened. Start selling — your expected figures will update automatically.")} />
      ) : (
        <section className="panel cashup-state">
          <Clock3 size={26} className="cashup-state-icon" />
          <h2>No active shift</h2>
          <p>Another cashier is handling this register. You can only close a shift you opened yourself.</p>
        </section>
      )}
      <ClosingHistory context={context} userRole={userRole} token={token} onChanged={afterChange} />
    </>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-sub">{description}</p></div>{action && <div className="page-actions">{action}</div>}</div>;
}

function OpenShiftForm({ context, token, onOpened }: { context: ShiftContext; token: string | null; onOpened: () => void }) {
  const [registerId, setRegisterId] = useState(context.registers[0]?.id || "");
  const [openingCash, setOpeningCash] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleOpen = async () => {
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/shifts", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ branchId: context.branchId, registerId, openingCash: Number(openingCash) || 0 }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "The shift could not be opened. No changes were made.");
        return;
      }
      setSaved(true);
      onOpened();
    } catch {
      setError("We couldn't open the shift. No changes were made. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (saved) return <section className="panel cashup-state"><CheckCircle2 size={26} className="cashup-state-icon success" /><h2>Shift opened</h2><p>Loading your register worksheet…</p></section>;

  return (
    <section className="panel cashup-main">
      <div className="cashup-title"><span className="section-icon"><Landmark size={22} /></span><div><h2>Open a shift at {context.branchName}</h2><p>No shift is currently open for you at this branch.</p></div></div>
      {error && <div className="auth-error">{error}</div>}
      <div className="form-grid">
        {context.registers.length > 1 && (
          <label>Register<select value={registerId} onChange={(event) => setRegisterId(event.target.value)}>{context.registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label>
        )}
        <label>Opening cash (GH₵)<input type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} placeholder="e.g. 250" /></label>
      </div>
      <p className="modal-note">The opening cash is added to your cash sales when the system works out expected cash at closing time.</p>
      <div className="cashup-actions">
        <button className="button primary" disabled={saving || !openingCash || Number(openingCash) < 0} onClick={() => void handleOpen()}>{saving ? "Opening shift…" : "Open shift"} <ArrowRight size={17} /></button>
      </div>
    </section>
  );
}

function ShiftWorksheet({ context, userName, userRole, token, onClosed }: {
  context: ShiftContext;
  userName: string;
  userRole: string;
  token: string | null;
  onClosed: (result: ClosingResult) => void;
}) {
  const shift = context.current.shift!;
  const expected = context.current.expected!;
  const [countedCash, setCountedCash] = useState("");
  const [denominations, setDenominations] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ClosingResult | null>(null);
  const submissionIdRef = useRef<string | null>(null);

  const counted = Number(countedCash) || 0;
  const difference = Math.round((counted - expected.expectedCash) * 100) / 100;

  const quickCount = Object.entries(denominations).reduce((sum, [value, count]) => sum + Number(value) * (Number(count) || 0), 0);

  const handleClose = async () => {
    if (saving) return;
    if (difference !== 0 && !DIFFERENCE_REASONS.includes(reason)) {
      setError("Please select a reason for the difference before closing the shift.");
      return;
    }
    if (difference !== 0 && !explanation.trim()) {
      setError("Please explain the difference before closing the shift.");
      return;
    }
    setError("");
    setSaving(true);
    if (!submissionIdRef.current) submissionIdRef.current = `sub-${crypto.randomUUID()}`;
    try {
      const response = await fetch("/api/shifts/close", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          shiftId: shift.id,
          countedCash: counted,
          countedBreakdown: expected.breakdown.map((item) => ({ method: item.method, counted: item.method === "Cash" ? counted : item.expected })),
          differenceReason: reason,
          differenceExplanation: explanation.trim(),
          submissionId: submissionIdRef.current,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Cash-up could not be saved. No changes were made.");
        return;
      }
      setResult(data as ClosingResult);
      onClosed(data as ClosingResult);
    } catch {
      setError("Cash-up could not be saved. No changes were made. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (result) return <ClosingSuccess result={result} userName={userName} userRole={userRole} branchName={context.branchName} registerName={shift.registerName || "Register"} />;

  const diffTone = difference === 0 ? "even" : difference > 0 ? "over" : "short";
  const diffLabel = difference === 0 ? "Everything matches" : difference > 0 ? "Over" : "SHORTAGE";

  return (
    <>
      <div id="cashup-print" className="cashup-layout">
        <section className="panel cashup-main">
          <div className="cashup-title"><span className="section-icon"><Landmark size={22} /></span><div><h2>{shift.registerName || "Register"} · Shift Closing</h2><p>{userName} ({userRole}) · Opened {formatDateTime(shift.openedAt)}</p></div></div>
          <div className="cashup-breakdown">
            <div><span>Opening cash</span><strong>{money(shift.openingCash)}</strong><small>Cash in drawer at open</small></div>
            <div><span>Cash sales</span><strong>{money(expected.cashSales)}</strong><small>Paid Cash sales this shift (read-only)</small></div>
            <div><span>Cash refunds</span><strong>{money(expected.cashRefunds)}</strong><small>Approved Cash refunds this shift (read-only)</small></div>
            <div className="expected"><span>Expected cash</span><strong>{money(expected.expectedCash)}</strong><small>Opening + cash sales − refunds</small></div>
          </div>
          {expected.breakdown.filter((item) => item.method !== "Cash").length > 0 && (
            <div className="cashup-methods">
              <p className="eyebrow">Other payment methods</p>
              {expected.breakdown.filter((item) => item.method !== "Cash").map((item) => (
                <div key={item.method}><span>{item.method}</span><strong>{money(item.expected)}</strong><small>Reconcile against your statement</small></div>
              ))}
            </div>
          )}
          <div className="cash-count">
            <label>Physical cash counted (GH₵)<input type="number" min="0" step="0.01" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="Enter physical cash in drawer" /></label>
            <div className={`variance ${countedCash ? diffTone : "empty"}`}>
              <span>{countedCash ? diffLabel : "Awaiting count"}</span>
              <strong>{countedCash ? `${difference >= 0 ? "+" : "−"} ${money(Math.abs(difference))}` : "—"}</strong>
            </div>
          </div>
          <div className="cashup-denominations">
            <p className="eyebrow">Quick count</p>
            <div className="denom-grid">
              {DENOMINATIONS.map((denomination) => (
                <label key={denomination.value}><span>{denomination.label}</span><input type="number" min="0" value={denominations[denomination.value] ?? ""} onChange={(event) => setDenominations((current) => ({ ...current, [denomination.value]: event.target.value }))} placeholder="0" /></label>
              ))}
            </div>
            <div className="denom-total">
              <span>Total from quick count</span>
              <strong>{money(quickCount)}</strong>
              <button className="text-button" onClick={() => setCountedCash(String(quickCount))}>Use this as the counted cash</button>
            </div>
          </div>
          {difference !== 0 && (
            <div className={`diff-alert ${diffTone}`}>
              {difference < 0 ? <AlertTriangle size={18} /> : <CircleAlert size={18} />}
              <div>
                <strong>{diffLabel}: {money(Math.abs(difference))}</strong>
                <small>{difference < 0 ? "The drawer is short. Provide a reason and explanation — the owner will be notified." : "The drawer has more cash than expected. Provide a reason and explanation — the owner will be notified."}</small>
              </div>
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          <div className="cashup-actions">
            <button className="button secondary" onClick={() => window.print()}><Printer size={17} /> Print worksheet</button>
            <button className="button primary" disabled={!countedCash || saving} onClick={() => void handleClose()}>{saving ? "Closing shift…" : "Close shift"} <ArrowRight size={17} /></button>
          </div>
        </section>
        <aside className="panel cashup-side">
          <p className="eyebrow">Anti-fraud rules</p>
          <h2>Strict reconciliation</h2>
          <ul className="check-list">
            <li><span className="check okay"><Check size={15} /></span><span><strong>Immutable expected totals</strong><small>Expected figures come from paid sales recorded in the database</small></span></li>
            <li><span className="check okay"><Check size={15} /></span><span><strong>Automatic shortage logging</strong><small>Differences trigger an audit entry and an owner alert</small></span></li>
            <li><span className="check pending"><CircleAlert size={15} /></span><span><strong>Reason required</strong><small>A difference can only be closed with a reason and an explanation</small></span></li>
          </ul>
        </aside>
      </div>
    </>
  );
}

function ClosingSuccess({ result, userName, userRole, branchName, registerName, onDone }: { result: ClosingResult; userName: string; userRole: string; branchName: string; registerName: string; onDone?: () => void }) {
  const closing = result.closing;
  const tone = closing.difference === 0 ? "success" : closing.difference < 0 ? "danger" : "warning";
  return (
    <div id="cashup-print">
      <section className="panel closing-summary">
        <div className="closing-summary-head">
          <span className="section-icon"><ShieldCheck size={22} /></span>
          <div>
            <p className="eyebrow">Cash-up completed</p>
            <h2>{closing.difference === 0 ? "Everything matches" : closing.difference < 0 ? `Cash shortage of ${money(Math.abs(closing.difference))}` : `Cash overage of ${money(closing.difference)}`}</h2>
            <p className="page-sub">{branchName} · {registerName} · Closed {formatDateTime(closing.closedAt)}</p>
          </div>
          <StatusPill tone={tone}>{closing.status}</StatusPill>
        </div>
        <div className="cashup-breakdown closing-figures">
          <div><span>Opening cash</span><strong>{money(closing.openingCash)}</strong></div>
          <div><span>Total sales</span><strong>{money(closing.totalSales)}</strong></div>
          <div><span>Cash refunds</span><strong>{money(closing.cashRefunds)}</strong></div>
          <div><span>Expected cash</span><strong>{money(closing.expectedCash)}</strong></div>
          <div><span>Cash counted</span><strong>{money(closing.countedCash)}</strong></div>
          <div className="expected"><span>Difference</span><strong>{closing.difference >= 0 ? "+" : "−"} {money(Math.abs(closing.difference))}</strong></div>
        </div>
        {closing.difference !== 0 && (
          <div className="closing-notes">
            <p><strong>Reason:</strong> {closing.reason}</p>
            <p><strong>Explanation:</strong> {closing.explanation}</p>
            <p className="muted">The owner and managers have been notified of this difference. Closing cashier: {userName} ({userRole}).</p>
          </div>
        )}
        <div className="cashup-actions">
          {onDone && <button className="button secondary" onClick={onDone}>Done</button>}
          <button className="button secondary" onClick={() => window.print()}><Printer size={17} /> Print summary</button>
          <button className="button secondary" onClick={() => downloadSummaryPdf({ result, userName, branchName, registerName })}><Download size={17} /> Download summary (PDF)</button>
        </div>
      </section>
    </div>
  );
}

function ClosingHistory({ context, userRole, token, onChanged }: { context: ShiftContext; userRole: string; token: string | null; onChanged: (message: string) => void }) {
  const [targetReopen, setTargetReopen] = useState<ClosingRow | null>(null);
  const [targetAcknowledge, setTargetAcknowledge] = useState<ClosingRow | null>(null);

  if (context.closings.length === 0) {
    return <section className="panel cashup-state"><Clock3 size={26} className="cashup-state-icon" /><h2>No closed shifts yet</h2><p>Closed cash-ups for this branch will appear here with their expected, counted, and difference figures.</p></section>;
  }

  return (
    <section className="panel table-panel">
      <div className="panel-toolbar"><div><p className="eyebrow">Cash-up history</p><h2>Closed shifts · {context.branchName}</h2></div></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Closed</th><th>Register</th><th>Cashier</th><th>Expected</th><th>Counted</th><th>Difference</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {context.closings.map((closing) => (
              <tr key={closing.id}>
                <td className="mono">{formatDateTime(closing.closedAt)}</td>
                <td>{closing.registerName}</td>
                <td>{closing.cashierName}</td>
                <td className="strong-number">{money(closing.expectedCash)}</td>
                <td className="strong-number">{money(closing.countedCash)}</td>
                <td className={`strong-number ${closing.difference < 0 ? "neg" : closing.difference > 0 ? "pos" : ""}`}>{closing.difference >= 0 ? "+" : "−"} {money(Math.abs(closing.difference))}</td>
                <td>
                  <div className="history-badges">
                    <StatusPill tone={closing.status === "CLOSED" ? "success" : closing.status === "SHORT" ? "danger" : "warning"}>{closing.status}</StatusPill>
                    {closing.acknowledged && <StatusPill tone="blue">Acknowledged{closing.acknowledgedBy ? ` by ${closing.acknowledgedBy}` : ""}</StatusPill>}
                    {closing.reopened && <StatusPill tone="neutral">Reopened</StatusPill>}
                  </div>
                  {closing.explanation && <small className="history-note">{closing.explanation}</small>}
                </td>
                <td>
                  <div className="history-actions">
                    {!closing.acknowledged && closing.difference !== 0 && !closing.reopened && context.canAcknowledge && <button className="text-button" onClick={() => setTargetAcknowledge(closing)}>Acknowledge</button>}
                    {!closing.reopened && context.canReopen && <button className="text-button danger" onClick={() => setTargetReopen(closing)}>Reopen</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {targetReopen && <ReopenModal closing={targetReopen} token={token} onClose={() => setTargetReopen(null)} onDone={(message) => { setTargetReopen(null); onChanged(message); }} />}
      {targetAcknowledge && <AcknowledgeModal closing={targetAcknowledge} token={token} onClose={() => setTargetAcknowledge(null)} onDone={(message) => { setTargetAcknowledge(null); onChanged(message); }} />}
    </section>
  );
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="cashup-modal-title"><div className="modal-head"><div>{eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}<h2 id="cashup-modal-title">{title}</h2></div><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}</section></div>;
}

function ReopenModal({ closing, token, onClose, onDone }: { closing: ClosingRow; token: string | null; onClose: () => void; onDone: (message: string) => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleReopen = async () => {
    if (!reason.trim()) { setError("Please explain why you are reopening this shift."); return; }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/shifts/reopen", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ closingId: closing.id, reason: reason.trim() }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) { setError(data.error || "The shift could not be reopened. No changes were made."); return; }
      onDone("Shift reopened. A new cash count is required before it can be closed again.");
    } catch {
      setError("The shift could not be reopened. No changes were made.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Reopen this shift?" eyebrow="Owner action" onClose={onClose}>
      <div style={{ padding: "1.35rem" }}>
        <div className="diff-alert short"><AlertTriangle size={18} /><div><strong>Reopening lets a new cash count replace this closing.</strong><small>The previous closing stays in the history. The shift's expected figures continue from its original opening time. A difference of {money(Math.abs(closing.difference))} was previously reported.</small></div></div>
        {error && <div className="auth-error">{error}</div>}
        <label style={{ marginTop: "1rem" }}>Reason for reopening<input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Cashier found the remaining cash after closing" /></label>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={saving || !reason.trim()} onClick={() => void handleReopen()}>{saving ? "Reopening…" : "Reopen shift"}</button>
      </div>
    </Modal>
  );
}

function AcknowledgeModal({ closing, token, onClose, onDone }: { closing: ClosingRow; token: string | null; onClose: () => void; onDone: (message: string) => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAcknowledge = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/shifts/acknowledge", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ closingId: closing.id, note: note.trim() }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) { setError(data.error || "The cash-up could not be acknowledged. No changes were made."); return; }
      onDone("Cash difference acknowledged. This cash-up is now marked as resolved.");
    } catch {
      setError("The cash-up could not be acknowledged. No changes were made.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Acknowledge cash difference" eyebrow="Resolve the variance" onClose={onClose}>
      <div style={{ padding: "1.35rem" }}>
        <p style={{ fontSize: ".85rem", color: "var(--muted)" }}>This marks the {money(Math.abs(closing.difference))} {closing.difference < 0 ? "shortage" : "overage"} on {formatDateTime(closing.closedAt)} as reviewed and resolved.</p>
        {error && <div className="auth-error">{error}</div>}
        <label style={{ marginTop: "1rem" }}>Review note (optional)<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Cashier verified and corrected the drawer balance" /></label>
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Cancel</button>
        <button className="button primary" disabled={saving} onClick={() => void handleAcknowledge()}>{saving ? "Acknowledging…" : "Acknowledge difference"}</button>
      </div>
    </Modal>
  );
}

function downloadSummaryPdf({ result, userName, branchName, registerName }: { result: ClosingResult; userName: string; branchName: string; registerName: string }) {
  const closing = result.closing;
  const lines = [
    brand.businessName,
    "Shift Cash-Up Summary",
    `${branchName} · ${registerName}`,
    "",
    `Closed:    ${formatDateTime(closing.closedAt)}`,
    `Cashier:   ${userName}`,
    "",
    `Opening cash:  GHS ${closing.openingCash.toFixed(2)}`,
    `Total sales:   GHS ${closing.totalSales.toFixed(2)}`,
    `Cash refunds:  GHS ${closing.cashRefunds.toFixed(2)}`,
    `Expected cash: GHS ${closing.expectedCash.toFixed(2)}`,
    `Cash counted:  GHS ${closing.countedCash.toFixed(2)}`,
    `Difference:    ${closing.difference >= 0 ? "+" : "-"} GHS ${Math.abs(closing.difference).toFixed(2)}`,
    `Status:    ${closing.status}`,
    "",
    `Reason: ${closing.reason || "-"}`,
    `Explanation: ${closing.explanation || "-"}`,
    "",
    "Thank you for reconciling today.",
  ];
  const pdf = buildTextPdf(lines);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cashup-summary-${closing.closedAt.slice(0, 10)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapePdfText(text: string) {
  return text
    .replace(/[^\x20-\x7E]/g, (char) => (char.charCodeAt(0) <= 0xFF ? char : "?"))
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildTextPdf(lines: string[]) {
  const font = "/F1 11 Tf";
  const lineHeight = 15;
  const margin = 56;
  const height = 842;
  let y = height - margin;
  const content: string[] = [];
  for (const line of lines) {
    if (line === "") y -= 6;
    else if (y >= margin) content.push(`BT ${font} ${lineHeight} TL ${margin} ${y.toFixed(2)} Td (${escapePdfText(line)}) Tj ET`);
    y -= lineHeight;
  }
  const stream = `${content.join("\n")}\n`;
  const offsets: number[] = [];
  let out = "%PDF-1.4\n";
  const push = (obj: string) => { offsets.push(out.length); out += obj; };
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n");
  push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  push(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  const xrefStart = out.length;
  const objectCount = offsets.length + 1;
  out += `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return out;
}
