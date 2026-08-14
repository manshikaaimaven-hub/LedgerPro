'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { formatINR } from '@/lib/format';
import {
  fetchCustomerRestoreRequests,
  approveRestoreRequests,
  rejectRestoreRequests,
} from '@/services/restoreRequestService';
import { RestoreRequestOut } from '@/types/restoreRequest';

type PendingAction = 'approve' | 'reject' | null;


export default function CustomerRestoreRequestsPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-text-secondary">Loading…</div>}>
      <CustomerRestoreRequestsPageInner />
    </Suspense>
  );
}


function CustomerRestoreRequestsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customerId') ?? '';

  const [requests, setRequests] = useState<RestoreRequestOut[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [ownerResponse, setOwnerResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    load();
  }, [customerId]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCustomerRestoreRequests(customerId, 'pending');
      setRequests(data);
      setSelected(new Set());
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load requests for this customer.');
    } finally {
      setLoading(false);
    }
  };

  const allSelected = requests.length > 0 && selected.size === requests.length;

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(requests.map(r => r.id)));
  };

  const openConfirm = (action: PendingAction) => {
    if (selected.size === 0) return;
    setActionError('');
    setOwnerResponse('');
    setPendingAction(action);
  };

  const runAction = async () => {
    if (!pendingAction || selected.size === 0) return;
    setSubmitting(true);
    setActionError('');
    try {
      const ids = Array.from(selected);
      if (pendingAction === 'approve') {
        await approveRestoreRequests(ids, ownerResponse);
      } else {
        await rejectRestoreRequests(ids, ownerResponse);
      }
      // Drop resolved requests from the pending list.
      setRequests(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
      setPendingAction(null);
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || `Failed to ${pendingAction} the selected requests.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell title="Restore requests" subtitle="Select transactions to approve or reject">
        <div className="flex flex-col gap-4 overflow-y-auto p-4 pb-28">
          <button
            onClick={() => router.push('/owner/restore-requests')}
            className="flex w-fit items-center gap-1.5 text-sm text-text-secondary"
          >
            <i className="ti ti-chevron-left text-base" aria-hidden="true" /> Back to customers
          </button>

          {loading && <div className="py-10 text-center text-sm text-text-secondary">Loading…</div>}

          {!loading && error && (
            <div className="rounded-card border border-danger/25 bg-danger-light p-4 text-sm text-danger-dark">
              {error}
            </div>
          )}

          {!loading && !error && requests.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <i className="ti ti-check text-3xl text-success" aria-hidden="true" />
              <div className="text-sm font-medium text-text-primary">Nothing pending</div>
              <div className="text-xs text-text-secondary">
                This customer has no outstanding restore requests.
              </div>
            </div>
          )}

          {!loading && !error && requests.length > 0 && (
            <>
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 self-start text-xs font-medium text-info"
              >
                <Checkbox checked={allSelected} />
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>

              <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                {requests.map((r, idx) => {
                  const txn = r.transaction_snapshot;
                  const isChecked = selected.has(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleOne(r.id)}
                      className={`flex w-full items-start gap-3 px-3.5 py-4 text-left transition-colors hover:bg-line/20 ${
                        idx === requests.length - 1 ? '' : 'border-b border-line'
                      } ${isChecked ? 'bg-info-light/40' : ''}`}
                    >
                      <div className="mt-0.5">
                        <Checkbox checked={isChecked} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[15px] font-medium text-text-primary">
                            {txn ? formatINR(txn.amount) : 'Transaction unavailable'}
                          </span>
                          {txn && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                txn.type === 'credit'
                                  ? 'bg-success-light text-success'
                                  : 'bg-danger-light text-danger'
                              }`}
                            >
                              {txn.type}
                            </span>
                          )}
                        </div>
                        {txn?.note && (
                          <div className="mt-0.5 text-xs text-text-secondary">{txn.note}</div>
                        )}
                        {txn?.invoice_number && (
                          <div className="mt-0.5 text-[11px] text-text-tertiary">
                            Invoice #{txn.invoice_number}
                          </div>
                        )}
                        {r.customer_note && (
                          <div className="mt-1.5 rounded-input bg-line/30 px-2.5 py-1.5 text-xs text-text-secondary">
                            <i className="ti ti-message-circle mr-1 text-[13px]" aria-hidden="true" />
                            {r.customer_note}
                          </div>
                        )}
                        <div className="mt-1 text-[11px] text-text-tertiary">
                          Requested {new Date(r.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {!loading && requests.length > 0 && (
          <div className="fixed bottom-24 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 gap-12 px-4">
            <button
              onClick={() => openConfirm('reject')}
              disabled={selected.size === 0}
              className="w-[42%] rounded-input border-[1.5px] border-danger/25 bg-danger-light py-3 text-sm font-medium text-danger-dark disabled:opacity-60"
            >
              Reject{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>

            <button
              onClick={() => openConfirm('approve')}
              disabled={selected.size === 0}
              className="w-[42%] shrink-0 rounded-input bg-success py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              Approve{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
        )}
      </AppShell>

      {pendingAction && (
        <ConfirmModal
          action={pendingAction}
          count={selected.size}
          ownerResponse={ownerResponse}
          setOwnerResponse={setOwnerResponse}
          submitting={submitting}
          error={actionError}
          onCancel={() => setPendingAction(null)}
          onConfirm={runAction}
        />
      )}
    </ProtectedRoute>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${
        checked ? 'border-info bg-info' : 'border-line bg-surface'
      }`}
    >
      {checked && <i className="ti ti-check text-[13px] text-white" aria-hidden="true" />}
    </span>
  );
}

function ConfirmModal({
  action,
  count,
  ownerResponse,
  setOwnerResponse,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  action: 'approve' | 'reject';
  count: number;
  ownerResponse: string;
  setOwnerResponse: (v: string) => void;
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isApprove = action === 'approve';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div className="w-full max-w-sm rounded-card bg-surface p-6 shadow-card">
        <div className="mb-1 flex items-center gap-2 text-lg font-medium text-text-primary">
          <i
            className={`ti ${isApprove ? 'ti-circle-check' : 'ti-circle-x'} text-xl ${
              isApprove ? 'text-success' : 'text-danger'
            }`}
            aria-hidden="true"
          />
          {isApprove ? 'Approve' : 'Reject'} {count} request{count === 1 ? '' : 's'}
        </div>
        <p className="mb-3 text-xs text-text-secondary">
          {isApprove
            ? 'The selected transactions will be restored to the customer\u2019s ledger.'
            : 'The selected transactions will remain deleted.'}
        </p>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">
          Note to customer (optional)
        </label>
        <textarea
          className="field-input mb-2 h-20 w-full resize-none"
          value={ownerResponse}
          onChange={e => setOwnerResponse(e.target.value)}
          placeholder="e.g. Verified with delivery records"
        />
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <div className="mt-2 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-input border border-line py-3 text-sm text-text-primary disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className={`flex-[2] rounded-input py-3 text-sm font-medium text-white disabled:opacity-60 ${
              isApprove ? 'bg-success' : 'bg-danger'
            }`}
          >
            {submitting ? 'Submitting…' : isApprove ? 'Confirm approve' : 'Confirm reject'}
          </button>
        </div>
      </div>
    </div>
  );
}