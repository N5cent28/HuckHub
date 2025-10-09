import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { targetId, reason } = await req.json();
  if (!targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 });
  
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Expect Authorization: Bearer <access_token>
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const { data: userData } = await sb.auth.getUser(token);
  const user = userData?.user || null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Can't block yourself
  if (user.id === targetId) {
    return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
  }

  // Check if already blocked
  const { data: existingBlock } = await sbAdmin
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetId)
    .single();

  if (existingBlock) {
    return NextResponse.json({ error: "User already blocked" }, { status: 400 });
  }

  // Create block
  const { error } = await sbAdmin.from("user_blocks").insert({
    blocker_id: user.id,
    blocked_id: targetId,
    reason: reason || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("targetId");
  
  if (!targetId) return NextResponse.json({ error: "targetId required" }, { status: 400 });
  
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Expect Authorization: Bearer <access_token>
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const { data: userData } = await sb.auth.getUser(token);
  const user = userData?.user || null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Remove block
  const { error } = await sbAdmin
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
