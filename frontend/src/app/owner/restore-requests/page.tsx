'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { fetchRestoreRequestCustomers } from '@/services/restoreRequestService';
import { initials } from '@/lib/format';
import { RestoreCustomerOut } from '@/types/restoreRequest';

export default function RestoreRequestCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<RestoreCustomerOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchRestoreRequestCustomers();
      setCustomers(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to load restore requests.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell title="Restore requests" subtitle="Customers requesting deleted transactions back">
        <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto p-4">
          {loading && (
            <div className="py-10 text-center text-sm text-text-secondary">Loading…</div>
          )}

          {!loading && error && (
            <div className="rounded-card border border-danger/25 bg-danger-light p-4 text-sm text-danger-dark">
              {error}
            </div>
          )}

          {!loading && !error && customers.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <i className="ti ti-table-export text-3xl text-text-tertiary" aria-hidden="true" />
              <div className="text-sm font-medium text-text-primary">No pending restore requests</div>
              <div className="text-xs text-text-secondary">
                Customers will show up here after they request a deleted transaction back.
              </div>
            </div>
          )}

          {!loading && !error && customers.length > 0 && (
            <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
              {customers.map((c, idx) => (
                <button
                  key={c.customer_id}
                  onClick={() => router.push(`/owner/restore-requests/detail?customerId=${c.customer_id}`)}
                  className={`flex w-full items-center gap-3 px-3.5 py-4 text-left transition-colors hover:bg-line/20 ${
                    idx === customers.length - 1 ? '' : 'border-b border-line'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-info/40 bg-info-light text-sm font-medium text-info">
                    {initials(c.customer_name)}
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-medium text-text-primary">{c.customer_name}</div>
                    <div className="mt-0.5 text-xs text-text-secondary">
                      {c.pending_count} pending request{c.pending_count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className="rounded-full bg-warning-light px-2.5 py-1 text-xs font-medium text-warning">
                    {c.pending_count}
                  </span>
                  <i className="ti ti-chevron-right text-lg text-text-tertiary" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}