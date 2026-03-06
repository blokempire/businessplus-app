import { useAuthContext } from "@/lib/auth-context";

/**
 * useAuth hook — now backed by a shared AuthContext.
 * All components calling useAuth() share the same auth state.
 * When login calls setUserDirect(user), AuthGate sees it instantly.
 */
export function useAuth() {
  return useAuthContext();
}
