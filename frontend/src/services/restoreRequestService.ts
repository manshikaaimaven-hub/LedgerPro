// services/restoreRequestService.ts

import api from '@/lib/api';
import { RestoreCustomerOut, RestoreRequestOut } from '@/types/restoreRequest';

/**
 * GET /restore-requests/customers
 * Customers who have at least one pending restore request.
 */
export async function fetchRestoreRequestCustomers(): Promise<RestoreCustomerOut[]> {
  const res = await api.get('/restore-requests/customers');
  return res.data;
}

/**
 * GET /restore-requests/customers/{customer_id}
 * Defaults to pending only — pass status=null to fetch all statuses.
 */
export async function fetchCustomerRestoreRequests(
  customerId: string,
  status: string | null = 'pending'
): Promise<RestoreRequestOut[]> {
  const res = await api.get(`/restore-requests/customers/${customerId}`, {
    params: status ? { status } : {},
  });
  return res.data;
}

/**
 * PUT /restore-requests/approve
 */
export async function approveRestoreRequests(
  requestIds: string[],
  ownerResponse?: string
): Promise<RestoreRequestOut[]> {
  const res = await api.put('/restore-requests/approve', {
    request_ids: requestIds,
    owner_response: ownerResponse?.trim() || null,
  });
  return res.data;
}

/**
 * PUT /restore-requests/reject
 */
export async function rejectRestoreRequests(
  requestIds: string[],
  ownerResponse?: string
): Promise<RestoreRequestOut[]> {
  const res = await api.put('/restore-requests/reject', {
    request_ids: requestIds,
    owner_response: ownerResponse?.trim() || null,
  });
  return res.data;
}