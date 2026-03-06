import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";

type AuthContextType = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUserDirect: (user: Auth.User | null) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function buildUserFromApi(apiUser: any): Auth.User {
  return {
    id: apiUser.id,
    openId: apiUser.openId,
    name: apiUser.name ?? null,
    email: apiUser.email ?? null,
    phone: apiUser.phone ?? null,
    loginMethod: apiUser.loginMethod ?? null,
    role: apiUser.role ?? "user",
    status: apiUser.status ?? "active",
    subscriptionPlan: apiUser.subscriptionPlan ?? "free",
    subscriptionActive: apiUser.subscriptionActive ?? false,
    subscriptionEndDate: apiUser.subscriptionEndDate ?? null,
    companyId: apiUser.companyId ?? null,
    companyRole: apiUser.companyRole ?? null,
    lastSignedIn: new Date(apiUser.lastSignedIn || Date.now()),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();
        if (apiUser) {
          const userInfo = buildUserFromApi(apiUser);
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
        } else {
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native platform: use token-based auth
      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        setUser(null);
        return;
      }

      const cachedUser = await Auth.getUserInfo();
      if (cachedUser) {
        setUser(cachedUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[AuthProvider] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Directly set user state — shared across ALL consumers instantly */
  const setUserDirect = useCallback((newUser: Auth.User | null) => {
    setUser(newUser);
    setLoading(false);
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    // Clear state immediately for instant UI transition
    setUser(null);
    setError(null);
    // Then clean up storage in background
    try {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout cleanup failed:", err);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  // Auto-fetch on mount
  useEffect(() => {
    if (Platform.OS === "web") {
      fetchUser();
    } else {
      Auth.getUserInfo().then((cachedUser) => {
        if (cachedUser) {
          setUser(cachedUser);
          setLoading(false);
        } else {
          fetchUser();
        }
      });
    }
  }, [fetchUser]);

  const value = useMemo(
    () => ({ user, loading, error, isAuthenticated, refresh: fetchUser, logout, setUserDirect }),
    [user, loading, error, isAuthenticated, fetchUser, logout, setUserDirect]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
