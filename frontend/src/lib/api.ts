import axios from "axios";
import { getAccessToken, getRefreshToken, saveSession, clearSession, getOwner } from "@/lib/auth";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["ngrok-skip-browser-warning"] = "any";
  return config;
});

/**
 * Tracks whether a refresh is already in flight. Without this, if 3
 * requests all fail with 401 at the same moment, we'd fire 3 separate
 * refresh calls instead of 1 — wasteful and can cause race conditions
 * where an old refresh token gets used after a newer one already
 * replaced it.
 */
let isRefreshing = false;
let refreshQueue: (() => void)[] = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh once per request, and only on 401s that
    // aren't themselves the refresh call failing.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearSession();
        window.location.href = "/login/";
        return Promise.reject(error);
      }

      originalRequest._retry = true; // mark so we never loop infinitely

      if (isRefreshing) {
        // Another request already triggered a refresh — wait for it
        // to finish, then retry this request with the new token.
        return new Promise((resolve) => {
          refreshQueue.push(() => resolve(api(originalRequest)));
        });
      }

      isRefreshing = true;
      try {
        // 1.3.5: POST /auth/refresh with the refresh token
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refresh_token: refreshToken }
        );
        const { access_token } = res.data;

        // Keep the same refresh token + owner info, just swap the access token
        const owner = getOwner();
        if (owner) saveSession(access_token, refreshToken, owner);

        // Let any queued requests know it's safe to retry now
        refreshQueue.forEach((cb) => cb());
        refreshQueue = [];

        return api(originalRequest); // retry the original failed request
      } catch (refreshErr) {
        clearSession();
        window.location.href = "/login/";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;