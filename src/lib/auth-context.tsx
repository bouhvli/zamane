import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { apiFetch } from "./api";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  groupId: string | null;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: SessionUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<SessionUser>;
  signup: (email: string, password: string, displayName?: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: SessionUser | null }>("/api/auth/session");
      setUser(data.user);
      setStatus(data.user ? "authenticated" : "unauthenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    const data = await apiFetch<{ user: SessionUser }>("/api/auth/signup", {
      method: "POST",
      body: { email, password, displayName },
    });
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ user, status, login, signup, logout, refreshSession }),
    [user, status, login, signup, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
