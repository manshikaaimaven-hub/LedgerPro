'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { fetchCustomerById } from '@/services/customerService';
import { fetchCustomerTransactions } from '@/services/transactionService';
import { Customer } from '@/types/customer';
import { Transaction } from '@/types/transaction';
import { formatINR, initials, formatDate } from '@/lib/format';

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={null}>
      <ProtectedRoute>
        <AppShell title="Customer" subtitle="Transaction history">
          <DetailBody />
        </AppShell>
      </ProtectedRoute>
    </Suspense>
  );
}

function DetailBody() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id') || '';

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchCustomerById(id).then(setCustomer).catch(() => setNotFound(true));
  }, [id]);

  const loadTxns = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    try {
      const { items, hasMore } = await fetchCustomerTransactions(id, p);
      setTxns(prev => (append ? [...prev, ...items] : items));
      setHasMore(hasMore);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) loadTxns(1, false); }, [id, loadTxns]);

  if (!id || notFound) {
    return (
      <div className="p-6 text-center text-text-secondary">
        <p className="text-sm">Customer not found.</p>
        <button onClick={() => router.push('/customers')} className="mt-3 text-sm text-info">
          Back to customers
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <button onClick={() => router.back()} className="mb-3 flex items-center gap-1.5 text-sm text-text-secondary">
        <i className="ti ti-arrow-left text-base" aria-hidden="true" /> Back to customers
      </button>

      {customer && (
        <div className="mb-4 flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-base font-medium text-success-dark">
            {initials(customer.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-medium text-text-primary">{customer.name}</div>
            <div className="text-xs text-text-secondary">{customer.phone}</div>
          </div>
          <div className={`text-lg font-medium ${customer.balance >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatINR(customer.balance)}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {txns.length === 0 && !loading ? (
          <div className="p-9 text-center text-text-secondary">
            <i className="ti ti-receipt-2 mx-auto mb-2 block text-3xl text-text-tertiary" aria-hidden="true" />
            <p className="text-sm">No transactions yet.</p>
          </div>
        ) : (
          txns.map(t => (
            <div key={t.id} className="flex items-center gap-3 border-b border-line px-3.5 py-3.5 last:border-none">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  t.type === 'cr' ? 'bg-success-light text-success' : 'bg-danger-light text-danger'
                }`}
              >
                <i className={`ti ${t.type === 'cr' ? 'ti-arrow-down-circle' : 'ti-arrow-up-circle'} text-xl`} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text-primary">
                  {t.note || (t.type === 'cr' ? 'Credit note' : 'Debit note')}
                </div>
                <div className="mt-0.5 text-xs text-text-secondary">
                  {formatDate(t.entry_date)}{t.invoice_number ? ` · Inv #${t.invoice_number}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-[15px] font-medium ${t.type === 'cr' ? 'text-success' : 'text-danger'}`}>
                  {t.type === 'cr' ? '+' : '-'}{formatINR(t.amount)}
                </div>
                <div className="mt-0.5 text-[10px] text-text-tertiary">Bal: {formatINR(t.running_balance)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <button
          onClick={() => loadTxns(page + 1, true)}
          disabled={loading}
          className="mt-3 w-full rounded-input border border-line py-3 text-sm font-medium text-text-primary disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}