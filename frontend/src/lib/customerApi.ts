/*
  ORIGINAL PATH: src/lib/customerApi.ts

  Axios instance dedicated to the CUSTOMER side of the app.
  Kept separate from lib/api.ts (the OWNER instance) because:
  - the token key is different (lp_customer_access_token vs owner's)
  - a 401 here should redirect to /customer-login, not /login
  - customer requests are scoped under /customer/{owner_id}/... so the
    base URL is the same API but the auth header source differs
*/
import axios from "axios";
import { getCustomerToken, clearCustomerSession } from "@/services/customerAuthService";

const customerApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Attach the customer's bearer token to every outgoing request.
customerApi.interceptors.request.use((config) => {
  const token = getCustomerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["ngrok-skip-browser-warning"] = "any";
  return config;
});

// If the token is invalid/expired, clear it and bounce to customer login.
// (Customer tokens don't have a refresh flow yet per Phase 4 — a
// straight re-login is the current behaviour.)
customerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== "undefined") {
      clearCustomerSession();
      window.location.href = "/customer/customer-login";
    }
    return Promise.reject(error);
  }
);

export default customerApi;