"use client";

import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { TypeSelector } from "@/components/entry/TypeSelector";
import { CustomerAutocomplete } from "@/components/entry/CustomerAutocomplete";
import { createTransaction } from "@/services/transactionService";
import type { Customer } from "@/types/customer";
import type { TransactionType } from "@/types/transaction";

function formatCurrency(n: number): string {
  return "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Stat-card style field wrapper — colored left border + circular icon badge,
// matching the Ledger Summary cards (net outstanding / total credit / etc).
type Accent = "success" | "danger" | "gold" | "info";

const ACCENT_STYLES: Record<Accent, { border: string; iconBg: string; iconText: string; iconBorder: string; cardBg: string }> = {
  success: { border: "border-l-success", iconBg: "bg-white", iconText: "text-success", iconBorder: "border-success/25", cardBg: "bg-success-light" },
  danger:  { border: "border-l-danger",  iconBg: "bg-white", iconText: "text-danger",  iconBorder: "border-danger/25",  cardBg: "bg-danger-light" },
  gold:    { border: "border-l-gold",    iconBg: "bg-white", iconText: "text-gold-dark", iconBorder: "border-gold/25", cardBg: "bg-gold-light" },
  info:    { border: "border-l-info",    iconBg: "bg-white", iconText: "text-info",    iconBorder: "border-info/25",    cardBg: "bg-info-light" },
};

function FieldCard({
  icon,
  label,
  accent,
  children,
}: {
  icon: string;
  label: React.ReactNode;
  accent: Accent;
  children: React.ReactNode;
}) {
  const s = ACCENT_STYLES[accent];
  return (
    <div className={`rounded-xl border border-line border-l-[3px] ${s.border} ${s.cardBg} p-3.5`}>
      <div className="mb-2 flex items-center gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border ${s.iconBorder} ${s.iconBg} ${s.iconText}`}>
          <i className={`ti ${icon} text-lg`} aria-hidden="true" />
        </div>
        <span className="text-[13px] font-medium text-text-secondary">{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function NewEntryPage() {
  const [type, setType] = useState<TransactionType>("cr");
  const [partyName, setPartyName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [note, setNote] = useState("");
  const [entryDate, setEntryDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const numericAmount = parseFloat(amount) || 0;
  const showPreview = partyName.trim() !== "" && numericAmount > 0;
  const isCredit = type === "cr";
  const amountAccent: Accent = isCredit ? "success" : "danger";

  function handlePartyNameChange(name: string) {
    setPartyName(name);
    if (selectedCustomer && name !== selectedCustomer.name) {
      setSelectedCustomer(null);
    }
  }

  async function handleSave() {
    setFormError(null);
    const trimmedName = partyName.trim();

    if (!trimmedName) {
      setFormError("Enter a customer name to continue.");
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }

    setSaving(true);
    try {
      const customerId = selectedCustomer?.id;
      if (!customerId) {
        setFormError("This customer isn't in your list yet — add them from the Customers page first.");
        setSaving(false);
        return;
      }

      await createTransaction({
        customer_id: customerId,
        type,
        amount: numericAmount,
        note: note.trim() || undefined,
        invoice_number: invoiceNumber.trim() || undefined,
        entry_date: entryDate,
      });

      setToast(`${isCredit ? "Credit" : "Debit"} note saved for ${trimmedName}`);
      setTimeout(() => setToast(null), 3000);

      setPartyName("");
      setSelectedCustomer(null);
      setAmount("");
      setInvoiceNumber("");
      setNote("");
      setEntryDate(todayISO());
    } catch {
      setFormError("Couldn't save this entry. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppShell title="New entry" subtitle="Create credit or debit note">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {toast && (
            <div className="fade-in flex items-center gap-2 rounded-[10px] bg-success px-4 py-3 text-sm font-medium text-white shadow-glow-success">
              <i className="ti ti-circle-check text-lg" aria-hidden="true" />
              <span>{toast}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-secondary">
            <i className="ti ti-file-invoice" aria-hidden="true" />
            Select entry type
          </div>

          <TypeSelector value={type} onChange={setType} />

          <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-[18px] shadow-card">
            <CustomerAutocomplete
              value={partyName}
              onChange={handlePartyNameChange}
              onSelect={(c) => {
                setSelectedCustomer(c);
                setPartyName(c.name);
              }}
            />

            <FieldCard icon="ti-currency-rupee" label="Amount" accent={amountAccent}>
              <div className="relative">
                <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 font-display text-lg text-text-tertiary">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="field-input border-none bg-white pl-14 shadow-sm"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </FieldCard>

            <FieldCard
              icon="ti-file-text"
              label={<>Invoice number <span className="text-text-tertiary">(optional)</span></>}
              accent="gold"
            >
              <input
                className="field-input border-none bg-white shadow-sm"
                placeholder="e.g. INV-1042"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </FieldCard>

            <FieldCard icon="ti-calendar" label="Entry date" accent="info">
              <input
                type="date"
                max={todayISO()}
                className="field-input border-none bg-white shadow-sm"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </FieldCard>

            <FieldCard icon="ti-notes" label="Notes / narration" accent={amountAccent}>
              <textarea
                rows={2}
                className="field-input resize-none border-none bg-white shadow-sm"
                placeholder="Invoice details, reference…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </FieldCard>

            {/* --- Signature element: torn ledger voucher stub --- */}
            {showPreview && (
              <div className={`voucher-stub fade-in rounded-xl ${isCredit ? "voucher-stub--credit" : "voucher-stub--debit"}`}>
                <div className="flex items-center gap-3 px-4 pt-3.5">
                  <div
                    className={`stamp-badge flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed text-xl ${
                      isCredit ? "border-success text-success" : "border-danger text-danger"
                    }`}
                  >
                    <i className={`ti ${isCredit ? "ti-arrow-down-circle" : "ti-arrow-up-circle"}`} aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        isCredit ? "text-success-dark" : "text-danger-dark"
                      }`}
                    >
                      {isCredit ? "Credit note" : "Debit note"}
                    </div>
                    <div className="text-sm font-medium text-text-primary">{partyName}</div>
                  </div>
                </div>

                <div className="voucher-stub__tear my-3.5" aria-hidden="true" />

                <div className="flex items-center justify-between px-4 pb-3.5">
                  <span className="text-[11px] text-text-tertiary">
                    {entryDate}
                    {invoiceNumber.trim() && ` · ${invoiceNumber.trim()}`}
                  </span>
                  <span className={`font-display text-2xl ${isCredit ? "text-success-dark" : "text-danger-dark"}`}>
                    {(isCredit ? "+" : "−") + formatCurrency(numericAmount)}
                  </span>
                </div>
              </div>
            )}

            {formError && (
              <div className="flex items-center justify-center gap-1.5 text-[13px] text-danger">
                <i className="ti ti-alert-circle" aria-hidden="true" />
                {formError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={[
                "flex items-center justify-center gap-2 rounded-[10px] py-3.5 text-base font-medium text-white transition-colors disabled:opacity-60",
                isCredit ? "bg-success hover:bg-success-dark" : "bg-danger hover:bg-danger-dark",
              ].join(" ")}
            >
              {saving ? (
                <span className="btn-spinner" aria-hidden="true" />
              ) : (
                <i className="ti ti-device-floppy text-xl" aria-hidden="true" />
              )}
              {saving ? "Saving…" : `Save ${isCredit ? "credit" : "debit"} entry`}
            </button>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}