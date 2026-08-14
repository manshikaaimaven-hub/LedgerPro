/*
summaryService.ts is the data provider for the Summary page. 
It gathers information from five different backend endpoints—
overall financial summary, total customers, today's entries, top receivables, and top debts. 
By using Promise.all(), it requests all of them at the same time, 
making the dashboard load much faster than if it waited for each request one by one.
Finally, it combines the responses into a single, frontend-friendly object (using camelCase property names) 
that the SummaryPage can use directly. 
This keeps the Summary page simple and separates the API communication logic into one reusable service.
*/
import api from "@/lib/api";
import type {
  DashboardSummary,
  CustomersCountResponse,
  EntriesTodayResponse,
  TopBalanceEntry,
  SummaryPageData,
} from "@/types/summary";

/**
 * Fetches everything the Summary page needs in one go.
 *
 * Why Promise.all instead of 5 awaited calls in sequence:
 * these 5 endpoints don't depend on each other, so firing them
 * together means the page's total load time is roughly the SLOWEST
 * single call, not the SUM of all five.
 */
export async function fetchSummaryPageData(): Promise<SummaryPageData> {
  const [summaryRes, countRes, todayRes, receivablesRes, debtsRes] =
    await Promise.all([
      api.get<DashboardSummary>("/summary"),
      api.get<CustomersCountResponse>("/summary/customers-count"),
      api.get<EntriesTodayResponse>("/summary/entries-today"),
      api.get<TopBalanceEntry[]>("/summary/top-receivables"),
      api.get<TopBalanceEntry[]>("/summary/top-debts"),
    ]);

  return {
    totalCredit: summaryRes.data.total_credit,
    totalDebit: summaryRes.data.total_debit,
    netOutstanding: summaryRes.data.net_outstanding,
    netLabel: summaryRes.data.net_label,
    totalCustomers: countRes.data.total_customers,
    entriesToday: todayRes.data.entries_today,
    topReceivables: receivablesRes.data,
    topDebts: debtsRes.data,
  };
}