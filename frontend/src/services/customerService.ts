import api from '@/lib/api';
import { Customer, CustomerCreatePayload } from '@/types/customer';

const PAGE_LIMIT = 20;

export async function fetchCustomers(page: number, search?: string): Promise<{ items: Customer[]; hasMore: boolean }> {
  const res = await api.get<Customer[]>('/customers', {
    params: { page, limit: PAGE_LIMIT, ...(search ? { search } : {}) },
  });
  return { items: res.data, hasMore: res.data.length === PAGE_LIMIT };
}

// Pulls every page — used only for CSV export, where we need the full list, not one page.
export async function fetchAllCustomers(): Promise<Customer[]> {
  const all: Customer[] = [];
  let page = 1;
  while (true) {
    const { items, hasMore } = await fetchCustomers(page);
    all.push(...items);
    if (!hasMore) break;
    page++;
  }
  return all;
}

export async function fetchCustomerById(id: string): Promise<Customer> {
  const res = await api.get<Customer>(`/customers/${id}`);
  return res.data;
}

export async function createCustomer(data:CustomerCreatePayload): Promise<{ id: string }> {
  const res = await api.post('/customers', data);
  return res.data;
}

export async function updateCustomer(id: string, data: Partial<CustomerCreatePayload>): Promise<void> {
  await api.put(`/customers/${id}`, data);
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete(`/customers/${id}`);
}