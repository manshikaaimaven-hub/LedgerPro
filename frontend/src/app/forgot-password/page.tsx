"use client";

import { useState } from "react";
import Link from "next/link";
import { IconMailFast, IconLoader2, IconCircleCheck } from "@tabler/icons-react";
import api from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } catch {
      // silent on purpose — see note in previous version
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="relative flex-1 flex flex-col justify-center px-6 py-10 overflow-hidden bg-gradient-to-b from-indigo-50 via-page to-page">
      <div className="pointer-events-none absolute -top-20 -left-16 w-56 h-56 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 w-56 h-56 rounded-full bg-indigo-300/20 blur-3xl" />

      <div className="relative">
        <div className="w-16 h-16 bg-gradient-to-br from-brand to-brand-dark rounded-card mx-auto mb-5 flex items-center justify-center text-white shadow-brand">
          <IconMailFast size={28} stroke={1.75} />
        </div>

        <h1 className="text-center text-xl font-semibold text-text-primary mb-2">
          Forgot password?
        </h1>
        <p className="text-center text-sm text-text-secondary mb-8">
          No worries — enter your email and we&apos;ll send you a reset link
        </p>

        {submitted ? (
          <div className="fade-in flex items-start gap-3 bg-success-light border border-success/20 rounded-card p-4">
            <IconCircleCheck size={22} className="text-success flex-shrink-0 mt-0.5" />
            <p className="text-sm text-text-primary leading-relaxed">
              If an account exists for <span className="font-medium">{email}</span>,
              a reset link is on its way. Check your inbox (and spam folder).
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-surface/90 backdrop-blur border border-line rounded-card p-5 flex flex-col gap-4 shadow-card"
          >
            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
                Email address
              </label>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                autoComplete="email"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand to-brand-dark hover:brightness-110 active:scale-[0.99] transition-all text-white rounded-input py-3.5 font-medium flex items-center justify-center gap-2 shadow-brand disabled:opacity-60"
            >
              {loading && <IconLoader2 size={18} className="animate-spin" />}
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <div className="text-center text-[13px] text-text-tertiary mt-6">
          <Link href="/owner/login/" className="text-brand font-medium hover:text-brand-dark">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}