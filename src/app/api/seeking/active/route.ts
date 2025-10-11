import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Get current user to filter out blocked users
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  let currentUserId: string | null = null;
  
  if (token) {
    const { data: userData } = await sb.auth.getUser(token);
    currentUserId = userData?.user?.id || null;
  }

  const nowIso = new Date().toISOString();
  const { data: sessions, error } = await sb
    .from("seeking_sessions")
    .select("id,user_id,time_window_end,preferred_parks,created_at,expires_at")
    .gt("expires_at", nowIso);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let userIds = Array.from(new Set((sessions || []).map((s) => s.user_id)));
  if (userIds.length === 0) return NextResponse.json({ sessions: [] });

  // Filter out blocked users if we have a current user
  if (currentUserId) {
    const { data: blockedUsers } = await sbAdmin
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", currentUserId);
    
    const blockedIds = new Set(blockedUsers?.map(b => b.blocked_id) || []);
    userIds = userIds.filter(id => !blockedIds.has(id));
  }

  if (userIds.length === 0) return NextResponse.json({ sessions: [] });

  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("id,full_name,pronouns,skill_level,league_level,general_availability,radius_miles,preferred_parks")
    .in("id", userIds);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
  const profileMap = new Map(profiles!.map((p: any) => [p.id, p]));

  const merged = (sessions || [])
    .filter(s => userIds.includes(s.user_id))
    .map((s: any) => ({
      ...s,
      profiles: profileMap.get(s.user_id) || null,
    }));
  return NextResponse.json({ sessions: merged });
}


