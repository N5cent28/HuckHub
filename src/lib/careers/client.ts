"use client";

import { useEffect, useState } from "react";
import {
  clearLocalAuthSession,
  getSafeSession,
  isSupabaseAuthConfigured,
} from "@/lib/auth-session";
import { isAdmin } from "@/lib/admin";
import { supabase } from "@/lib/supabase";

export function useCareersAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = async () => {
      if (!isSupabaseAuthConfigured()) {
        setToken(null);
        setUserId(null);
        setLoading(false);
        return;
      }

      const { session } = await getSafeSession();
      setToken(session?.access_token ?? null);
      setUserId(session?.user?.id ?? null);
      setLoading(false);
    };
    sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { token, userId, authenticated: Boolean(token), isAdmin: isAdmin(userId), loading };
}

export async function careersFetch(
  path: string,
  options: RequestInit & { token?: string | null } = {}
) {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    throw new Error("Unexpected server response");
  }

  if (res.status === 401 && isSupabaseAuthConfigured()) {
    await clearLocalAuthSession();
  }

  if (!res.ok) {
    const err = new Error((data.error as string) || "Request failed") as Error & {
      code?: string;
      can_dispute?: boolean;
    };
    err.code = data.code as string | undefined;
    err.can_dispute = data.can_dispute as boolean | undefined;
    throw err;
  }
  return data;
}
