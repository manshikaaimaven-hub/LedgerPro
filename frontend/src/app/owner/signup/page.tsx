"use client";

/**
 * WHAT THIS PAGE DOES:
 * New business owner creates their LedgerPro account. Collects
 * username, email, password + business details, sends it all to
 * POST /auth/signup, and logs the user straight in on success
 * (backend returns tokens immediately, same as login).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconBuildingFactory2, IconEye, IconEyeOff, IconLoader2 } from "@tabler/icons-react";
import api from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();

  // One state object instead of 7 separate useState calls — easier to
  // reset, easier to spread straight into the request body.
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    business_name: "",
    phone: "",
    city: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Generic change handler — works for every field via its `name` attribute
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Basic required-field check before hitting the network at all
    const required: (keyof typeof form)[] = [
      "username", "email", "password", "full_name", "business_name",
    ];
    for (const field of required) {
      if (!form[field].trim()) {
        setError("Please fill in all required fields.");
        return;
      }
    }

    setLoading(true);
    try {
      // Backend checks duplicate username AND duplicate email
      const res = await api.post("/auth/signup", form);
      const { access_token, refresh_token, owner } = res.data;
      saveSession(access_token, refresh_token, owner);
      router.push("/");
    } catch (err: any) {
      // Backend distinguishes duplicate username vs duplicate email —
      // we just surface whatever message it sends.
      setError(err.response?.data?.detail || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
      // Same gradient + glow-blob background as login/forgot/reset, so the
      // whole auth flow feels like one connected product, not separate pages.
      <div className="relative flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-6 py-10 bg-gradient-to-b from-brand-light via-page to-page">
      <div className="pointer-events-none absolute -top-24 -left-20 w-64 h-64 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-16 w-64 h-64 rounded-full bg-indigo-300/20 blur-3xl" />

      <div className="relative">
        <div className="w-[60px] h-[60px] bg-gradient-to-br from-brand to-brand-dark rounded-card mx-auto mb-5 flex items-center justify-center text-white shadow-brand">
          <IconBuildingFactory2 size={28} stroke={1.75} />
        </div>

        <h1 className="text-center text-xl font-semibold text-text-primary mb-1">
          Create your account
        </h1>
        <p className="text-center text-sm text-text-secondary mb-7">
          Set up LedgerPro for your business
        </p>

        <form
          onSubmit={handleSignup}
          className="bg-surface/90 backdrop-blur border border-line rounded-card p-5 flex flex-col gap-4 shadow-card"
        >
          <Field label="Username *" name="username" value={form.username} onChange={handleChange} />
          <Field label="Email *" name="email" type="email" value={form.email} onChange={handleChange} />
          <Field
            label="Password *"
            name="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={handleChange}
            showToggle
            showPassword={showPassword}
            onToggle={() => setShowPassword(!showPassword)}
          />
          <Field label="Full name *" name="full_name" value={form.full_name} onChange={handleChange} />
          <Field label="Business name *" name="business_name" value={form.business_name} onChange={handleChange} />
          <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} />
          <Field label="City" name="city" value={form.city} onChange={handleChange} />

          {error && (
            <p className="fade-in text-[13px] text-danger text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand to-brand-dark hover:brightness-110 active:scale-[0.99] transition-all text-white rounded-input py-3.5 font-medium flex items-center justify-center gap-2 shadow-brand disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <IconLoader2 size={18} className="animate-spin" />}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* mb-4 added so this footer line has room to sit below the
            scrollable area instead of touching the very bottom edge */}
        <div className="text-center text-[13px] text-text-tertiary mt-6 mb-4">
          Already have an account?{" "}
          <Link href="/owner/login/" className="text-brand font-medium hover:text-brand-dark">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Small reusable field component so the form body above stays readable
 * instead of repeating the same label+input markup 7 times.
 */
function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  showToggle = false,
  showPassword = false,
  onToggle,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  showToggle?: boolean;
  showPassword?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          className="field-input pr-12"
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete="off"
          suppressHydrationWarning
        />

        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-brand transition-colors p-1"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
          </button>
        )}
      </div>
    </div>
  );
}