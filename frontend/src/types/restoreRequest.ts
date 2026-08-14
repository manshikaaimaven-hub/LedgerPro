// types/restoreRequest.ts
// Mirrors app/schemas/customer_dashboard_schemas.py (RestoreCustomerOut, RestoreRequestOut)

export interface RestoreCustomerOut {
  customer_id: string;
  customer_name: string;
  pending_count: number;
}

// Adjust the field list here if _txn_out() in customer_dashboard_router.py
// returns different/extra keys — this should match that shape exactly.
export interface TransactionSnapshot {
  id: string;
  customer_id: string;
  type: 'credit' | 'debit' | string;
  amount: number;
  note?: string | null;
  invoice_number?: string | null;
  entry_date: string;
  created_at?: string;
  updated_at?: string;
}

export interface RestoreRequestOut {
  id: string;
  transaction_id: string;
  transaction_snapshot: TransactionSnapshot | null;
  status: 'pending' | 'approved' | 'rejected';
  customer_note?: string | null;
  owner_response?: string | null;
  created_at: string;
  resolved_at?: string | null;
}