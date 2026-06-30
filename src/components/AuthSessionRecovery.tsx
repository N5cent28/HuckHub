"use client";

import { useEffect } from "react";
import { ensureAuthSessionRecovery } from "@/lib/auth-session";

/** Clears corrupted Supabase sessions before pages call getSession/getUser. */
export function AuthSessionRecovery() {
  useEffect(() => {
    ensureAuthSessionRecovery();
  }, []);
  return null;
}
