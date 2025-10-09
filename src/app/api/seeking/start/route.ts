import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { timeWindowHours = 2, preferredParks = [], skillPreference = {} } = body || {};

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const end = new Date(now.getTime() + timeWindowHours * 60 * 60 * 1000);

  const payload = {
    user_id: user.id,
    time_window_start: now.toISOString(),
    time_window_end: end.toISOString(),
    preferred_parks: preferredParks,
    skill_preference: skillPreference,
    expires_at: end.toISOString(),
  };

  const { error } = await sb.from("seeking_sessions").insert(payload);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, expires_at: payload.expires_at });
}


