/**
 * ORIGINAL PATH: src/app/customer-signup/page.tsx
 *
 * Landing page for the invite link an owner emails (e.g.
 * /customer-signup?token=xxxx). It never assumes which outcome applies —
 * it always asks the backend first (GET /auth/invite-preview), then shows
 * one of three states:
 *
 *   loading   — waiting on the preview call
 *   returning — an account already exists for this email → send them to
 *               /customer-login instead of showing a signup form
 *   new       — no account yet → show the username/password form
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  IconBuildingStore,
  IconUserCheck,
  IconLock,
  IconMail,
  IconArrowRight,
  IconAlertTriangle,
  IconLoader2,
  IconReceipt2,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import {
  previewInvite,
  customerSignup,
  saveCustomerSession,
  InvitePreview,
} from "@/services/customerAuthService";

export default function CustomerSignupPage() {
  return (
    <Suspense fallback={<PageShell><LoadingCard /></PageShell>}>
      <CustomerSignupContent />
    </Suspense>
  );
}

/** Shared background + centering so every state (loading/error/form) looks consistent. */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mesh-light flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-brand-light/60 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-gold-light/70 blur-3xl animate-float-slower" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="bg-surface rounded-card shadow-card p-10 flex flex-col items-center gap-3 fade-in">
      <IconLoader2 className="animate-spin text-brand" size={28} />
      <p className="text-text-secondary text-sm">Checking your invitation…</p>
    </div>
  );
}

function CustomerSignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState("");


  // Step 1: ask the backend what this invite actually is, before rendering any form.
  useEffect(() => {
    if (!token) {
      setLoadError("This invitation link is missing its token. Please use the link from your email.");
      setStatus("error");
      return;
    }
    previewInvite(token)
      .then((data) => {
        setPreview(data);
        setStatus("ready");
      })
      .catch((err) => {
        setLoadError(err?.response?.data?.detail || "This invitation link is no longer valid.");
        setStatus("error");
      });
  }, [token]);

  if (status === "loading") return <PageShell><LoadingCard /></PageShell>;

  if (status === "error") {
    return (
      <PageShell>
        <div className="bg-surface rounded-card shadow-card p-8 fade-in">
          <div className="w-12 h-12 rounded-full bg-danger-light text-danger flex items-center justify-center mb-4">
            <IconAlertTriangle size={24} />
          </div>
          <h1 className="font-display text-xl text-text-primary mb-2">Invitation not valid</h1>
          <p className="text-sm text-text-secondary leading-relaxed">{loadError}</p>
          <p className="text-sm text-text-secondary mt-4">
            Ask the business that invited you to send a fresh invite link.
          </p>
        </div>
      </PageShell>
    );
  }

  // status === "ready" — preview is guaranteed non-null here
  return (
    <PageShell>
      {preview!.account_already_exists ? (
        <ReturningAccountCard preview={preview!} token={token} router={router} />
      ) : (
        <NewAccountForm preview={preview!} token={token} router={router} />
      )}
    </PageShell>
  );
}

/** Voucher-style header echoing the ledger-receipt look used elsewhere in the app. */
function InviteStub({ preview }: { preview: InvitePreview }) {
  return (
    <div
      className="voucher-stub voucher-stub--credit rounded-t-card px-6 pt-6 pb-5"
      style={{ ["--notch-bg" as any]: "#fff" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="stamp-badge w-11 h-11 rounded-input bg-success-light text-success flex items-center justify-center flex-shrink-0">
          <IconReceipt2 size={22} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-success-dark font-medium">
            Ledger invitation
          </div>
          <div className="font-display text-lg text-text-primary leading-tight">
            {preview.business_name}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <IconMail size={16} className="flex-shrink-0" />
        <span>{preview.email}</span>
      </div>
      <div className="voucher-stub__tear mt-5" />
    </div>
  );
}

function ReturningAccountCard({
  preview,
  token,
  router,
}: {
  preview: InvitePreview;
  token: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="bg-surface rounded-card shadow-card overflow-hidden fade-in">
      <InviteStub preview={preview} />
      <div className="px-6 pb-6 pt-5">
        <h1 className="font-display text-lg text-text-primary mb-2">
          Welcome back, {preview.customer_name}
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          You already have a LedgerPro account for {preview.email}. Log in and we&apos;ll link{" "}
          {preview.business_name} to it — no new password needed.
        </p>
        <button
          onClick={() => router.push(`/customer/customer-login?linkToken=${encodeURIComponent(token)}`)}
          className="w-full bg-brand hover:bg-brand-dark text-white rounded-input py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          Log in to link this business
          <IconArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function NewAccountForm({
  preview,
  token,
  router,
}: {
  preview: InvitePreview;
  token: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    // Client-side checks mirror the backend's Field(min_length=...) constraints,
    // so people get instant feedback instead of a round trip for typos.
    if (username.trim().length < 3) {
      setFormError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 4) {
      setFormError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
        await customerSignup(token, username.trim(), password);

        // Don't log the user in automatically.
        router.push(`/customer/customer-login?signedUp=1`);
        } catch (err: any) {
        setFormError(
            err?.response?.data?.detail ||
            "Could not create your account. Please try again."
        );
        } finally {
        setSubmitting(false);
        }
  }

  return (
    <div className="bg-surface rounded-card shadow-card overflow-hidden fade-in">
      <InviteStub preview={preview} />
      <form onSubmit={handleSubmit} className="px-6 pb-6 pt-5 flex flex-col gap-4">
        <div>
          <h1 className="font-display text-lg text-text-primary mb-1">Set up your login</h1>
          <p className="text-sm text-text-secondary">
            {preview.customer_name}, choose a username and password — you&apos;ll use this to view
            your balance with {preview.business_name}, and any other business that invites you later.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Username</label>
          <div className="relative">
            <IconUserCheck size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              className="field-input field-input-icon-l"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              suppressHydrationWarning
            />
          </div>
        </div>

        <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Password
            </label>

            <div className="relative">
                <IconLock
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
                />

                <input
                type={showPassword ? "text" : "password"}
                className="field-input field-input-icon-l pr-11"
                placeholder="At least 4 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                suppressHydrationWarning
                />

                <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                aria-label={showPassword ? "Hide password" : "Show password"}
                >
                {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
            </div>
        </div>

        <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                Confirm password
            </label>

            <div className="relative">
                <IconLock
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
                />

                <input
                type={showConfirmPassword ? "text" : "password"}
                className="field-input field-input-icon-l pr-11"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                suppressHydrationWarning
                />

                <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                {showConfirmPassword ? (
                    <IconEyeOff size={18} />
                ) : (
                    <IconEye size={18} />
                )}
                </button>
            </div>
        </div>

        {formError && (
          <div className="text-sm text-danger bg-danger-light rounded-input px-3.5 py-2.5 fade-in">
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-success hover:bg-success-dark disabled:opacity-60 text-white rounded-input py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors mt-1"
        >
          {submitting ? <span className="btn-spinner" /> : <IconBuildingStore size={17} />}
          {submitting ? "Creating account…" : "Create account & continue"}
        </button>
      </form>
    </div>
  );
}