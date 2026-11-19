import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { get, post, setTokens, clearTokens } from "./api";

export type User = { id: string; email: string; name: string; role: "CUSTOMER" | "VENDOR" | "ADMIN"; vendorProfile?: any };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; password: string; role?: "CUSTOMER" | "VENDOR"; storeName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const res = await get<{ user: User }>("/auth/me");
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    (async () => {
      if (localStorage.getItem("accessToken")) await refreshMe();
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await post<{ user: User; accessToken: string; refreshToken: string }>("/auth/login", { email, password });
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
  }

  async function register(payload: { name: string; email: string; password: string; role?: "CUSTOMER" | "VENDOR"; storeName?: string }) {
    const res = await post<{ user: User; accessToken: string; refreshToken: string }>("/auth/register", payload);
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
  }

  async function logout() {
    const rt = localStorage.getItem("refreshToken");
    try { if (rt) await post("/auth/logout", { refreshToken: rt }); } catch {}
    clearTokens();
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshMe }), [user, loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
