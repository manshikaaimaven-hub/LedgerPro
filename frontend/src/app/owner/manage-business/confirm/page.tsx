'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import api from '@/lib/api';
import { initials } from '@/lib/format';
import Link from 'next/link';

interface DeleteTargetProfile {
  id: string;
  full_name: string;
  business_name: string;
  city: string;
  phone_last4: string;
  status?: 'deleted_by_me';
}

export default function ManageBusinessConfirmPage() {
  const router = useRouter();
  const [target, setTarget] = useState<DeleteTargetProfile | null>(null);
  const [isDeleted, setIsDeleted] = useState(false); // local, drives the UI
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Access gate: blocks direct/bookmarked navigation to this page if the
  // caller's own business was deleted (by anyone) after the passcode step.
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [selfDeleted, setSelfDeleted] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        await api.get('/settings/profile');
        setSelfDeleted(false);
      } catch (e: any) {
        setSelfDeleted(e?.response?.status === 404);
      } finally {
        setCheckingAccess(false);
      }
    };
    checkAccess();
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem('manageBusinessTarget');
    if (!raw) {
      router.replace('/owner/manage-business');
      return;
    }
    const parsed: DeleteTargetProfile = JSON.parse(raw);
    setTarget(parsed);
    setIsDeleted(parsed.status === 'deleted_by_me');
  }, [router]);

  const runAction = async () => {
    if (!target) return;
    setBusy(true);
    setErr('');
    try {
      if (isDeleted) {
        await api.put(`/settings/business/${target.id}/restore`);
        setIsDeleted(false);
        setSuccessMsg(`${target.business_name} restored successfully.`);
      } else {
        await api.delete(`/settings/business/${target.id}`);
        setIsDeleted(true);
        setSuccessMsg(`${target.business_name} deleted successfully.`);
      }
      // Keep sessionStorage in sync in case the user navigates back to this
      // page (e.g. browser back) without re-verifying the passcode.
      sessionStorage.setItem(
        'manageBusinessTarget',
        JSON.stringify({ ...target, status: !isDeleted ? 'deleted_by_me' : undefined })
      );
    } catch (e: any) {
      setErr(e?.response?.data?.detail || `Could not ${isDeleted ? 'restore' : 'delete'} this business.`);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  // ---- Access gates: run before any of the "normal" page render ----
  if (checkingAccess) return null; // or a skeleton, same pattern as the passcode page

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

  if (!target) return null; // existing check stays as-is, after the access gate
  // ---- End access gates ----

  return (
    <ProtectedRoute>
      <AppShell title="Manage business data" subtitle="Review before you continue">
        <div className="flex flex-col gap-4 p-4">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center gap-3.5">
              <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-line bg-line/15 text-base font-semibold text-text-secondary">
                {initials(target.full_name)}
              </div>
              <div>
                <div className="text-[15px] font-medium text-text-primary">{target.business_name}</div>
                <div className="text-xs text-text-tertiary">{target.full_name} · {target.city}</div>
              </div>
            </div>

            {isDeleted ? (
              <div className="mb-4 flex items-center gap-2 rounded-input border border-danger/20 bg-danger-light px-3 py-2 text-xs font-medium text-danger-dark">
                <i className="ti ti-alert-circle text-sm" aria-hidden="true" />
                This business is already deleted by you. Please restore it if needed.
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2 rounded-input border border-line bg-line/10 px-3 py-2 text-xs font-medium text-text-secondary">
                <i className="ti ti-circle-check text-sm" aria-hidden="true" />
                This business is currently active.
              </div>
            )}

            {successMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-input border border-success/25 bg-success-light px-3 py-2.5 text-sm font-medium text-success-dark">
                <i className="ti ti-check text-sm shrink-0" aria-hidden="true" />
                {successMsg}
              </div>
            )}

            {err && <p className="mb-3 text-sm text-danger">{err}</p>}

            <button
              onClick={() => setConfirming(true)}
              disabled={busy}
              className={`w-full rounded-input py-3 text-sm font-medium text-white transition-colors disabled:opacity-60 ${
                isDeleted ? 'bg-brand hover:bg-brand-dark' : 'bg-danger hover:bg-danger-dark'
              }`}
            >
              {busy ? (isDeleted ? 'Restoring…' : 'Deleting…') : isDeleted ? 'Restore business data' : 'Delete business data'}
            </button>

            <Link
              href="/owner/settings"
              onClick={(e) => {
                if (busy) {
                  e.preventDefault();
                  return;
                }
                sessionStorage.removeItem('manageBusinessTarget');
              }}
              aria-disabled={busy}
              className={`mt-3 flex w-full items-center justify-center rounded-input border border-line py-3 text-sm text-text-secondary ${
                busy ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              Back to settings
            </Link>
          </div>
        </div>
      </AppShell>

      {confirming && (
        <ConfirmModal
          tone={isDeleted ? 'brand' : 'danger'}
          icon={isDeleted ? 'ti-rotate' : 'ti-trash'}
          title={isDeleted ? 'Restore this business?' : 'Delete this business?'}
          message={
            isDeleted
              ? `This restores live data for ${target.business_name} from backup.`
              : `This removes live data for ${target.business_name}. It can be restored later if needed.`
          }
          confirmLabel={isDeleted ? 'Restore' : 'Delete'}
          onCancel={() => setConfirming(false)}
          onConfirm={runAction}
        />
      )}
    </ProtectedRoute>
  );
}

function ConfirmModal({
  tone,
  icon,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  tone: 'danger' | 'brand';
  icon: string;
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDanger = tone === 'danger';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-6 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-card">
        <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full border ${isDanger ? 'border-danger/25 text-danger-dark' : 'border-brand/25 text-brand-dark'}`}>
          <i className={`ti ${icon} text-base`} aria-hidden="true" />
        </div>
        <div className="mb-1.5 text-[15px] font-semibold text-text-primary">{title}</div>
        <p className="mb-6 text-sm leading-relaxed text-text-secondary">{message}</p>
        <div className="flex gap-2.5">
          <button onClick={onCancel} className="flex-1 rounded-input border border-line py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-line/10">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 rounded-input py-2.5 text-sm font-medium text-white transition-colors ${isDanger ? 'bg-danger hover:bg-danger-dark' : 'bg-brand hover:bg-brand-dark'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}