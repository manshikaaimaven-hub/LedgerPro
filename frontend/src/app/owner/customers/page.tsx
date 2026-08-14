'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { fetchCustomers, createCustomer } from '@/services/customerService';
import { Customer, CustomerCreatePayload } from '@/types/customer';
import { formatINR, initials } from '@/lib/format';

type View = 'add' | 'list';

export default function CustomersPage() {
  const [view, setView] = useState<View>('add');

  return (
    <ProtectedRoute>
      <AppShell title="Customers" subtitle={view === 'add' ? 'Add new customer' : undefined}>
        <div className="flex items-center justify-center gap-2 border-b border-line bg-surface px-4 py-2">
            <button
              onClick={() => setView('list')}
              aria-label="View customer list"
              className={`flex h-10 w-10 items-center justify-center rounded-input ${
                view === 'list' ? 'bg-success-light text-success-dark' : 'text-text-secondary'
              }`}
            >
              <i className="ti ti-list-details text-xl" aria-hidden="true" />
            </button>
            <button
              onClick={() => setView('add')}
              aria-label="Add customer"
              className={`flex h-10 w-10 items-center justify-center rounded-input ${
                view === 'add' ? 'bg-success-light text-success-dark' : 'text-text-secondary'
              }`}
            >
              <i className="ti ti-user-plus text-xl" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {view === 'add' ? <AddCustomerForm onCreated={() => setView('list')} /> : <CustomerList />}
          </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function AddCustomerForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CustomerCreatePayload>({
    name: '', email: '', phone: '', address: '', gst_number: '', notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: keyof CustomerCreatePayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError('');

    if (!form.name.trim()) return setError('Customer name is required.');
    if (!form.email.trim()) return setError('Email is required.');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return setError('Please enter a valid email address.');
    if (!form.phone.trim()) return setError('Contact number is required.');

    setSaving(true);
    try {
      await createCustomer(form);
      setForm({ name: '', email: '', phone: '', address: '', gst_number: '', notes: '' });
      onCreated();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Could not save customer. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <Field icon="ti-building-store" label="Customer name" required>
          <input className="field-input" value={form.name} onChange={set('name')} placeholder="e.g. Krishna Traders" />
        </Field>
        <Field icon="ti-mail" label="Customer Email" required>
          <input className="field-input" type="email" value={form.email} onChange={set('email')} placeholder="e.g. customer@gmail.com" />
        </Field>
        <Field icon="ti-phone" label="Contact number" required>
          <input className="field-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="e.g. 9876543210" />
        </Field>
        <Field icon="ti-map-pin" label="Address / City">
          <input className="field-input" value={form.address} onChange={set('address')} placeholder="e.g. Ring Road, Surat" />
        </Field>
        <Field icon="ti-id-badge" label="GST number">
          <input className="field-input" value={form.gst_number} onChange={set('gst_number')} placeholder="e.g. 24AAAAA0000A1Z5" />
        </Field>
        <Field icon="ti-notes" label="Notes">
          <textarea className="field-input resize-none" rows={2} value={form.notes} onChange={set('notes')} placeholder="Any additional notes…" />
        </Field>

        {error && (
          <p className="flex items-center gap-1.5 text-[13px] text-danger">
            <i className="ti ti-alert-circle" aria-hidden="true" />
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-success py-3.5 font-medium text-white transition-colors hover:bg-success-dark disabled:opacity-60"
        >
          {saving ? <span className="btn-spinner" aria-hidden="true" /> : <i className="ti ti-user-check text-xl" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Add customer'}
        </button>
      </div>
    </div>
  );
}

function Field({ icon, label, required, children }: { icon: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text-secondary">
        <i className={`ti ${icon}`} aria-hidden="true" />
        <span>
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
      </div>
      {children}
    </div>
  );
}

function CustomerList() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number, s: string, append: boolean) => {
    setLoading(true);
    try {
      const { items, hasMore } = await fetchCustomers(p, s || undefined);
      setCustomers(prev => (append ? [...prev, ...items] : items));
      setHasMore(hasMore);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, '', false); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(1, search, false), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex h-[46px] items-center gap-2 rounded-input border border-line bg-surface px-3.5">
        <i className="ti ti-search shrink-0 text-lg text-text-tertiary" aria-hidden="true" />
        <input
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-tertiary"
          placeholder="Search by name, phone or GST…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {/* <div className="flex items-center justify-between border-b border-line bg-page px-3.5 py-3"> */}
        <div className="flex items-center justify-between border-b border-line bg-line/25 px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
            <i className="ti ti-users text-lg" aria-hidden="true" />
            <span>All customers</span>
          </div>
          <span className="rounded-full bg-success-light px-2.5 py-0.5 text-xs font-medium text-success-dark">
            {customers.length}
          </span>
        </div>

        {customers.length === 0 && !loading ? (
          <div className="p-9 text-center text-text-secondary">
            <i className="ti ti-users mx-auto mb-3 block text-4xl text-text-tertiary" aria-hidden="true" />
            <p className="text-sm">No customers found.</p>
          </div>
        ) : (
          customers.map(c => (
            <button
              key={c.id}
              // onClick={() => router.push(`/customers/detail?id=${c.id}`)}
              onClick={() => router.push(`#`)}
              // className="flex w-full items-center gap-3 border-b border-line px-3.5 py-3.5 text-left last:border-none hover:bg-page"
              className="flex w-full items-center gap-3 border-b border-line px-3.5 py-3.5 text-left last:border-none hover:bg-line/20 transition-colors"
            >
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-success-light text-sm font-medium text-success-dark">
                {initials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium text-text-primary">{c.name}</div>
                <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-text-secondary">
                  <i className="ti ti-phone shrink-0 text-sm" aria-hidden="true" />
                  {[c.phone, c.address].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-[15px] font-medium ${c.balance >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatINR(c.balance)}
                </div>
                <div className="mt-0.5 text-[10px] text-text-tertiary">{c.balance >= 0 ? 'Receivable' : 'Payable'}</div>
              </div>
            </button>
          ))
        )}
      </div>

      {hasMore && (
        <button
          onClick={() => load(page + 1, search, true)}
          disabled={loading}
          className="w-full rounded-input border border-line py-3 text-sm font-medium text-text-primary disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}