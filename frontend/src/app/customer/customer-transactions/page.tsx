/*
  ORIGINAL PATH: src/app/customer-transactions/page.tsx

  Full transaction list: search + filter + sort + pagination + edit +
  delete, all scoped to the customer's own records via the backend
  (owner_id + customer_id filtering already enforced server-side —
  this page just calls the API and renders what comes back).

  Debouncing: search input is debounced 400ms before triggering a
  refetch, so we're not hitting the API on every keystroke.

  View toggle: "View deleted transactions" no longer navigates to a
  separate route — it flips a local `view` state ("active" | "deleted")
  and this same page renders the deleted list + restore-request flow
  in place, then flips back.
*/
"use client";

import { useEffect, useState, useCallback } from "react";
import CustomerProtectedRoute from "@/components/customer-shell/CustomerProtectedRoute";
import { CustomerShell } from "@/components/customer-shell/CustomerShell";
import { TransactionFilterBar } from "@/components/customer-shell/TransactionFilterBar";
import { TransactionCard } from "@/components/customer-shell/TransactionCard";
import { DeletedTransactionCard } from "@/components/customer-shell/DeletedTransactionCard";
import { EditTransactionModal } from "@/components/customer-shell/EditTransactionModal";
import { ConfirmDialog } from "@/components/customer-shell/ConfirmDialog";
import { Pagination } from "@/components/customer-shell/Pagination";
import { Toast, type ToastState } from "@/components/customer-shell/Toast";
import { TransactionListSkeleton } from "@/components/customer-shell/TransactionSkeleton";
import { EmptyState } from "@/components/customer-shell/EmptyState";
import { getCurrentBusiness } from "@/lib/currentBusiness";
import {
  fetchTransactions, updateTransaction, deleteTransaction,
  fetchDeletedTransactions, fetchEditedTransactions, createRestoreRequests,
  type CustomerTransaction, type PaginatedTransactions,
  type DeletedTransaction,
} from "@/services/customerDashboardService";
import { IconArchive, IconArrowLeft } from "@tabler/icons-react";

