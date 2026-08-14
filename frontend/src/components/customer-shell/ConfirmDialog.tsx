/*
  ORIGINAL PATH: src/components/customer-shell/ConfirmDialog.tsx

  Generic yes/no confirmation modal — used before any destructive
  action (deleting a transaction). Matches the owner app's modal
  pattern (.moverlay/.mbox from the HTML prototype) but as a component.
*/
"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", danger = true, loading = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-card p-6 fade-in shadow-card">
        <div className="text-lg font-medium text-text-primary mb-2">{title}</div>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-input border border-line py-3 text-sm text-text-primary disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-[2] rounded-input py-3 text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-60 ${
              danger ? "bg-danger hover:bg-danger-dark" : "bg-brand hover:bg-brand-dark"
            }`}
          >
            {loading && <span className="btn-spinner" />}
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}