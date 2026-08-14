/*
  ORIGINAL PATH: src/lib/currentBusiness.ts

  Because one customer login can be linked to MULTIPLE businesses
  (owners), every dashboard API call needs an owner_id. Rather than
  putting owner_id in the URL as a dynamic route segment (which is
  awkward with static export — no generateStaticParams for
  per-user data), we store "which business is the customer currently
  looking at" in localStorage, same hydration-safe pattern already
  used for ProtectedRoute and the Topbar.

  Flow:
  1. After customer login, call GET /customer/my-businesses.
  2. If they have exactly 1 business, auto-select it and save here.
  3. If they have more than 1, show a picker (business switcher) —
     not built in this pass, but this helper is what it would call.
  4. Every dashboard page reads getCurrentBusiness() on mount.
*/

const KEY = "lp_customer_current_owner_id";
const NAME_KEY = "lp_customer_current_business_name";

export interface CurrentBusiness {
  ownerId: string;
  businessName: string;
}

export function setCurrentBusiness(ownerId: string, businessName: string) {
  localStorage.setItem(KEY, ownerId);
  localStorage.setItem(NAME_KEY, businessName);
}

export function getCurrentBusiness(): CurrentBusiness | null {
  if (typeof window === "undefined") return null;
  const ownerId = localStorage.getItem(KEY);
  const businessName = localStorage.getItem(NAME_KEY);
  if (!ownerId) return null;
  return { ownerId, businessName: businessName || "" };
}

export function clearCurrentBusiness() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(NAME_KEY);
}