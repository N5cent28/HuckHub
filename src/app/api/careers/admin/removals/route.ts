import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { isAdmin } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase";
import { getScrapedByUids, restoreProfile, suppressProfile } from "@/lib/careers/directory";

export const dynamic = "force-dynamic";

const RECENT_DAYS = 60;

/**
 * Admin moderation: pending removal requests, recent removals (undoable),
 * recent claims (revocable), and "undo everything this account did".
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !isAdmin(user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = createServerClient();
  const since = new Date(Date.now() - RECENT_DAYS * 86400_000).toISOString();

  const [requestsRes, removalsRes, snapshotsRes, claimsRes] = await Promise.all([
    sb.from("career_removal_requests").select("*").eq("status", "pending").order("created_at"),
    sb
      .from("career_profile_suppressions")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    sb.from("career_profile_snapshots").select("player_uid, profile"),
    sb
      .from("career_claim_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  for (const r of [requestsRes, removalsRes, snapshotsRes, claimsRes]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  const snapshotNames = new Map(
    (snapshotsRes.data || []).map((s) => [s.player_uid, (s.profile as { full_name?: string }).full_name ?? null])
  );
  const scraped = await getScrapedByUids([
    ...(requestsRes.data || []).map((r) => r.player_uid),
    ...(claimsRes.data || []).map((c) => c.player_uid),
  ]);
  const nameFor = (uid: string) => scraped.get(uid)?.full_name ?? snapshotNames.get(uid) ?? null;

  // Emails for the accounts involved (service role can read auth users).
  const userIds = [
    ...new Set(
      [
        ...(requestsRes.data || []).map((r) => r.requester_user_id),
        ...(removalsRes.data || []).map((r) => r.requested_by),
        ...(claimsRes.data || []).map((c) => c.user_id),
      ].filter(Boolean) as string[]
    ),
  ];
  const emails = new Map<string, string | null>();
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await sb.auth.admin.getUserById(id);
      emails.set(id, data.user?.email ?? null);
    })
  );

  const { data: activeClaims } = await sb
    .from("career_profile_overrides")
    .select("user_id, player_uid")
    .not("player_uid", "is", null);
  const active = new Set((activeClaims || []).map((c) => `${c.user_id}|${c.player_uid}`));

  return NextResponse.json({
    requests: (requestsRes.data || []).map((r) => ({ ...r, profile_name: nameFor(r.player_uid) })),
    removals: (removalsRes.data || []).map((r) => ({
      ...r,
      profile_name: snapshotNames.get(r.player_uid) ?? null,
      requester_email: r.requested_by ? emails.get(r.requested_by) ?? null : null,
    })),
    claims: (claimsRes.data || []).map((c) => ({
      ...c,
      profile_name: nameFor(c.player_uid),
      user_email: emails.get(c.user_id) ?? null,
      active: c.action === "claimed" && active.has(`${c.user_id}|${c.player_uid}`),
    })),
  });
}

async function revokeClaim(sb: ReturnType<typeof createServerClient>, userId: string, adminId: string) {
  const { data: claim } = await sb
    .from("career_profile_overrides")
    .select("id, player_uid")
    .eq("user_id", userId)
    .maybeSingle();
  if (!claim?.player_uid) return false;
  await sb.from("career_profile_overrides").delete().eq("id", claim.id);
  await sb.from("career_claim_events").insert({
    user_id: userId,
    player_uid: claim.player_uid,
    action: "revoked",
    actor_user_id: adminId,
  });
  return true;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || !isAdmin(user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const action = body.action as string;
  const sb = createServerClient();

  if (action === "approve" || action === "reject") {
    if (typeof body.id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { data: request } = await sb
      .from("career_removal_requests")
      .select("*")
      .eq("id", body.id)
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
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    if (typeof body.player_uid !== "string") {
      return NextResponse.json({ error: "player_uid is required" }, { status: 400 });
    }
    const now = await restoreProfile(body.player_uid);
    return NextResponse.json({
      ok: true,
      message: now ? "Profile restored." : "Unblocked; it will reappear at the next publish.",
    });
  }

  if (action === "revoke_claim") {
    if (typeof body.user_id !== "string") return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    const revoked = await revokeClaim(sb, body.user_id, user.id);
    return NextResponse.json({ ok: true, message: revoked ? "Claim revoked." : "No active claim." });
  }

  if (action === "undo_account") {
    if (typeof body.user_id !== "string") return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    const target = body.user_id as string;

    const { data: removals } = await sb
      .from("career_profile_suppressions")
      .select("player_uid")
      .eq("requested_by", target)
      .eq("reason", "owner_request");
    let restored = 0;
    for (const r of removals || []) {
      await restoreProfile(r.player_uid);
      restored += 1;
    }
    const revoked = await revokeClaim(sb, target, user.id);
    const { count: votes } = await sb
      .from("career_profile_votes")
      .delete({ count: "exact" })
      .eq("voter_user_id", target);
    await sb
      .from("career_removal_requests")
      .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("requester_user_id", target)
      .eq("status", "pending");

    return NextResponse.json({
      ok: true,
      message: `Restored ${restored} removal(s), ${revoked ? "revoked their claim" : "no claim to revoke"}, deleted ${votes ?? 0} vote(s), rejected their pending requests.`,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
