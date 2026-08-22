/**
 * lib/auth.ts
 *
 * Centralizes everything about reading/writing the logged-in owner's
 * session data. Every page that needs to check "is someone logged in?"
 * or "what's their access token?" should import from here instead of
 * touching localStorage directly. That way, if we ever change *how*
 * we store the session (e.g. move to cookies), we only edit this file.
 */

export interface Owner {
  id: number;
  username: string;
  email: string;
  full_name: string;
  business_name: string;
  phone: string;
  city: string;
}

const ACCESS_TOKEN_KEY = "lp_access_token";
const REFRESH_TOKEN_KEY = "lp_refresh_token";
const OWNER_KEY = "lp_owner";

/**
 * Called once, right after a successful /auth/login response.
 * Saves everything the rest of the app needs to identify
 * and authenticate the user on every subsequent request.
 */
export function saveSession(accessToken: string, refreshToken: string, owner: Owner) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(OWNER_KEY, JSON.stringify(owner));
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null; // guards against server-side render
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getOwner(): Owner | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(OWNER_KEY);

  if (!raw || raw === "undefined" || raw === "null") {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Invalid owner in localStorage:", raw);
    localStorage.removeItem(OWNER_KEY);
    return null;
  }
}

/** Used by logout and by the 401 interceptor in api.ts */
export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(OWNER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}