"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconBuildingFactory2, IconEye, IconEyeOff, IconLoader2 } from "@tabler/icons-react";
import api from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();

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
  // NEW: per-field errors, keyed by field name
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Clear that field's error as soon as the user edits it again
    if (fieldErrors[e.target.name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[e.target.name];
        return next;
      });
    }
  }

  // Client-side check so we don't even hit the network for an obvious typo
  function validatePhone(phone: string): string | null {
    if (!phone.trim()) return "Phone number is required";
    if (!/^\d{10}$/.test(phone.trim())) {
      return "Phone number must be exactly 10 digits";
    }
    return null;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const required: (keyof typeof form)[] = [
      "username", "email", "password", "full_name", "business_name", "phone",
    ];
    for (const field of required) {
      if (!form[field].trim()) {
        setError("Please fill in all required fields.");
        return;
      }
    }

    // NEW: client-side phone check before hitting the backend
    const phoneError = validatePhone(form.phone);
    if (phoneError) {
      setFieldErrors({ phone: phoneError });
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/signup", form);
      router.push("/owner/login/");
    } catch (err: any) {
      const detail = err.response?.data?.detail;

      // NEW: FastAPI 422 errors come back as an array of {loc, msg}
      if (Array.isArray(detail)) {
        const newFieldErrors: Record<string, string> = {};
        for (const d of detail) {
          const field = d.loc?.[d.loc.length - 1];
          if (field) {
            // Strip pydantic's "Value error, " prefix for a cleaner message
            newFieldErrors[field] = d.msg.replace(/^Value error,\s*/, "");
          }
        }
        setFieldErrors(newFieldErrors);
      } else {
        // Plain string detail (e.g. "Username already taken")
        setError(detail || "Signup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
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
          <Field
            label="Phone *"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            error={fieldErrors.phone}
          />
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

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  showToggle = false,
  showPassword = false,
  onToggle,
  error, // NEW
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  showToggle?: boolean;
  showPassword?: boolean;
  onToggle?: () => void;
  error?: string; // NEW
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          className={`field-input pr-12 ${error ? "border-danger" : ""}`}
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

      {/* NEW: inline error just below this specific field */}
      {error && (
        <p className="fade-in text-[12px] text-danger mt-1">{error}</p>
      )}
    </div>
  );
}