export default function CustomerTransactionsPage() {
  const [view, setView] = useState<"active" | "deleted">("active");

  // --- active transactions state ---
  const [data, setData] = useState<PaginatedTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<"all" | "cr" | "dr">("all");
  const [sort, setSort] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [editingTxn, setEditingTxn] = useState<CustomerTransaction | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingTxn, setDeletingTxn] = useState<CustomerTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --- deleted transactions state ---
  const [deletedItems, setDeletedItems] = useState<DeletedTransaction[] | null>(null);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedError, setDeletedError] = useState("");
  const [requestingTxn, setRequestingTxn] = useState<DeletedTransaction | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 whenever the search term changes
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever filters change (but not on every page click)
  useEffect(() => {
    setPage(1);
  }, [type, sort]);

  const load = useCallback(() => {
    const business = getCurrentBusiness();
    if (!business) return;

    setLoading(true);
    setError("");
    fetchTransactions(business.ownerId, {
      page,
      limit: 10,
      search: debouncedSearch || undefined,
      type: type === "all" ? undefined : type,
      sort,
    })
      .then(setData)
      .catch(() => setError("Couldn't load transactions. Please try again."))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, type, sort]);

  useEffect(() => {
    if (view === "active") load();
  }, [load, view]);

  const loadDeleted = useCallback(() => {
    const business = getCurrentBusiness();
    if (!business) return;

    setDeletedLoading(true);
    setDeletedError("");
    Promise.all([
      fetchDeletedTransactions(business.ownerId),
      fetchEditedTransactions(business.ownerId),
    ])
      .then(([deleted, edited]) => {
        setDeletedItems([
          ...deleted,
          ...edited,
        ].sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()));
      })
      .catch(() => setDeletedError("Couldn't load deleted or edited transactions. Please try again."))
      .finally(() => setDeletedLoading(false));
  }, []);

  useEffect(() => {
    if (view === "deleted") loadDeleted();
  }, [loadDeleted, view]);

  async function handleSaveEdit(note: string, invoiceNumber: string, amount: number, type: "cr" | "dr") {
    const business = getCurrentBusiness();
    if (!business || !editingTxn) return;

    setSavingEdit(true);
    try {
      await updateTransaction(business.ownerId, editingTxn.id, {
        note, invoice_number: invoiceNumber, amount, type,
      });
      setEditingTxn(null);
      setToast({ message: "Transaction updated.", variant: "success" });
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.detail || "Couldn't save changes.", variant: "error" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    const business = getCurrentBusiness();
    if (!business || !deletingTxn) return;

    setDeleting(true);
    try {
      await deleteTransaction(business.ownerId, deletingTxn.id);
      setDeletingTxn(null);
      setToast({ message: "Transaction removed. You can request it back anytime.", variant: "success" });
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.detail || "Couldn't delete transaction.", variant: "error" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleConfirmRestoreRequest() {
    const business = getCurrentBusiness();
    if (!business || !requestingTxn) return;

    setSubmittingRequest(true);
    try {
     await createRestoreRequests(business.ownerId, [requestingTxn.id]);
      setRequestingTxn(null);
      setToast({ message: "Restore request sent. The owner will review it.", variant: "success" });
      loadDeleted();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.detail || "Couldn't send restore request.", variant: "error" });
    } finally {
      setSubmittingRequest(false);
    }
  }

  return (
    <CustomerProtectedRoute>
      <CustomerShell
        title={view === "active" ? "Transactions" : "Deleted & edited transactions"}
        subtitle={view === "active" ? "Your full transaction history" : "Request a restore for any of these"}
      >
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        {view === "active" ? (
          <>
            <TransactionFilterBar
              search={search} onSearchChange={setSearch}
              type={type} onTypeChange={setType}
              sort={sort} onSortChange={setSort}
            />

            {/* <button
              onClick={() => setView("deleted")}
              className="flex items-center gap-2 text-xs font-medium text-brand-dark bg-brand-light rounded-input px-3.5 py-2.5 self-start"
            >
              <IconArchive size={14} />
              View deleted transactions
            </button> */}

            {loading && <TransactionListSkeleton />}

            {!loading && error && (
              <div className="bg-white border border-line rounded-card p-8 text-center text-text-secondary text-sm">
                {error}
              </div>
            )}

            {!loading && !error && data && (
              <>
                {data.items.length === 0 ? (
                  <div className="bg-white border border-line rounded-card">
                    <EmptyState
                      icon="ti-receipt-off"
                      text={search || type !== "all" ? "No transactions match your filters." : "No transactions yet."}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.items.map((t) => (
                      <TransactionCard
                        key={t.id}
                        txn={t}
                        onEdit={() => setEditingTxn(t)}
                        onDelete={() => setDeletingTxn(t)}
                      />
                    ))}
                  </div>
                )}

                <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />
              </>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setView("active")}
              className="flex items-center gap-2 text-xs font-medium text-brand-dark bg-brand-light rounded-input px-3.5 py-2.5 self-start"
            >
              <IconArrowLeft size={14} />
              Back to transactions
            </button>

            {deletedLoading && <TransactionListSkeleton />}

            {!deletedLoading && deletedError && (
              <div className="bg-white border border-line rounded-card p-8 text-center text-text-secondary text-sm">
                {deletedError}
              </div>
            )}

            {!deletedLoading && !deletedError && deletedItems && (
              deletedItems.length === 0 ? (
                <div className="bg-white border border-line rounded-card">
                  <EmptyState icon="ti-receipt-off" text="No deleted or edited transactions." />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {deletedItems.map((t) => (
                    <DeletedTransactionCard
                      key={t.id}
                      txn={t}
                      onRequestRestore={() => setRequestingTxn(t)}
                    />
                  ))}
                </div>
              )
            )}
          </>
        )}

        <EditTransactionModal
          txn={editingTxn}
          saving={savingEdit}
          onSave={handleSaveEdit}
          onClose={() => setEditingTxn(null)}
        />

        <ConfirmDialog
          open={!!deletingTxn}
          title="Remove this transaction?"
          message="This removes it from your view. The record is kept safely — you can request it back anytime from deleted transactions."
          confirmLabel="Remove"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingTxn(null)}
        />

        <ConfirmDialog
          open={!!requestingTxn}
          title="Request restore?"
          message="This sends a request to the business owner to bring this transaction back. You'll see it as pending until they respond."
          confirmLabel="Request restore"
          loading={submittingRequest}
          onConfirm={handleConfirmRestoreRequest}
          onCancel={() => setRequestingTxn(null)}
        />
      </CustomerShell>
    </CustomerProtectedRoute>
  );
}