"use client";

import { useEffect, useState, useCallback } from "react";
import CustomerProtectedRoute from "@/components/customer-shell/CustomerProtectedRoute";
import { CustomerShell } from "@/components/customer-shell/CustomerShell";
import { DeletedTransactionCard } from "@/components/customer-shell/DeletedTransactionCard";
import { ConfirmDialog } from "@/components/customer-shell/ConfirmDialog";
import { Toast, type ToastState } from "@/components/customer-shell/Toast";
import { TransactionListSkeleton } from "@/components/customer-shell/TransactionSkeleton";
import { EmptyState } from "@/components/customer-shell/EmptyState";
import { getCurrentBusiness } from "@/lib/currentBusiness";
import {
  fetchDeletedTransactions,
  fetchEditedTransactions,
  createRestoreRequests,
  type DeletedTransaction,
} from "@/services/customerDashboardService";

export default function CustomerRestoreRequestsPage() {
  const [items, setItems] = useState<DeletedTransaction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [requestingTxn, setRequestingTxn] =
    useState<DeletedTransaction | null>(null);

  const [requestingAll, setRequestingAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  const load = useCallback(() => {
    const business = getCurrentBusiness();
    if (!business) return;

    setLoading(true);
    setError("");

    Promise.all([
      fetchDeletedTransactions(business.ownerId),
      fetchEditedTransactions(business.ownerId),
    ])
      .then(([deleted, edited]) => {
        setItems([
          ...deleted,
          ...edited,
        ].sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()));
      })
      .catch(() =>
        setError(
          "Couldn't load deleted or edited transactions. Please try again."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---------------------------------------------------------
  // Request restore for a single transaction
  // ---------------------------------------------------------

  async function handleConfirmRequest() {
    const business = getCurrentBusiness();

    if (!business || !requestingTxn) return;

    setSubmitting(true);

    try {
      await createRestoreRequests(
        business.ownerId,
        [requestingTxn.id]
      );

      setRequestingTxn(null);

      setToast({
        message:
          "Restore request sent. The owner will review it.",
        variant: "success",
      });

      load();
    } catch (err: any) {
      setToast({
        message:
          err?.response?.data?.detail ||
          "Couldn't send restore request.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------
  // Request restore for ALL deleted transactions
  // ---------------------------------------------------------

  async function handleConfirmRestoreAll() {
    const business = getCurrentBusiness();

    if (!business) return;

    setSubmitting(true);

    try {
      await createRestoreRequests(
        business.ownerId,
        [],
        true
      );

      setRequestingAll(false);

      setToast({
        message:
          "Restore requests sent for all eligible deleted transactions. The owner will review them.",
        variant: "success",
      });

      load();
    } catch (err: any) {
      setToast({
        message:
          err?.response?.data?.detail ||
          "Couldn't send restore requests.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CustomerProtectedRoute>
      <CustomerShell
        title="Restore requests"
        subtitle="Ask the business owner to recover deleted or edited transactions"
      >
        <Toast
          toast={toast}
          onDismiss={() => setToast(null)}
        />

        {loading && <TransactionListSkeleton />}

        {!loading && error && (
          <div className="bg-white border border-line rounded-card p-8 text-center text-text-secondary text-sm">
            {error}
          </div>
        )}

        {!loading && !error && items && (
          items.length === 0 ? (
            <div className="bg-white border border-line rounded-card">
              <EmptyState
                icon="ti-receipt-off"
                text="No deleted transactions."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">

              {/* ------------------------------------------------ */}
              {/* Restore All Button                               */}
              {/* ------------------------------------------------ */}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setRequestingAll(true)}
                  disabled={submitting}
                  className="
                    inline-flex items-center gap-2
                    rounded-md
                    bg-purple-900
                    px-4 py-2
                    text-sm font-medium
                    text-white
                    transition
                    hover:opacity-90
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <i className="ti ti-refresh" />
                  Restore All Transactions
                </button>
              </div>

              {/* ------------------------------------------------ */}
              {/* Deleted Transactions                             */}
              {/* ------------------------------------------------ */}

              {items.map((t) => (
                <DeletedTransactionCard
                  key={t.id}
                  txn={t}
                  onRequestRestore={() =>
                    setRequestingTxn(t)
                  }
                />
              ))}
            </div>
          )
        )}

        {/* ----------------------------------------------------- */}
        {/* Single Transaction Confirmation                       */}
        {/* ----------------------------------------------------- */}

        <ConfirmDialog
          open={!!requestingTxn}
          title="Request restore?"
          message="This sends a request to the business owner to bring this transaction back. You'll see it as pending until they respond."
          confirmLabel="Request restore"
          loading={submitting}
          onConfirm={handleConfirmRequest}
          onCancel={() => setRequestingTxn(null)}
        />

        {/* ----------------------------------------------------- */}
        {/* Restore All Confirmation                              */}
        {/* ----------------------------------------------------- */}

        <ConfirmDialog
          open={requestingAll}
          title="Restore all transactions?"
          message={`This will send restore requests for all ${items?.length ?? 0} eligible deleted or edited transactions. The business owner will review the requests.`}
          confirmLabel="Restore all"
          loading={submitting}
          onConfirm={handleConfirmRestoreAll}
          onCancel={() => setRequestingAll(false)}
        />
      </CustomerShell>
    </CustomerProtectedRoute>
  );
}

