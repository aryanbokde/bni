"use client";

import { useMemo, useRef } from "react";
import axios from "axios";
import {
  useAccessToken,
  useSetAccessToken,
  useRefreshAccessToken,
} from "@/lib/TokenProvider";
import { clearClientSession } from "@/lib/session";

export function useApi() {
  const accessToken = useAccessToken();
  const setAccessToken = useSetAccessToken();
  const refreshAccessToken = useRefreshAccessToken();

  // Keep a ref so interceptors always read the latest token
  // Update synchronously during render (not in useEffect) to avoid race conditions
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: "/api" });

    instance.interceptors.request.use((config) => {
      const token = tokenRef.current;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const newToken = await refreshAccessToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return instance(originalRequest);
          }

          // Refresh also failed — clear and redirect
          setAccessToken(null);
          clearClientSession();
          window.location.href = "/login";
        }

        return Promise.reject(error);
      }
    );

    return instance;
    // Stable — interceptors read tokenRef.current, not accessToken directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshAccessToken, setAccessToken]);

  return api;
}
