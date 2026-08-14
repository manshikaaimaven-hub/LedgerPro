/*
transactionService.ts is a service layer responsible for creating new transactions. 
It receives the transaction details from the New Entry page, 
sends them to the backend using a POST request to the /transactions endpoint, 
waits for the backend to save the transaction, and then returns the success response. 
This keeps the UI code simple while centralizing all transaction-related API communication in one reusable file.
*/
import api from "@/lib/api";
import type {
  TransactionCreatePayload,
  TransactionCreateResponse,
} from "@/types/transaction";
import { Transaction } from '@/types/transaction';

export async function createTransaction(
  payload: TransactionCreatePayload
): Promise<TransactionCreateResponse> {
  const { data } = await api.post<TransactionCreateResponse>(
    "/transactions",
    payload
  );
  return data;
}

const PAGE_LIMIT = 20;

export async function fetchCustomerTransactions(
  customerId: string,
  page: number
): Promise<{ items: Transaction[]; hasMore: boolean }> {
  const res = await api.get<Transaction[]>(`/transactions/customer/${customerId}`, {
    params: { page, limit: PAGE_LIMIT },
  });
  return { items: res.data, hasMore: res.data.length === PAGE_LIMIT };
}