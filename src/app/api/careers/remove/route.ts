import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { createServerClient } from "@/lib/supabase";
import { getScrapedByUid, suppressProfile } from "@/lib/careers/directory";
import { namesMatch } from "@/lib/careers/names";
import { sendRemovalRequestEmail } from "@/lib/careers/email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Remove a profile from HuckHub Careers.
 *
 * Removed immediately (and kept out of future publishes) when the requester:
 *   - owns the claimed profile, or
 *   - is signed in, their HuckHub profile name matches, and nobody else has
 *     claimed it (the same check used for claiming).
 * Everyone else, including people without an account, gets a removal request
 * that an admin reviews. Hiding a profile is the privacy-safe default, so the
 * bar is deliberately no higher than claiming.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const playerUid = typeof body.player_uid === "string" ? body.player_uid.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const contactEmail = typeof body.contact_email === "string" ? body.contact_email.trim().slice(0, 320) : "";

  if (!playerUid) {
    return NextResponse.json({ error: "player_uid is required" }, { status: 400 });
  }

  const user = await getAuthUser(req);
  const sb = createServerClient();

  const { data: claim } = await sb
    .from("career_profile_overrides")
    .select("id, user_id")
    .eq(playerUid.startsWith("user:") ? "user_id" : "player_uid", playerUid.replace(/^user:/, ""))
    .maybeSingle();

  if (user && claim?.user_id === user.id) {
    if (!playerUid.startsWith("user:")) {
      await suppressProfile(playerUid, "owner_request", user.id);
    }
    await sb.from("career_profile_overrides").delete().eq("id", claim.id);
    return NextResponse.json({ removed: true, message: "Your profile has been removed from HuckHub Careers." });
  }

  const scraped = playerUid.startsWith("user:") ? null : await getScrapedByUid(playerUid);
  if (!scraped && !claim) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (user && scraped && !claim) {
    const { data: throwProfile } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (throwProfile?.full_name && namesMatch(throwProfile.full_name, scraped.full_name)) {
      await suppressProfile(playerUid, "owner_request", user.id);
      return NextResponse.json({ removed: true, message: "This profile has been removed from HuckHub Careers." });
    }
  }

  if (!user && !EMAIL_RE.test(contactEmail)) {
    return NextResponse.json(
      { error: "Please give an email address so we can confirm the removal with you." },
      { status: 400 }
    );
  }

  const { error } = await sb.from("career_removal_requests").insert({
    player_uid: playerUid,
    requester_user_id: user?.id ?? null,
    contact_email: contactEmail || user?.email || null,
    message: message || null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await sendRemovalRequestEmail({
      playerUid,
      profileName: scraped?.full_name ?? null,
      requesterEmail: contactEmail || user?.email || "unknown",
      requesterUserId: user?.id ?? null,
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
