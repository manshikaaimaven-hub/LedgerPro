"use client";

import { IconRotateClockwise2, IconClockHour4 } from "@tabler/icons-react";
import { formatINR, formatDate } from "@/lib/format";
import type { DeletedTransaction } from "@/types/transaction";

interface DeletedTransactionCardProps {
  txn: DeletedTransaction;
  onRequestRestore: () => void;
}

export function DeletedTransactionCard({ txn, onRequestRestore }: DeletedTransactionCardProps) {
  const isCredit = txn.type === "cr";

  return (
    <div className="bg-white border border-line rounded-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className={`text-xs font-medium w-fit rounded-input px-2 py-0.5 ${
              isCredit ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {isCredit ? "Credit" : "Debit"}
          </span>
          <span className="text-lg font-semibold text-text-primary">
            {formatINR(txn.amount)}
          </span>
        </div>

        {txn.already_requested ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-brand-light/60 rounded-input px-3 py-2 shrink-0">
            <IconClockHour4 size={14} />
            Restore requested
          </span>
        ) : (
          <button
            onClick={onRequestRestore}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-dark bg-brand-light rounded-input px-3 py-2 shrink-0"
          >
            <IconRotateClockwise2 size={14} />
            Request restore
          </button>
        )}
      </div>

      {(txn.note || txn.invoice_number || !txn.deleted_at) && (
        <div className="flex flex-col gap-0.5 text-sm text-text-secondary">
          {txn.note && <span className="truncate">{txn.note}</span>}
          {txn.invoice_number && <span className="text-xs">Invoice #{txn.invoice_number}</span>}
          {!txn.deleted_at && <span className="text-xs text-warning">Edited transaction</span>}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-text-secondary border-t border-line pt-2">
        <span>Entry: {formatDate(txn.entry_date)}</span>
        {txn.deleted_at ? <span>Deleted: {formatDate(txn.deleted_at)}</span> : null}
      </div>
      </div>
  );
}