"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useCareersAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setToken(session?.access_token ?? null);
      setUserId(session?.user?.id ?? null);
      setLoading(false);
    };
    sync();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { token, userId, authenticated: Boolean(token), loading };
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

  const res = await fetch(path, { ...init, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
