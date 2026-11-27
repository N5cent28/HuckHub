import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { createServerClient } from "@/lib/supabase";
import { getScrapedByUid, suppressProfile } from "@/lib/careers/directory";
import { namesMatch } from "@/lib/careers/names";
import { sendRemovalRequestEmail } from "@/lib/careers/email";
import { deleteAvatar } from "@/lib/careers/avatar";

export const dynamic = "force-dynamic";

/** Instant removals allowed per account; you are one person, so one is enough. */
const INSTANT_REMOVALS_PER_ACCOUNT = 1;
/** Pending removal requests one account may have open at once. */
const MAX_PENDING_REQUESTS = 3;

/**
 * Remove a profile from HuckHub Careers (sign-in required).
 *
 * Removed immediately (admin can undo from /careers/admin/removals) when the
 * requester owns the claimed profile, or their HuckHub name matches and nobody
 * has claimed it, and the account hasn't already used its instant removal.
 * Everything else becomes a request for admin review.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Please sign in to request a removal." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const playerUid = typeof body.player_uid === "string" ? body.player_uid.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!playerUid) {
    return NextResponse.json({ error: "player_uid is required" }, { status: 400 });
  }

  const sb = createServerClient();
  const isMemberOnly = playerUid.startsWith("user:");

  const { data: claim } = await sb
    .from("career_profile_overrides")
    .select("id, user_id")
    .eq(isMemberOnly ? "user_id" : "player_uid", playerUid.replace(/^user:/, ""))
    .maybeSingle();

  // A member deleting their own self-created profile: just their data, no limit.
  if (isMemberOnly) {
    if (claim?.user_id !== user.id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    await sb.from("career_profile_overrides").delete().eq("id", claim.id);
    await deleteAvatar(sb, user.id);
    return NextResponse.json({ removed: true, message: "Your profile has been removed from HuckHub Careers." });
  }

  const scraped = await getScrapedByUid(playerUid);
  if (!scraped && !claim) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { count: usedInstant } = await sb
    .from("career_profile_suppressions")
    .select("player_uid", { count: "exact", head: true })
    .eq("requested_by", user.id)
    .eq("reason", "owner_request");
  const canRemoveInstantly = (usedInstant ?? 0) < INSTANT_REMOVALS_PER_ACCOUNT;

  let isOwner = claim?.user_id === user.id;
  if (!isOwner && !claim && scraped) {
    const { data: throwProfile } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    isOwner = Boolean(throwProfile?.full_name && namesMatch(throwProfile.full_name, scraped.full_name));
  }

  if (isOwner && canRemoveInstantly) {
    await suppressProfile(playerUid, "owner_request", user.id);
    if (claim?.user_id === user.id) {
      await sb.from("career_profile_overrides").delete().eq("id", claim.id);
      await deleteAvatar(sb, user.id);
      await sb.from("career_claim_events").insert({
        user_id: user.id,
        player_uid: playerUid,
        action: "released",
        actor_user_id: user.id,
      });
    }
    return NextResponse.json({ removed: true, message: "This profile has been removed from HuckHub Careers." });
  }

  const { count: pending } = await sb
    .from("career_removal_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_user_id", user.id)
    .eq("status", "pending");
  if ((pending ?? 0) >= MAX_PENDING_REQUESTS) {
    return NextResponse.json(
      { error: "You already have several removal requests waiting for review. Please wait for those first." },
      { status: 429 }
    );
  }

  const { error } = await sb.from("career_removal_requests").insert({
    player_uid: playerUid,
    requester_user_id: user.id,
    contact_email: user.email ?? null,
    message: message || null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await sendRemovalRequestEmail({
      playerUid,
      profileName: scraped?.full_name ?? null,
      requesterEmail: user.email ?? "unknown",
      requesterUserId: user.id,
      message,
    });
  } catch (err) {
    console.error("Removal request email failed:", err);
  }

  return NextResponse.json({
    removed: false,
    message: "Removal request received. We'll review it and remove the profile, usually within a few days.",
  });
}
