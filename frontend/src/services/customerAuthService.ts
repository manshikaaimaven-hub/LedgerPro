/**
 * customerAuthService.ts
 *
 * All network calls for the CUSTOMER-side login system.
 * Every function returns just the data the caller needs and throws on
 * failure, so pages can catch and read err.response.data.detail for the
 * message the backend sent (matches the HTTPException(...) text your
 * router raises).
 */
import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Plain instance, no interceptors — customer calls attach their own
// token per-request via authHeader() below, not a global Bearer header.
const customerApi = axios.create({ 
  baseURL: BASE_URL,
  headers: {
    "ngrok-skip-browser-warning": "any"
  }
});

// Namespaced keys so this never collides with the owner's localStorage entries.
const TOKEN_KEY = "lp_customer_access_token";
const NAME_KEY = "lp_customer_full_name";

export function saveCustomerSession(accessToken: string, fullName: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(NAME_KEY, fullName);
}

export function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearCustomerSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
}

function authHeader() {
  const token = getCustomerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---- Types mirroring your Pydantic schemas field-for-field ----
export interface InvitePreview {
  customer_name: string;
  business_name: string;
  email: string;
  account_already_exists: boolean;
}

export interface CustomerTokenResponse {
  access_token: string;
  token_type: string;
  full_name: string;
}

export interface LinkedBusiness {
  owner_id: string;
  business_name: string;
  customer_name: string;
}

/** Always called first on the signup page: figure out which of the two flows applies. */
export async function previewInvite(token: string): Promise<InvitePreview> {
  const res = await customerApi.get<InvitePreview>("/auth/invite-preview", {
    params: { token },
  });
  return res.data;
}

/** First-time customer: sets username + password, creates account + link in one step. */
export async function customerSignup(
  inviteToken: string,
  username: string,
  password: string
): Promise<CustomerTokenResponse> {
  const res = await customerApi.post<CustomerTokenResponse>("/auth/customer-signup", {
    invite_token: inviteToken,
    username,
    password,
  });
  return res.data;
}

/** Works for both a plain visit to /customer/customer-login and the login-then-link flow. */
export async function customerLogin(
  username: string,
  password: string
): Promise<CustomerTokenResponse> {
  const res = await customerApi.post<CustomerTokenResponse>("/auth/customer-login", {
    username,
    password,
  });
  return res.data;
}

/** Called right after login when the person arrived via a second/third invite.
 *  Note: your router takes `token` as a query param, not a body field. */
export async function linkInvite(inviteToken: string): Promise<void> {
  await customerApi.post("/auth/customer-link-invite", null, {
    params: { token: inviteToken },
    headers: authHeader(),
  });
}

export async function getMyBusinesses(): Promise<LinkedBusiness[]> {
  const res = await customerApi.get<LinkedBusiness[]>("/customer/my-businesses", {
    headers: authHeader(),
  });
  return res.data;
}