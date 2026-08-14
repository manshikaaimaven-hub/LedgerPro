"use client";

import { useEffect, useState } from "react";
import {
  IconLayoutDashboard,
  IconTrendingUp,
  IconAlertTriangle,
  IconArrowDownCircle,
  IconArrowUpCircle,
  IconUsers,
  IconCalendarStats,
} from "@tabler/icons-react";
import { fetchSummaryPageData } from "@/services/summaryService";
import type { SummaryPageData } from "@/types/summary";
import { NetOutstandingCard } from "../../components/summary/NetOutstandingCard";
import { StatCard } from "../../components/summary/StatCard";
import { HighlightCard } from "../../components/summary/HighlightCard";

function formatCurrency(n: number): string {
  return "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

export default function SummaryPage() {
  const [data, setData] = useState<SummaryPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await fetchSummaryPageData();
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError("Couldn't load your summary. Pull down to retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm bg-page">
        Loading summary…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-danger text-sm px-6 text-center bg-page">
        {error ?? "Something went wrong."}
      </div>
    );
  }

  return (
    // Plain light page background + two faint corner blobs that never
    // reach the content area. relative + overflow-hidden keeps the blobs
    // from pushing the page wider or adding scrollbars of their own.
    <div className="relative flex-1 h-full overflow-y-auto overflow-x-hidden bg-page">
      <div className="pointer-events-none fixed -top-10 -right-24 w-64 h-64 rounded-full bg-brand/8 blur-3xl" />
      <div className="pointer-events-none fixed bottom-10 -left-24 w-64 h-64 rounded-full bg-gold/6 blur-3xl" />

      <div className="relative p-4 flex flex-col gap-3.5">
        {/* <div className="text-xs font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1.5"> */}
          <div className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
          <IconLayoutDashboard size={15} />
          Ledger summary
        </div>

        <NetOutstandingCard net={data.netOutstanding} label={data.netLabel} />

        <div className="grid grid-cols-2 gap-2.5">
          <StatCard icon={IconArrowDownCircle} label="Total credit" value={formatCurrency(data.totalCredit)} color="green" />
          <StatCard icon={IconArrowUpCircle} label="Total debit" value={formatCurrency(data.totalDebit)} color="red" />
          <StatCard icon={IconUsers} label="Total customers" value={String(data.totalCustomers)} color="amber" />
          <StatCard icon={IconCalendarStats} label="Entries today" value={String(data.entriesToday)} color="blue" />
        </div>

        {/* <div className="text-xs font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1.5"> */}
          <div className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
          <IconTrendingUp size={15} />
          Highest outstanding
        </div>
        <HighlightCard
          title="Most to receive from"
          icon={IconTrendingUp}
          variant="positive"
          entries={data.topReceivables}
          emptyMessage="No outstanding receivables"
        />

        {/* <div className="text-xs font-medium text-text-secondary uppercase tracking-wide flex items-center gap-1.5"> */}
          <div className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
          <IconAlertTriangle size={15} />
          Highest debt
        </div>
        <HighlightCard
          title="Customers with highest debit"
          icon={IconAlertTriangle}
          variant="negative"
          entries={data.topDebts}
          emptyMessage="No customers with debt"
          className="flex-1"
        />
      </div>
    </div>
  );
}