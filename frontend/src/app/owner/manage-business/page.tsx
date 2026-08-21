'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import Link from 'next/link';

interface DeleteTargetProfile {
  id: string;
  full_name: string;
  business_name: string;
  city: string;
  phone_last4: string;
  status?: 'deleted_by_me';
}

export default function ManageBusinessPasscodePage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [err, setErr] = useState('');
  const [blocked, setBlocked] = useState(false); // deleted by someone else — hard stop
  const [loading, setLoading] = useState(false);

  // NEW: gate the whole page behind the caller's own business status.
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [selfDeleted, setSelfDeleted] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        await api.get('/settings/profile');
        setSelfDeleted(false);
      } catch (e: any) {
        if (e?.response?.status === 404) {
          setSelfDeleted(true);
        } else {
          setSelfDeleted(false);
        }
      } finally {
        setCheckingAccess(false);
      }
    };
    checkAccess();
  }, []);

  const submit = async () => {
    setErr('');
    setBlocked(false);
    if (passcode.length !== 4 || !/^\d{4}$/.test(passcode)) {
      setErr('Enter the 4-digit passcode.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<DeleteTargetProfile>('/settings/business/verify-passcode', { passcode });
      sessionStorage.setItem('manageBusinessTarget', JSON.stringify(data));
      router.push('/owner/manage-business/confirm');
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setBlocked(true);
        setErr(e?.response?.data?.detail || 'This business is already deleted by someone else.');
      } else {
        setErr(e?.response?.data?.detail || 'Incorrect passcode.');
      }
    } finally {
      setLoading(false);
      setPasscode('');
    }
  };

  if (checkingAccess) {
    return (
      <ProtectedRoute>
        <AppShell title="Manage business data" subtitle="Enter passcode to identify a business">
          <div className="flex flex-col gap-4 p-4">
            <div className="animate-pulse rounded-card border border-line bg-surface p-5 shadow-card">
              <div className="h-4 w-1/3 rounded bg-line/60" />
              <div className="mt-3 h-10 rounded bg-line/40" />
            </div>
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  if (selfDeleted) {
    return (
      <ProtectedRoute>
        <AppShell title="Manage business data" subtitle="Access unavailable">
          <div className="flex flex-col gap-4 p-4">
            <div className="rounded-card border border-danger/25 bg-danger-light p-5 text-sm text-danger-dark shadow-card">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <i className="ti ti-lock text-base" aria-hidden="true" />
                Your business data has been deleted
              </div>
              <p className="text-xs">
                You can't delete or restore any business data until your own business is restored.
              </p>
              <Link
                href="/owner/settings"
                className="mt-4 flex w-full items-center justify-center rounded-input border border-danger/25 bg-surface py-3 text-sm font-medium text-danger-dark"
              >
                Back to settings
              </Link>
            </div>
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppShell title="Manage business data" subtitle="Enter passcode to identify a business">
        <div className="flex flex-col gap-4 p-4">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2 text-[15px] font-medium text-text-primary">
              <i className="ti ti-shield-lock text-lg text-info" aria-hidden="true" />
              Enter passcode
            </div>
            <p className="mb-4 text-sm text-text-secondary">
              Enter the last 4 digits of the target owner's registered mobile number to locate their business.
            </p>

            {blocked ? (
              <div className="mb-2 flex items-start gap-2 rounded-input border border-danger/20 bg-danger-light px-3 py-2.5 text-sm text-danger-dark">
                <i className="ti ti-ban mt-0.5 text-sm shrink-0" aria-hidden="true" />
                <span>{err}<br />You can't delete or restore data that another owner deleted.</span>
              </div>
            ) : (
              <>
                <input
                  className="field-input text-center tracking-[0.5em]"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={passcode}
                  onChange={e => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
                {err && <p className="mt-2 text-sm text-danger">{err}</p>}
                <button
                  onClick={submit}
                  disabled={loading}
                  className="mt-4 w-full rounded-input bg-brand py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : 'Continue'}
                </button>
              </>
            )}

            {blocked && (
              <div className="mt-4 flex gap-2.5">
                <button
                  onClick={() => { setBlocked(false); setErr(''); setPasscode(''); }}
                  className="flex-1 rounded-input border border-line py-3 text-sm text-text-secondary"
                >
                  Try another passcode
                </button>
                <Link
                  href="/owner/settings"
                  className="mt-4 flex w-full items-center justify-center rounded-input border border-danger/25 bg-surface py-3 text-sm font-medium text-danger-dark"
                >
                  Back to settings
                </Link>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}