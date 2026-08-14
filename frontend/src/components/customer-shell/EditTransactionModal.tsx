"use client";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";
import type { CustomerTransaction } from "@/services/customerDashboardService";

interface EditTransactionModalProps {
  txn: CustomerTransaction | null;
  saving: boolean;
  onSave: (note: string, invoiceNumber: string, amount: number, type: "cr" | "dr") => void;
  onClose: () => void;
}

export function EditTransactionModal({ txn, saving, onSave, onClose }: EditTransactionModalProps) {
  const [note, setNote] = useState(txn?.note || "");
  const [invoiceNumber, setInvoiceNumber] = useState(txn?.invoice_number || "");
  const [amount, setAmount] = useState(txn?.amount?.toString() || "");
  const [type, setType] = useState<"cr" | "dr">(txn?.type as "cr" | "dr" || "cr");

  if (!txn) return null;

  const amountChanged = parseFloat(amount) !== txn.amount || type !== txn.type;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-card p-6 fade-in shadow-card">
        <div className="flex items-center justify-between mb-5">
          <div className="text-lg font-medium text-text-primary">Edit transaction</div>
          <button onClick={onClose} className="text-text-tertiary" aria-label="Close">
            <IconX size={20} />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setType("cr")}
            className={`flex-1 rounded-input py-2.5 text-sm font-medium border ${type === "cr" ? "bg-brand-light border-brand text-brand-dark" : "border-line text-text-secondary"}`}
          >
            Credit
          </button>
          <button
            onClick={() => setType("dr")}
            className={`flex-1 rounded-input py-2.5 text-sm font-medium border ${type === "dr" ? "bg-brand-light border-brand text-brand-dark" : "border-line text-text-secondary"}`}
          >
            Debit
          </button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Amount</label>
          <input
            className="field-input"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Notes / narration</label>
          <textarea
            className="field-input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Invoice details, reference…"
          />
        </div>

        <div className="mb-6">
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Invoice number</label>
          <input
            className="field-input"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="e.g. INV-1042"
          />
        </div>

        {amountChanged && !txn.amount_edited && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-input px-3 py-2 mb-4">
            Changing the amount or type replaces the original entry. The original value will be saved so you can request a restore later.
          </p>
        )}

        <div className="flex gap-2.5">
          <button onClick={onClose} disabled={saving} className="flex-1 rounded-input border border-line py-3 text-sm text-text-primary disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={() => onSave(note, invoiceNumber, parseFloat(amount), type)}
            disabled={saving || !amount}
            className="flex-[2] rounded-input bg-brand hover:bg-brand-dark py-3 text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <span className="btn-spinner" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}