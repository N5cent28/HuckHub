import { supabase } from "./supabase";

/** True when auth API calls are expected to work. */
export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 20
  );
}

function shouldClearLocalSession(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("refresh token") ||
    m.includes("invalid jwt") ||
    m.includes("jwt expired") ||
    m.includes("session not found") ||
    m.includes("failed to fetch") ||
    m.includes("network")
  );
}

/** Drop broken persisted sessions so Supabase stops retrying refresh in the background. */
export async function clearLocalAuthSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Fallback: remove Supabase auth keys directly if signOut fails mid-corruption
    if (typeof window !== "undefined") {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sb-") && key.includes("auth-token")) {
          localStorage.removeItem(key);
        }
      }
    }
  }
}

/**
 * Load the current session, clearing local storage if refresh/storage is corrupted.
 * Prefer this over raw getSession() on the client.
 */
export async function getSafeSession() {
  if (!isSupabaseAuthConfigured()) {
    return { session: null, error: null as { message: string } | null };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && shouldClearLocalSession(error.message)) {
      await clearLocalAuthSession();
      return { session: null, error: null };
    }
    return { session: data.session, error };
  } catch (err) {
    await clearLocalAuthSession();
    const message = err instanceof Error ? err.message : "Auth session error";
    return { session: null, error: { message } };
  }
}

let recoveryStarted = false;

/** Run once per tab to recover from stale Supabase refresh loops. */
export function ensureAuthSessionRecovery(): void {
  if (typeof window === "undefined" || recoveryStarted || !isSupabaseAuthConfigured()) {
    return;
  }
  recoveryStarted = true;

  void getSafeSession();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" && !session) return;
    if (event === "TOKEN_REFRESHED" && !session) {
      void clearLocalAuthSession();
    }
  });
}
