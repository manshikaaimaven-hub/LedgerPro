"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerProtectedRoute from "@/components/customer-shell/CustomerProtectedRoute";
import { CustomerShell } from "@/components/customer-shell/CustomerShell";
import api from "@/lib/api";
import { initials } from "@/lib/format";
import { getMyBusinesses, clearCustomerSession } from "@/services/customerAuthService";

interface LinkedBusiness {
  owner_id: string;
  business_name: string;
  customer_name: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [businesses, setBusinesses] = useState<LinkedBusiness[]>([]);

  useEffect(() => {
    const name = localStorage.getItem("lp_customer_full_name");
    if (name) setCustomerName(name);

    getMyBusinesses()
      .then((data) => setBusinesses(data))
      .catch(() => setBusinesses([]));
  }, []);

  const handleLogout = () => {
    clearCustomerSession();
    router.push("/customer/customer-login");
  };

  const exportBusinessesCsv = () => {
    const rows = [["Business name", "Owner ID", "Linked as"] , ...businesses.map(b => [b.business_name, b.owner_id, b.customer_name])];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledgerpro-businesses-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <CustomerProtectedRoute>
      <CustomerShell title="Settings" subtitle="Profile & preferences">
        <div className="flex flex-col gap-4">
          <SectionLabel icon="ti-user-circle" text="Your profile" />
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center gap-3.5">
              <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-success/40 bg-success-light text-xl font-medium text-success-dark">
                {customerName ? initials(customerName) : '—'}
              </div>
              <div>
                <div className="text-lg font-medium text-text-primary">{customerName || '—'}</div>
                <div className="mt-0.5 flex items-center gap-1 text-sm text-text-secondary">Customer account</div>
              </div>
            </div>
          </div>

          <SectionLabel icon="ti-settings" text="Account settings" />
          <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <SettingsRow icon="ti-lock" tone="info" title="Change password" sub="Update your login password" onClick={() => setPwOpen(true)} />
            <SettingsRow icon="ti-bell" tone="warning" title="Notifications" sub="Manage alert preferences" onClick={() => alert('Coming soon')} />
            <SettingsRow icon="ti-table-export" tone="success" title="Export linked businesses" sub="Download linked businesses as CSV" onClick={exportBusinessesCsv} />
            <SettingsRow icon="ti-info-circle" tone="gold" title="About LedgerPro" sub="Version 1.0.0" last />
          </div>

          <SectionLabel icon="ti-users-group" text="Linked businesses" />
          <div className="rounded-card border border-line bg-surface p-3 shadow-card">
            {businesses.length === 0 ? (
              <div className="text-sm text-text-secondary p-4">No linked businesses yet.</div>
            ) : (
              businesses.map((b) => (
                <div key={b.owner_id} className="px-3 py-2 border-b last:border-b-0">
                  <div className="font-medium">{b.business_name}</div>
                  <div className="text-xs text-text-secondary">Linked as {b.customer_name}</div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-input border-[1.5px] border-danger/25 bg-danger-light py-3.5 text-sm font-medium text-danger-dark"
          >
            <i className="ti ti-logout text-lg" aria-hidden="true" /> Sign out
          </button>
        </div>
      </CustomerShell>

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </CustomerProtectedRoute>
  );
}

function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-secondary">
      <i className={`ti ${icon}`} aria-hidden="true" />
      {text}
    </div>
  );
}

type Tone = 'info' | 'warning' | 'success' | 'brand' | 'gold';

const TONE_CLASS: Record<Tone, string> = {
  info: 'bg-info-light text-info',
  warning: 'bg-warning-light text-warning',
  success: 'bg-success-light text-success',
  brand: 'bg-brand-light text-brand-dark',
  gold: 'bg-gold-light text-gold-dark',
};

function ProfileRow({ icon, tone, label, value, last }: { icon: string; tone: Tone; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2 ${last ? '' : 'border-b border-line'}`}>
      <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] ${TONE_CLASS[tone]}`}>
        <i className={`ti ${icon} text-base`} aria-hidden="true" />
      </div>
      <div>
        <div className="mb-0.5 text-[11px] uppercase tracking-wide text-text-tertiary">{label}</div>
        <div className="text-[15px] text-text-primary">{value}</div>
      </div>
    </div>
  );
}

function SettingsRow({ icon, tone, title, sub, onClick, last }: { icon: string; tone: Tone; title: string; sub: string; onClick?: () => void; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3.5 py-4 text-left hover:bg-line/20 transition-colors ${last ? '' : 'border-b border-line'}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${TONE_CLASS[tone]}`}>
        <i className={`ti ${icon} text-lg`} aria-hidden="true" />
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-medium text-text-primary">{title}</div>
        <div className="mt-0.5 text-xs text-text-secondary">{sub}</div>
      </div>
      <i className="ti ti-chevron-right text-lg text-text-tertiary" aria-hidden="true" />
    </button>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErr('');
    if (next.length < 4) return setErr('New password must be at least 4 characters.');
    if (next !== conf) return setErr('Passwords do not match.');
    setSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: cur, new_password: next });
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Current password is incorrect.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div className="w-full max-w-sm rounded-card bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-lg font-medium text-text-primary">
          <i className="ti ti-lock text-xl text-info" aria-hidden="true" /> Change password
        </div>
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Current password</label>
          <input className="field-input" type="password" value={cur} onChange={e => setCur(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">New password</label>
          <input className="field-input" type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="At least 4 characters" />
        </div>
        <div className="mb-1">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Confirm new password</label>
          <input className="field-input" type="password" value={conf} onChange={e => setConf(e.target.value)} />
        </div>
        <a href="/forgot-password" className="mb-3 mt-1 inline-block text-xs text-info">Forgot your current password?</a>
        {err && <p className="mb-2 text-sm text-danger">{err}</p>}
        <div className="mt-2 flex gap-2.5">
          <button onClick={onClose} className="flex-1 rounded-input border border-line py-3 text-sm text-text-primary">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-[2] rounded-input bg-success py-3 text-sm font-medium text-white transition-colors hover:bg-success-dark disabled:opacity-60">
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </div>
    </div>
  );
}