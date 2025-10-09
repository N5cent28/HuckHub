import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { targetId, reason, description } = await req.json();
  if (!targetId || !reason) return NextResponse.json({ error: "targetId and reason required" }, { status: 400 });
  
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Expect Authorization: Bearer <access_token>
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const { data: userData } = await sb.auth.getUser(token);
  const user = userData?.user || null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Can't report yourself
  if (user.id === targetId) {
    return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
  }

  // Check if already reported recently (prevent spam)
  const { data: recentReport } = await sbAdmin
    .from("user_reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("reported_id", targetId)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
    .single();

  if (recentReport) {
    return NextResponse.json({ error: "You have already reported this user recently" }, { status: 400 });
  }

  // Create report
  const { error } = await sbAdmin.from("user_reports").insert({
    reporter_id: user.id,
    reported_id: targetId,
    reason: reason,
    description: description || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
