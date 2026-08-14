// These interfaces mirror the exact JSON shapes returned by your
// FastAPI summary router. Keeping them 1:1 with backend field names
// (snake_case) avoids a translation layer — we just type the raw response.

export interface DashboardSummary {
  total_credit: number;
  total_debit: number;
  net_outstanding: number;
  net_label: "receivable" | "payable";
}

export interface CustomersCountResponse {
  total_customers: number;
}

export interface EntriesTodayResponse {
  entries_today: number;
}

// Shared shape for both top-receivables and top-debts rows
export interface TopBalanceEntry {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

// The fully-assembled summary the page actually renders.
// We build this client-side from the 5 separate responses.
export interface SummaryPageData {
  totalCredit: number;
  totalDebit: number;
  netOutstanding: number;
  netLabel: "receivable" | "payable";
  totalCustomers: number;
  entriesToday: number;
  topReceivables: TopBalanceEntry[];
  topDebts: TopBalanceEntry[];
}