import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { apiFetch } from "./api";
import { getSessionUser, primeSessionUser, clearSessionUser } from "./session";

export type { SessionUser } from "./session";
import type { SessionUser } from "./session";

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

  // Reads through the shared session cache (src/lib/session.ts) rather than
  // issuing its own request: on a cold launch this mount effect and the
  // router's loaders all want the same answer at the same moment, and they
  // used to fetch it separately. `force` re-checks against the server, which
  // is what an explicit refresh (e.g. after joining a group) is asking for.
  const loadSession = useCallback(async (force: boolean) => {
    if (force) clearSessionUser();
    const nextUser = await getSessionUser();
    setUser(nextUser);
    setStatus(nextUser ? "authenticated" : "unauthenticated");
  }, []);

  const refreshSession = useCallback(() => loadSession(true), [loadSession]);

  useEffect(() => {
    loadSession(false);
  }, [loadSession]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    primeSessionUser(data.user);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    const data = await apiFetch<{ user: SessionUser }>("/api/auth/signup", {
      method: "POST",
      body: { email, password, displayName },
    });
    primeSessionUser(data.user);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    primeSessionUser(null);
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
