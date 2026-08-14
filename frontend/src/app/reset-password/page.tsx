"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconLockCheck, IconLoader2 } from "@tabler/icons-react";
import api from "@/lib/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      return setError("This reset link is invalid or has expired.");
    }

    if (newPassword.length < 4) {
      return setError("Password must be at least 4 characters.");
    }

    if (newPassword !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    setLoading(true);

    try {
      await api.post("/auth/reset-password", {
        token,
        new_password: newPassword,
      });

      setSuccess(true);

      setTimeout(() => {
        router.push("/login/");
      }, 2000);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Could not reset password. The link may have expired."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex-1 flex flex-col justify-center px-6 py-10 overflow-hidden bg-gradient-to-b from-indigo-50 via-page to-page">
      <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-brand/20 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-indigo-300/20 blur-3xl" />

      <div className="relative">
        <div className="w-16 h-16 bg-gradient-to-br from-brand to-brand-dark rounded-card mx-auto mb-5 flex items-center justify-center text-white shadow-brand">
          <IconLockCheck size={28} stroke={1.75} />
        </div>

        <h1 className="text-center text-xl font-semibold text-text-primary mb-2">
          Set a new password
        </h1>

        <p className="text-center text-sm text-text-secondary mb-8">
          Choose a strong new password for your LedgerPro account
        </p>

        {success ? (
          <div className="fade-in text-center text-sm text-text-primary bg-success-light border border-success/20 rounded-card p-4">
            Password updated successfully. Redirecting you to sign in…
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-surface/90 backdrop-blur border border-line rounded-card p-5 flex flex-col gap-4 shadow-card"
          >
            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
                New password
              </label>

              <input
                className="field-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 4 characters"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
                Confirm new password
              </label>

              <input
                className="field-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="fade-in text-[13px] text-danger text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand to-brand-dark hover:brightness-110 active:scale-[0.99] transition-all text-white rounded-input py-3.5 font-medium flex items-center justify-center gap-2 shadow-brand disabled:opacity-60"
            >
              {loading && (
                <IconLoader2 size={18} className="animate-spin" />
              )}

              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p>Loading...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}