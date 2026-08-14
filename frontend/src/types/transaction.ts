export type TransactionType = "cr" | "dr";

export interface TransactionCreatePayload {
  customer_id: string;
  type: TransactionType;
  amount: number;
  note?: string;
  invoice_number?: string;
  // Sent as an ISO date string. If omitted, backend defaults to "now" —
  // but we always send it explicitly since the entry page has a date picker.
  entry_date: string;
}

export interface TransactionCreateResponse {
  message: string;
  id: string;
}

export interface Transaction {
  id: string;
  customer_id: string;
  type: 'cr' | 'dr';
  amount: number;
  note?: string | null;
  invoice_number?: string | null;
  entry_date: string;
  is_deleted: boolean;
  created_at: string;
  running_balance: number;
}

export interface DeletedTransaction {
  id: string;
  type: "cr" | "dr";
  amount: number;
  note: string | null;
  invoice_number: string | null;
  entry_date: string;
  deleted_at?: string | null;
  already_requested: boolean;
}