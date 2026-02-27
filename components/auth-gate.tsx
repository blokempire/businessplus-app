import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

/**
 * AuthGate watches auth state and redirects:
 * - Unauthenticated users away from protected routes → /login
 * - Authenticated users away from login → /(tabs)
 *
 * Must be rendered inside the root layout, after providers are mounted.
 */
export function AuthGate() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // Wait until auth state is resolved

    const inLoginScreen = segments[0] === "login";
    const inOAuthCallback = segments[0] === "oauth";

    // Don't redirect if we're in the OAuth callback flow
    if (inOAuthCallback) return;

    if (!isAuthenticated && !inLoginScreen) {
      // User is not authenticated and not on login screen → redirect to login
      router.replace("/login" as any);
    } else if (isAuthenticated && inLoginScreen) {
      // User is authenticated but on login screen → redirect to tabs
      router.replace("/(tabs)" as any);
    }
  }, [isAuthenticated, loading, segments]);

  return null;
}
