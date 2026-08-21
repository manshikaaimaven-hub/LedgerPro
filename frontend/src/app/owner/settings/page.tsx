'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { initials } from '@/lib/format';

interface OwnerProfile {
  id: string;
  full_name: string;
  business_name: string;
  phone: string;
  city: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [businessDeleted, setBusinessDeleted] = useState(false); // NEW
  const [pwOpen, setPwOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('settingsToast');
    if (raw) {
      setToast(JSON.parse(raw));
      sessionStorage.removeItem('settingsToast');
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadProfile = async () => {
    try {
      const { data } = await api.get<OwnerProfile>('/settings/profile');
      setOwner(data);
      setBusinessDeleted(false);
    } catch (e: any) {
      // Owner may have been deleted from Child DB — meaning someone
      // else deleted this owner's business. Lock down profile/password/
      // manage-business actions rather than let them hit a 403 later.
      if (e?.response?.status === 404) {
        setOwner(null);
        setBusinessDeleted(true);
        return;
      }

      setOwner(null);
      setBusinessDeleted(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const exportCsv = async () => {
    try {
      const response = await api.get('/settings/export/csv', {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledgerpro-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setToast({ type: 'error', message: 'Could not export data. Please try again.' });
    }
  };  

  return (
    <ProtectedRoute>
      <AppShell title="Settings" subtitle="Profile & preferences">
        {toast && (
          <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4 sm:justify-end sm:pr-6">
            <div
              className={`pointer-events-auto flex items-center gap-2.5 rounded-input border bg-surface px-3.5 py-2.5 text-sm shadow-card ${
                toast.type === 'success' ? 'border-line' : 'border-danger/30'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  toast.type === 'success' ? 'bg-success-light text-success-dark' : 'bg-danger-light text-danger-dark'
                }`}
              >
                <i className={`ti ${toast.type === 'success' ? 'ti-check' : 'ti-x'} text-xs`} aria-hidden="true" />
              </span>
              <span className="font-medium text-text-primary">{toast.message}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {businessDeleted && (
            <div className="flex items-start gap-2.5 rounded-card border border-danger/25 bg-danger-light px-4 py-3.5 text-sm text-danger-dark">
              <i className="ti ti-alert-triangle mt-0.5 text-base shrink-0" aria-hidden="true" />
              <div>
                <div className="font-medium">Your business data has been deleted</div>
                <div className="mt-0.5 text-xs">
                  Profile editing, password changes, and business management are unavailable until it's restored.
                  Contact the owner who deleted it.
                </div>
              </div>
            </div>
          )}

          <SectionLabel icon="ti-user-circle" text="Manufacturer profile" />
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5">
                <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-success/40 bg-success-light text-xl font-medium text-success-dark">
                  {owner ? initials(owner.full_name) : '—'}
                </div>
                <div>
                  <div className="text-lg font-medium text-text-primary">{owner?.full_name || '—'}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-sm text-text-secondary">
                    <i className="ti ti-building-factory-2 text-sm" aria-hidden="true" />
                    {owner?.business_name || '—'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEditOpen(true)}
                disabled={businessDeleted}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-text-secondary hover:bg-line/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Edit profile"
                title={businessDeleted ? "Unavailable while business data is deleted" : undefined}
              >
                <i className="ti ti-pencil text-base" aria-hidden="true" />
              </button>
            </div>
            <div className="mb-3.5 h-px bg-line" />
            <ProfileRow icon="ti-phone" tone="info" label="Contact number" value={owner?.phone || '—'} />
            <ProfileRow icon="ti-map-pin" tone="warning" label="City" value={owner?.city || '—'} />
            <ProfileRow icon="ti-building-factory-2" tone="success" label="Business type" value="Textile manufacturer" last />
          </div>

          <SectionLabel icon="ti-settings" text="Account settings" />
          <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <SettingsRow
              icon="ti-building-warehouse"
              tone="warning"
              title="Manage business data"
              sub={businessDeleted ? "Unavailable while your business data is deleted" : "Delete or restore another business"}
              onClick={() => router.push('/owner/manage-business')}
              disabled={businessDeleted}
            />
            <SettingsRow
              icon="ti-lock"
              tone="info"
              title="Change password"
              sub={businessDeleted ? "Unavailable while your business data is deleted" : "Update your login password"}
              onClick={() => setPwOpen(true)}
              disabled={businessDeleted}
            />
            <SettingsRow icon="ti-bell" tone="warning" title="Notifications" sub="Manage alert preferences" onClick={() => alert('Coming soon')} />
            <SettingsRow icon="ti-table-export" tone="success" title="Export data" sub="Download ledger as CSV" onClick={exportCsv} disabled={businessDeleted} />
            <SettingsRow icon="ti-info-circle" tone="gold" title="About LedgerPro" sub="Version 1.0.0" last />
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-input border-[1.5px] border-danger/25 bg-danger-light py-3.5 text-sm font-medium text-danger-dark"
          >
            <i className="ti ti-logout text-lg" aria-hidden="true" /> Sign out
          </button>
        </div>
      </AppShell>

      {pwOpen && !businessDeleted && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
      {editOpen && owner && !businessDeleted && (
        <EditProfileModal
          owner={owner}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => { setOwner(updated); setEditOpen(false); }}
        />
      )}
    </ProtectedRoute>
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

function SettingsRow({
  icon, tone, title, sub, onClick, last, disabled,
}: {
  icon: string; tone: Tone; title: string; sub: string; onClick?: () => void; last?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-3.5 py-4 text-left transition-colors ${last ? '' : 'border-b border-line'} ${
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-line/20'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${TONE_CLASS[tone]}`}>
        <i className={`ti ${icon} text-lg`} aria-hidden="true" />
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-medium text-text-primary">{title}</div>
        <div className="mt-0.5 text-xs text-text-secondary">{sub}</div>
      </div>
      {!disabled && <i className="ti ti-chevron-right text-lg text-text-tertiary" aria-hidden="true" />}
      {disabled && <i className="ti ti-lock text-sm text-text-tertiary" aria-hidden="true" />}
    </button>
  );
}

function EditProfileModal({ owner, onClose, onSaved }: { owner: OwnerProfile; onClose: () => void; onSaved: (o: OwnerProfile) => void }) {
  const [fullName, setFullName] = useState(owner.full_name);
  const [businessName, setBusinessName] = useState(owner.business_name);
  const [phone, setPhone] = useState(owner.phone);
  const [city, setCity] = useState(owner.city);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      const { data } = await api.put<OwnerProfile>('/settings/profile', {
        full_name: fullName,
        business_name: businessName,
        phone,
        city,
      });
      onSaved(data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div className="w-full max-w-sm rounded-card bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-lg font-medium text-text-primary">
          <i className="ti ti-user-circle text-xl text-info" aria-hidden="true" /> Edit profile
        </div>
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Full name</label>
          <input className="field-input" value={fullName} onChange={e => setFullName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Business name</label>
          <input className="field-input" value={businessName} onChange={e => setBusinessName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Phone</label>
          <input className="field-input" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="mb-1">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">City</label>
          <input className="field-input" value={city} onChange={e => setCity(e.target.value)} />
        </div>
        {err && <p className="mb-2 mt-2 text-sm text-danger">{err}</p>}
        <div className="mt-4 flex gap-2.5">
          <button onClick={onClose} className="flex-1 rounded-input border border-line py-3 text-sm text-text-primary">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-[2] rounded-input bg-success py-3 text-sm font-medium text-white transition-colors hover:bg-success-dark disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
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
      await api.post('/settings/change-password', { current_password: cur, new_password: next });
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
        <Link href="/forgot-password" className="mb-3 mt-1 inline-block text-xs text-info">Forgot your current password?</Link>
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