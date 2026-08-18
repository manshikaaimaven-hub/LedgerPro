/**
 * ORIGINAL PATH: src/app/customer-login/page.tsx
 *
 * Login screen for the CUSTOMER role (separate from /login, the owner
 * login). Two ways someone lands here:
 *
 *   1. Direct visit — just wants to check their balance. On success,
 *      goes to /customer/dashboard.
 *   2. Via ?linkToken=xxx — the signup page detected they already have
 *      an account and sent them here to log in and attach a new
 *      business. After login, we call linkInvite() with that token.
 */
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconLock, IconUserCircle, IconEye, IconEyeOff, IconReceipt2 } from "@tabler/icons-react";
import { customerLogin, linkInvite, saveCustomerSession } from "@/services/customerAuthService";
import { getMyBusinesses } from "@/services/customerAuthService";
import { setCurrentBusiness } from "@/lib/currentBusiness";

export default function CustomerLoginPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="bg-surface rounded-card shadow-card p-10 text-center text-text-secondary text-sm">
            Loading…
          </div>
        </PageShell>
      }
    >
      <CustomerLoginContent />
    </Suspense>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mesh-light flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full bg-info-light/60 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-brand-light/60 blur-3xl animate-float-slower" />
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}

function CustomerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkToken = searchParams.get("linkToken");
  const justSignedUp = searchParams.get("signedUp") === "1";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: authenticate — identical call whether or not we're linking.
      const data = await customerLogin(username.trim(), password);
      saveCustomerSession(data.access_token, data.full_name);

      // Step 2: only reached once we have a valid customer token, since
      // /auth/customer-link-invite requires auth to know WHICH account to link.
      if (linkToken) {
        await linkInvite(linkToken);
      }
      // Step 3: figure out which business to show.
      // - 1 business  → auto-select it, go straight to the dashboard
      // - 2+ businesses → send them to a picker page (not built yet)
      // - 0 businesses → shouldn't happen post-login, but handle gracefully
      const businesses = await getMyBusinesses();

      if (businesses.length === 1) {
        setCurrentBusiness(businesses[0].owner_id, businesses[0].business_name);
        router.push("/customer/customer-dashboard");
        } else if (businesses.length > 1) {
          router.push("/customer-select-business");
        } else {
          setError("Your account isn't linked to any business yet.");
        }
      } catch (err: any) {
        setError(err?.response?.data?.detail || "Incorrect username or password.");
      } finally {
        setSubmitting(false);
       }
    }

  const heading = linkToken
    ? "Log in to link this business"
    : justSignedUp
    ? "Account created"
    : "Customer login";

  const subheading = linkToken
    ? "Sign in with your existing LedgerPro account to add this invite."
    : justSignedUp
    ? "Sign in with the username and password you just created."
    : "View your balance and transaction history.";
      return (
    <PageShell>
      <div className="bg-surface rounded-card shadow-card p-8 fade-in">
        <div className="w-14 h-14 rounded-input bg-brand flex items-center justify-center text-white mx-auto mb-5">
          <IconReceipt2 size={28} />
        </div>
        <h1 className="font-display text-2xl text-text-primary text-center mb-1">
          {heading}
        </h1>
        <p className="text-sm text-text-secondary text-center mb-7">
          {subheading}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Username</label>
            <div className="relative">
              <IconUserCircle size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                className="field-input field-input-icon-l"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                suppressHydrationWarning
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Password</label>
            <div className="relative">
              <IconLock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type={showPw ? "text" : "password"}
                className="field-input field-input-icon-l field-input-icon-r"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                suppressHydrationWarning
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                aria-label="Toggle password visibility"
              >
                {showPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-danger bg-danger-light rounded-input px-3.5 py-2.5 fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 text-white rounded-input py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors mt-1"
          >
            {submitting && <span className="btn-spinner" />}
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="text-center text-[13px] text-text-tertiary mt-6 leading-relaxed">
          <p className="text-xs text-text-tertiary mb-3 leading-relaxed">
            Don&apos;t have an account yet? Ask the business you trade with to send you an invite link.
          </p>
          <span className="inline-block border-t border-line/60 pt-3 w-full">
            Are you a business owner?{" "}
            <Link href="/owner/login/" className="text-brand font-medium hover:text-brand-dark">
              Owner login
            </Link>
          </span>
        </div>
      </div>
    </PageShell>
  );
}