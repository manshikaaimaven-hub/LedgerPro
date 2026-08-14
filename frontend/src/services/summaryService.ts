import api from "@/lib/api";
import type {
  DashboardSummary,
  CustomersCountResponse,
  EntriesTodayResponse,
  TopBalanceEntry,
  SummaryPageData,
} from "@/types/summary";

const EMPTY_SUMMARY: DashboardSummary = {
  total_credit: 0,
  total_debit: 0,
  net_outstanding: 0,
  net_label: "receivable",
};

function unwrap<T>(
  result: PromiseSettledResult<{ data: T }>,
  fallback: T
): T {
  return result.status === "fulfilled" ? result.value.data : fallback;
}

/**
 * Fetches everything the Summary page needs in one go.
 *
 * Uses Promise.allSettled instead of Promise.all so that a single
 * failing endpoint (e.g. a transient error right after signup, or
 * one slow cold-start call) doesn't take down the whole page. Each
 * card falls back to its zero/empty state independently.
 */
export async function fetchSummaryPageData(): Promise<SummaryPageData> {
  const [summaryRes, countRes, todayRes, receivablesRes, debtsRes] =
    await Promise.allSettled([
      api.get<DashboardSummary>("/summary"),
      api.get<CustomersCountResponse>("/summary/customers-count"),
      api.get<EntriesTodayResponse>("/summary/entries-today"),
      api.get<TopBalanceEntry[]>("/summary/top-receivables"),
      api.get<TopBalanceEntry[]>("/summary/top-debts"),
    ]);

  const summary = unwrap(summaryRes, EMPTY_SUMMARY);

  return {
    totalCredit: summary.total_credit,
    totalDebit: summary.total_debit,
    netOutstanding: summary.net_outstanding,
    netLabel: summary.net_label,
    totalCustomers: unwrap(countRes, { total_customers: 0 }).total_customers,
    entriesToday: unwrap(todayRes, { entries_today: 0 }).entries_today,
    topReceivables: unwrap(receivablesRes, [] as TopBalanceEntry[]),
    topDebts: unwrap(debtsRes, [] as TopBalanceEntry[]),
  };
}