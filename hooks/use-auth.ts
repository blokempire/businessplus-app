import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

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

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Web platform: use cookie-based auth, fetch user from API
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

      // Use cached user info for native (token validates the session)
      const cachedUser = await Auth.getUserInfo();
      if (cachedUser) {
        setUser(cachedUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Directly set user state — skips the async refresh cycle for instant transitions */
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

  useEffect(() => {
    if (autoFetch) {
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
    } else {
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
    setUserDirect,
  };
}
