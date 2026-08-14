/*
  ORIGINAL PATH: src/components/customer-shell/TransactionCard.tsx

  One row in the transactions list. Mobile-card style (not a table —
  no horizontal room in a 430px frame for columns). Tapping the card
  opens a detail/edit sheet; a small trash icon triggers delete.
*/
"use client";

import { IconEdit, IconTrash, IconFileText } from "@tabler/icons-react";
import { formatINR } from "@/lib/format";
import type { CustomerTransaction } from "@/services/customerDashboardService";

interface TransactionCardProps {
  txn: CustomerTransaction;
  onEdit: () => void;
  onDelete: () => void;
}

export function TransactionCard({ txn, onEdit, onDelete }: TransactionCardProps) {
  const isCredit = txn.type === "cr";

  return (
    <div className="bg-white border border-line rounded-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isCredit ? "bg-success-light text-success" : "bg-danger-light text-danger"
          }`}
        >
          <i className={`ti ${isCredit ? "ti-arrow-down-circle" : "ti-arrow-up-circle"} text-lg`} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm text-text-primary font-medium truncate">
                {txn.note || (isCredit ? "Credit note" : "Debit note")}
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                {new Date(txn.entry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div className={`text-sm font-semibold shrink-0 ${isCredit ? "text-success" : "text-danger"}`}>
              {isCredit ? "+" : "-"}
              {formatINR(txn.amount)}
            </div>
          </div>

          {txn.invoice_number && (
            <div className="flex items-center gap-1 text-xs text-text-tertiary mt-1.5">
              <IconFileText size={13} />
              Invoice #{txn.invoice_number}
            </div>
          )}

          {typeof txn.running_balance === "number" && (
            <div className="text-xs text-text-tertiary mt-1">
              Balance after: <span className="font-medium text-text-secondary">{formatINR(txn.running_balance)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-line">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-input border border-line py-2 text-xs font-medium text-text-secondary hover:bg-page transition-colors"
        >
          <IconEdit size={14} /> Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-input border border-danger/25 bg-danger-light py-2 text-xs font-medium text-danger-dark hover:bg-danger-light/70 transition-colors"
        >
          <IconTrash size={14} /> Delete
        </button>
      </div>
    </div>
  );
}