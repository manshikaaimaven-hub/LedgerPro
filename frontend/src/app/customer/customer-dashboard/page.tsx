/*
  ORIGINAL PATH: src/app/customer-dashboard/page.tsx

  The customer's home screen. Shows:
  1. 6 stat cards (balance, total txns, total credit, total debit,
     amount paid, remaining)
  2. Recent transactions list (last 5)
  3. A simple monthly bar summary (credit vs debit per month) — plain
     divs sized by percentage, no chart library needed for 6 bars

  Loading state: skeleton cards while fetching.
  Error state: simple retry message if the API call fails.
*/
"use client";

import { useEffect, useState } from "react";
import CustomerProtectedRoute from "@/components/customer-shell/CustomerProtectedRoute";
import { CustomerShell } from "@/components/customer-shell/CustomerShell";
import { StatCard } from "@/components/customer-shell/StatCard";
import { getCurrentBusiness } from "@/lib/currentBusiness";
import { fetchSummary, type DashboardSummary } from "@/services/customerDashboardService";
import { formatINR } from "@/lib/format";
import Link from "next/link";

export default function CustomerDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const business = getCurrentBusiness();
    if (!business) return;

    fetchSummary(business.ownerId)
      .then(setSummary)
      .catch(() => setError("Couldn't load your dashboard. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CustomerProtectedRoute>
      <CustomerShell title="Dashboard" subtitle="Your account overview">
        {loading && <DashboardSkeleton />}

        {!loading && error && (
          <div className="bg-white border border-line rounded-card p-8 text-center text-text-secondary">
            {error}
          </div>
        )}

        {!loading && !error && summary && (
          <div className="flex flex-col gap-6">
            {/* ── Balance highlight ── */}
            <div className="bg-white border border-line rounded-card p-6 shadow-card flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-sm text-text-secondary mb-1">Current balance</div>
                <div
                  className={`text-3xl font-semibold ${
                    summary.net_label === "payable" ? "text-danger" : "text-success"
                  }`}
                >
                  {formatINR(summary.current_balance)}
                </div>
              </div>
              <span
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium capitalize ${
                  summary.net_label === "payable"
                    ? "bg-danger-light text-danger-dark"
                    : "bg-success-light text-success-dark"
                }`}
              >
                {summary.net_label}
              </span>
            </div>

            {/* ── Stat grid ── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <StatCard icon="ti-receipt-2" label="Total transactions" value={String(summary.total_transactions)} tone="brand" />
              <StatCard icon="ti-arrow-down-circle" label="Total credit" value={formatINR(summary.total_credit)} tone="success" />
              <StatCard icon="ti-arrow-up-circle" label="Total debit" value={formatINR(summary.total_debit)} tone="danger" />
              <StatCard icon="ti-cash" label="Amount paid" value={formatINR(summary.amount_paid)} tone="info" />
              <StatCard icon="ti-hourglass" label="Remaining amount" value={formatINR(summary.remaining_amount)} tone="warning" />
              <StatCard icon="ti-calendar-stats" label="This month" value={summary.monthly_summary.at(-1)?.month || "—"} tone="gold" />
            </div>

            {/* ── Monthly summary (simple bar rows, no chart lib) ── */}
            {summary.monthly_summary.length > 0 && (
              <div className="bg-white border border-line rounded-card p-5 shadow-card">
                <div className="text-sm font-medium text-text-primary mb-4">Monthly summary</div>
                <div className="flex flex-col gap-3">
                  {summary.monthly_summary.map((m) => {
                    const max = Math.max(...summary.monthly_summary.map((x) => Math.max(x.total_credit, x.total_debit)), 1);
                    return (
                      <div key={m.month}>
                        <div className="flex justify-between text-xs text-text-secondary mb-1">
                          <span>{m.month}</span>
                          <span>
                            {formatINR(m.total_credit)} / {formatINR(m.total_debit)}
                          </span>
                        </div>
                        <div className="flex gap-1 h-2">
                          <div className="bg-success rounded-full" style={{ width: `${(m.total_credit / max) * 100}%` }} />
                          <div className="bg-danger rounded-full" style={{ width: `${(m.total_debit / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Recent transactions ── */}
            <div className="bg-white border border-line rounded-card overflow-hidden shadow-card">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-page">
                <div className="text-sm font-medium text-text-primary">Recent transactions</div>
                <Link href="/customer/customer-transactions" className="text-xs font-medium text-brand-dark">
                  View all
                </Link>
              </div>
              {summary.recent_transactions.length === 0 ? (
                <EmptyState icon="ti-receipt-off" text="No transactions yet." />
              ) : (
                summary.recent_transactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-line last:border-none">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        t.type === "cr" ? "bg-success-light text-success" : "bg-danger-light text-danger"
                      }`}
                    >
                      <i className={`ti ${t.type === "cr" ? "ti-arrow-down-circle" : "ti-arrow-up-circle"}`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{t.note || (t.type === "cr" ? "Credit note" : "Debit note")}</div>
                      <div className="text-xs text-text-tertiary mt-0.5">{new Date(t.entry_date).toLocaleDateString("en-IN")}</div>
                    </div>
                    <div className={`text-sm font-medium ${t.type === "cr" ? "text-success" : "text-danger"}`}>
                      {t.type === "cr" ? "+" : "-"}
                      {formatINR(t.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Quick actions ── */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/customer/customer-transactions"
                className="bg-white border border-line rounded-card p-4 flex items-center gap-3 hover:bg-page transition-colors shadow-card"
              >
                <div className="w-10 h-10 rounded-input bg-brand-light text-brand-dark flex items-center justify-center">
                  <i className="ti ti-receipt-2 text-lg" aria-hidden="true" />
                </div>
                <div className="text-sm font-medium text-text-primary">View transactions</div>
              </Link>
              <Link
                href="/customer/customer-restore-requests"
                className="bg-white border border-line rounded-card p-4 flex items-center gap-3 hover:bg-page transition-colors shadow-card"
              >
                <div className="w-10 h-10 rounded-input bg-gold-light text-gold-dark flex items-center justify-center">
                  <i className="ti ti-rotate-clockwise-2 text-lg" aria-hidden="true" />
                </div>
                <div className="text-sm font-medium text-text-primary">Restore requests</div>
              </Link>
            </div>
          </div>
        )}
      </CustomerShell>
    </CustomerProtectedRoute>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-24 bg-white border border-line rounded-card" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-white border border-line rounded-card" />
        ))}
      </div>
      <div className="h-48 bg-white border border-line rounded-card" />
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-10 text-text-secondary">
      <i className={`ti ${icon} text-4xl text-text-tertiary block mb-3`} aria-hidden="true" />
      <p className="text-sm">{text}</p>
    </div>
  );
}