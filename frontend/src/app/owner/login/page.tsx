"use client";

/**
 * log-in screen. User enters username + password, we call
 * POST /auth/login. Same generic error on wrong username OR
 * wrong password, on purpose, so attackers can't tell which
 * usernames exist in the system.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconReceipt2, IconEye, IconEyeOff, IconLoader2 } from "@tabler/icons-react";
import api from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { username, password });
      const { access_token, refresh_token, owner } = res.data;
      saveSession(access_token, refresh_token, owner);
      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Incorrect username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    // Gradient page background + soft glow blobs = the "attractive, not
    // plain white" look. relative + overflow-hidden lets the blurred
    // circles sit behind the card without spilling outside the phone frame.
    <div className="relative flex-1 flex flex-col justify-center px-6 py-10 overflow-hidden bg-gradient-to-b from-indigo-55 via-page to-page">
      {/* decorative glow blobs — purely visual, no content */}
      <div className="pointer-events-none absolute -top-24 -right-20 w-64 h-64 rounded-full bg-brand/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 w-64 h-64 rounded-full bg-indigo-300/40 blur-3xl" />

      <div className="relative">
        {/* Logo badge with gradient + glow shadow */}
        <div className="w-[72px] h-[72px] bg-gradient-to-br from-brand to-brand-dark rounded-card mx-auto mb-6 flex items-center justify-center text-white shadow-brand">
          <IconReceipt2 size={34} stroke={1.75} />
        </div>

        <h1 className="text-center text-2xl font-semibold text-text-primary mb-1.5">
          LedgerPro
        </h1>
        <p className="text-center text-sm text-text-secondary mb-8">
          Sign in to manage your customer ledgers
        </p>

        <form
          onSubmit={handleLogin}
          className="bg-surface/90 backdrop-blur border border-line rounded-card p-5 shadow-card"
        >
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Username
            </label>
            <input
              className="field-input"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              suppressHydrationWarning
            />
          </div>

          <div className="mb-1">
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                className="field-input pr-12"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                suppressHydrationWarning
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-brand transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="fade-in text-[13px] text-danger text-center mt-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand to-brand-dark hover:brightness-110 active:scale-[0.99] transition-all text-white rounded-input py-3.5 font-medium mt-5 flex items-center justify-center gap-2 shadow-brand disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <IconLoader2 size={18} className="animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="text-center text-[13px] text-text-tertiary mt-6 leading-relaxed">
          Don&apos;t have an account?{" "}
          <Link href="/owner/signup/" className="text-brand font-medium hover:text-brand-dark">
            Sign up
          </Link>
          <br />
          <Link href="/forgot-password/" className="text-brand hover:text-brand-dark">
            Forgot password?
          </Link>
          <br />
          <span className="mt-1 inline-block">
            Checking your own balance?{" "}
            <Link href="/customer/customer-login/" className="text-brand font-medium hover:text-brand-dark">
              Customer login
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}