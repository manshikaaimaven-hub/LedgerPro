/*
  ORIGINAL PATH: src/services/customerDashboardService.ts

  One function per backend endpoint from customer_dashboard_router.py.
  Every function takes ownerId as the first argument (matches the
  /customer/{owner_id}/... prefix) so pages never build URL strings
  by hand.

  Types mirror the Pydantic response_models field-for-field.
*/
import customerApi from "@/lib/customerApi";

// ── Types ─────────────────────────────────────────────────────
export interface RecentTransaction {
  id: string;
  type: "cr" | "dr";
  amount: number;
  note: string | null;
  invoice_number: string | null;
  entry_date: string;
}

export interface MonthlyBucket {
  month: string;
  total_credit: number;
  total_debit: number;
}

export interface DashboardSummary {
  current_balance: number;
  net_label: "receivable" | "payable" | "settled";
  total_transactions: number;
  total_credit: number;
  total_debit: number;
  amount_paid: number;
  remaining_amount: number;
  recent_transactions: RecentTransaction[];
  monthly_summary: MonthlyBucket[];
}

export interface CustomerTransaction {
  id: string;
  type: "cr" | "dr";
  amount: number;
  note: string | null;
  invoice_number: string | null;
  entry_date: string;
  running_balance?: number | null;
  amount_edited?: boolean;        // add
  original_amount?: number | null; // add
  original_type?: "cr" | "dr" | null; // add
}

export interface PaginatedTransactions {
  items: CustomerTransaction[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface TransactionListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: "cr" | "dr";
  date_from?: string;
  date_to?: string;
  sort?: "asc" | "desc";
}

export interface DeletedTransaction extends CustomerTransaction {
  deleted_at: string;
  already_requested: boolean;
}

export interface RestoreRequest {
  id: string;
  transaction_id: string;
  transaction_snapshot: CustomerTransaction | null;
  status: "pending" | "approved" | "rejected" | "restored";
  customer_note: string | null;
  owner_response: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface OwnerInfo {
  full_name: string;
  business_name: string;
  email: string;
  phone: string | null;
  city: string | null;
}

export interface CustomerProfile {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  username: string;
}

// ── Dashboard ────────────────────────────────────────────────
export async function fetchSummary(ownerId: string): Promise<DashboardSummary> {
  const res = await customerApi.get<DashboardSummary>(`/customer/${ownerId}/summary`);
  return res.data;
}

// ── Transactions ─────────────────────────────────────────────
export async function fetchTransactions(
  ownerId: string,
  params: TransactionListParams
): Promise<PaginatedTransactions> {
  const res = await customerApi.get<PaginatedTransactions>(
    `/customer/${ownerId}/transactions`,
    { params }
  );
  return res.data;
}

export async function fetchTransaction(ownerId: string, txnId: string): Promise<CustomerTransaction> {
  const res = await customerApi.get<CustomerTransaction>(`/customer/${ownerId}/transactions/${txnId}`);
  return res.data;
}


export async function updateTransaction(
  ownerId: string,
  txnId: string,
  body: { note?: string; invoice_number?: string; amount?: number; type?: "cr" | "dr" }
): Promise<CustomerTransaction> {
  const res = await customerApi.put<CustomerTransaction>(
    `/customer/${ownerId}/transactions/${txnId}`,
    body
  );
  return res.data;
}

export async function deleteTransaction(ownerId: string, txnId: string): Promise<{ message: string }> {
  const res = await customerApi.delete(`/customer/${ownerId}/transactions/${txnId}`);
  return res.data;
}

export async function fetchDeletedTransactions(ownerId: string): Promise<DeletedTransaction[]> {
  const res = await customerApi.get<DeletedTransaction[]>(`/customer/${ownerId}/transactions-deleted`);
  return res.data;
}

export async function fetchEditedTransactions(ownerId: string): Promise<DeletedTransaction[]> {
  const res = await customerApi.get<DeletedTransaction[]>(`/customer/${ownerId}/transactions-edited`);
  return res.data;
}

// ── Restore requests ─────────────────────────────────────────
export async function createRestoreRequests(
  ownerId: string,
  transactionIds: string[],
  restoreAll: boolean = false,
  note: string = ""
): Promise<{ message: string }> {
  const res = await customerApi.post<{ message: string }>(
    `/customer/${ownerId}/restore-requests`,
    {
      transaction_ids: transactionIds,
      note,
      restore_all: restoreAll,
    }
  );
  return res.data;
}

export async function fetchRestoreRequests(ownerId: string): Promise<RestoreRequest[]> {
  const res = await customerApi.get<RestoreRequest[]>(`/customer/${ownerId}/restore-requests`);
  return res.data;
}

// ── Settings ─────────────────────────────────────────────────
export async function fetchOwnerInfo(ownerId: string): Promise<OwnerInfo> {
  const res = await customerApi.get<OwnerInfo>(`/customer/${ownerId}/owner-info`);
  return res.data;
}

export async function fetchMyProfile(ownerId: string): Promise<CustomerProfile> {
  const res = await customerApi.get<CustomerProfile>(`/customer/${ownerId}/profile`);
  return res.data;
}

export async function updateMyProfile(
  ownerId: string,
  body: { name?: string; phone?: string; address?: string; notes?: string }
): Promise<CustomerProfile> {
  const res = await customerApi.put<CustomerProfile>(`/customer/${ownerId}/profile`, body);
  return res.data;
}

export async function changeMyPassword(
  ownerId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  const res = await customerApi.put(`/customer/${ownerId}/change-password`, {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return res.data;
}