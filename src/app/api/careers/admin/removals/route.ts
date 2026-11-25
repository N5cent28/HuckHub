import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { isAdmin } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase";
import { getScrapedByUids, suppressProfile } from "@/lib/careers/directory";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !isAdmin(user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = createServerClient();
  const { data, error } = await sb
    .from("career_removal_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const scraped = await getScrapedByUids((data || []).map((r) => r.player_uid));
  return NextResponse.json({
    requests: (data || []).map((r) => ({
      ...r,
      profile_name: scraped.get(r.player_uid)?.full_name ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !isAdmin(user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, action } = await req.json();
  if (typeof id !== "string" || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "id and action (approve|reject) are required" }, { status: 400 });
  }

  const sb = createServerClient();
  const { data: request } = await sb
    .from("career_removal_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (action === "approve") {
    await suppressProfile(request.player_uid, "admin_approved_request", request.requester_user_id);
  }

  const { error } = await sb
    .from("career_removal_requests")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
