// Matches ChildCustomer fields returned by CustomerResponse.
// owner_id is deliberately omitted — the frontend never needs it,
// since every request is already scoped to the logged-in owner via the JWT.
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  gst_number?: string | null;
  notes?: string | null;
  created_at: string;
  balance: number;
}

export interface CustomerCreatePayload {
  name: string;
  email: string;
  phone: string;
  address?: string;
  gst_number?: string;
  notes?: string;
}