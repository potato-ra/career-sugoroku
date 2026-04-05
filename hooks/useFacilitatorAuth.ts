import { useEffect, useState } from "react";

const AUTH_STORAGE_KEY = "career-sugoroku-auth";

export interface FacilitatorAuthUser {
  loginId: string;
  displayName: string;
  role: "admin" | "facilitator";
  mustChangePassword: boolean;
  accessKeys?: {
    primary: string;
    backup: string;
  };
  fixedRooms?: {
    a: string;
    b: string;
  };
}

export interface FacilitatorAccountSummary {
  loginId: string;
  displayName: string;
  role: "admin" | "facilitator";
  accessKeys: {
    primary: string;
    backup: string;
  };
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

const getApiBase = () => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  if (import.meta.env.DEV) {
    return "http://localhost:3001";
  }

  return window.location.origin;
};

export const useFacilitatorAuth = () => {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authAccessKey, setAuthAccessKey] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<FacilitatorAuthUser | null>(null);
  const [accounts, setAccounts] = useState<FacilitatorAccountSummary[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const authorizedFetch = async <T,>(path: string, init: RequestInit = {}) => {
    const response = await fetch(`${getApiBase()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(init.headers ?? {}),
      },
    });

    const payload = (await response.json()) as T & { ok?: boolean; message?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? "認証に失敗しました。");
    }

    return payload;
  };

  const refreshMe = async (tokenOverride?: string | null) => {
    const token = tokenOverride ?? authToken;
    if (!token) {
      setAuthLoading(false);
      return;
    }

    try {
      const response = await fetch(`${getApiBase()}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("ログイン情報の確認に失敗しました。");
      }

      const payload = (await response.json()) as { user: FacilitatorAuthUser; accounts?: FacilitatorAccountSummary[] };
      setAuthUser(payload.user);
      setAccounts(payload.accounts ?? []);
      setAuthError("");
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthToken(null);
      setAuthAccessKey(null);
      setAuthUser(null);
      setAccounts([]);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedToken) {
      setAuthLoading(false);
      return;
    }

    setAuthToken(storedToken);
    void refreshMe(storedToken);
  }, []);

  const login = async (loginId: string, password: string) => {
    try {
      const payload = await authorizedFetch<{ token: string; user: FacilitatorAuthUser; accounts?: FacilitatorAccountSummary[] }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ loginId, password }),
        },
      );

      window.localStorage.setItem(AUTH_STORAGE_KEY, payload.token);
      setAuthToken(payload.token);
      setAuthAccessKey(null);
      setAuthUser(payload.user);
      setAccounts(payload.accounts ?? []);
      setAuthError("");
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "ログインに失敗しました。");
      return false;
    }
  };

  const loginWithAccessKey = async (accessKey: string, password: string) => {
    try {
      const payload = await authorizedFetch<{ token: string; user: FacilitatorAuthUser; accounts?: FacilitatorAccountSummary[] }>(
        "/api/auth/key-login",
        {
          method: "POST",
          body: JSON.stringify({ accessKey, password }),
        },
      );

      window.localStorage.setItem(AUTH_STORAGE_KEY, payload.token);
      setAuthToken(payload.token);
      setAuthAccessKey(accessKey);
      setAuthUser(payload.user);
      setAccounts(payload.accounts ?? []);
      setAuthError("");
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "ログインに失敗しました。");
      return false;
    }
  };

  const logout = async () => {
    try {
      await authorizedFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore logout API errors and clear local state anyway
    }

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken(null);
    setAuthAccessKey(null);
    setAuthUser(null);
    setAccounts([]);
  };

  const changePassword = async (currentPassword: string, nextPassword: string) => {
    await authorizedFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, nextPassword }),
    });
    await refreshMe();
  };

  const refreshAccounts = async () => {
    const payload = await authorizedFetch<{ accounts: FacilitatorAccountSummary[] }>("/api/facilitators");
    setAccounts(payload.accounts);
  };

  const createAccount = async (loginId: string, displayName: string, temporaryPassword: string) => {
    await authorizedFetch("/api/facilitators", {
      method: "POST",
      body: JSON.stringify({ loginId, displayName, temporaryPassword }),
    });
    await refreshAccounts();
  };

  const resetPassword = async (loginId: string, temporaryPassword: string) => {
    await authorizedFetch(`/api/facilitators/${encodeURIComponent(loginId)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ temporaryPassword }),
    });
    await refreshAccounts();
  };

  const regenerateAccessLink = async (loginId: string, slot: "primary" | "backup") => {
    await authorizedFetch(`/api/facilitators/${encodeURIComponent(loginId)}/regenerate-link`, {
      method: "POST",
      body: JSON.stringify({ slot }),
    });
    await refreshAccounts();
  };

  const setAccountActive = async (loginId: string, isActive: boolean) => {
    await authorizedFetch(`/api/facilitators/${encodeURIComponent(loginId)}/set-active`, {
      method: "POST",
      body: JSON.stringify({ isActive }),
    });
    await refreshAccounts();
  };

  const resolveFacilitatorByAccessKey = async (accessKey: string) => {
    const response = await fetch(`${getApiBase()}/api/facilitator-links/${encodeURIComponent(accessKey)}`);
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      facilitator: { loginId: string; displayName: string; rooms: { a: string; b: string } };
    };
    return payload.facilitator;
  };

  return {
    authToken,
    authAccessKey,
    authUser,
    accounts,
    authLoading,
    authError,
    login,
    loginWithAccessKey,
    logout,
    changePassword,
    createAccount,
    resetPassword,
    regenerateAccessLink,
    setAccountActive,
    resolveFacilitatorByAccessKey,
    refreshAccounts,
  };
};
