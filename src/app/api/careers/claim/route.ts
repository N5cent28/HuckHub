import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { createServerClient } from "@/lib/supabase";
import { getScrapedByUid } from "@/lib/careers/directory";
import { isAgeGated } from "@/lib/careers/age";
import { scrapedToMerged } from "@/lib/careers/merge";
import { namesMatch } from "@/lib/careers/names";
import { embedCareerFields } from "@/lib/careers/embed";
import { buildEmbedSourceText } from "@/lib/careers/merge";
import { deleteAvatar, storeLinkedInAvatar } from "@/lib/careers/avatar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Lifetime claims per account (a second allows fixing an honest mistake). */
const MAX_CLAIMS_PER_ACCOUNT = 2;
/** Require "Sign in with LinkedIn" to claim. Set CAREERS_CLAIM_REQUIRE_LINKEDIN=false to pause. */
const REQUIRE_LINKEDIN = process.env.CAREERS_CLAIM_REQUIRE_LINKEDIN !== "false";

const LINKEDIN_PROFILE_RE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%.]+\/?$/i;

/** Name from a linked "Sign in with LinkedIn" (OIDC) identity, if any. */
function linkedInIdentityName(user: { identities?: { provider: string; identity_data?: Record<string, unknown> }[] }) {
  const identity = user.identities?.find((i) => i.provider === "linkedin_oidc");
  if (!identity) return null;
  const d = identity.identity_data || {};
  const name =
    (typeof d.name === "string" && d.name) ||
    [d.given_name, d.family_name].filter((x) => typeof x === "string" && x).join(" ");
  return name || null;
}

function normalizeLinkedInProfileUrl(raw: unknown): string | null | "invalid" {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.split(/[?#]/)[0];
  return LINKEDIN_PROFILE_RE.test(url) ? url.replace(/^http:/i, "https:") : "invalid";
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const player_uid = body.player_uid;
  if (!player_uid || typeof player_uid !== "string") {
    return NextResponse.json({ error: "player_uid is required" }, { status: 400 });
  }
  const providedLinkedIn = normalizeLinkedInProfileUrl(body.linkedin_url);
  if (providedLinkedIn === "invalid") {
    return NextResponse.json(
      { error: "That doesn't look like a LinkedIn profile link (linkedin.com/in/…)." },
      { status: 400 }
    );
  }

  const scrapedRow = await getScrapedByUid(player_uid);
  const scraped = scrapedRow && !isAgeGated(scrapedRow) ? scrapedToMerged(scrapedRow) : null;
  if (!scraped) {
    return NextResponse.json({ error: "Profile not found in index" }, { status: 404 });
  }

  const sb = createServerClient();

  const { data: throwProfile } = await sb
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const userName = throwProfile?.full_name?.trim();
  if (!userName) {
    return NextResponse.json(
      { error: "Set your name on your HuckHub throwing profile before claiming" },
      { status: 400 }
    );
  }

  if (!namesMatch(userName, scraped.full_name)) {
    return NextResponse.json(
      { error: "Your HuckHub profile name must match this career profile to claim it" },
      { status: 403 }
    );
  }

  const linkedInName = linkedInIdentityName(user);
  if (REQUIRE_LINKEDIN) {
    if (!linkedInName) {
      return NextResponse.json(
        { error: "Verify with LinkedIn to claim this profile.", code: "linkedin_required" },
        { status: 403 }
      );
    }
    if (!namesMatch(linkedInName, scraped.full_name)) {
      return NextResponse.json(
        {
          error: `The name on your LinkedIn account (${linkedInName}) doesn't match this profile.`,
          code: "linkedin_name_mismatch",
        },
        { status: 403 }
      );
    }
  }

  const { data: existingClaim } = await sb
    .from("career_profile_overrides")
    .select("id")
    .eq("player_uid", player_uid)
    .maybeSingle();

  if (existingClaim) {
    return NextResponse.json(
      {
        error: "This profile has already been claimed by another member",
        code: "already_claimed",
        can_dispute: true,
      },
      { status: 409 }
    );
  }

  const { data: existingUser } = await sb
    .from("career_profile_overrides")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // No hopping: an account holds at most one claimed profile.
  if (existingUser?.player_uid) {
    return NextResponse.json(
      {
        error:
          "You've already claimed a career profile. If it isn't you, open it and choose \"This isn't me — release claim\" first.",
        code: "already_has_claim",
      },
      { status: 409 }
    );
  }

  const { count: priorClaims } = await sb
    .from("career_claim_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("action", "claimed");
  if ((priorClaims ?? 0) >= MAX_CLAIMS_PER_ACCOUNT) {
    return NextResponse.json(
      {
        error: "This account has reached its claim limit. Contact HuckHub if you need help with your profile.",
        code: "claim_limit",
      },
      { status: 429 }
    );
  }

  // Start from the scraped profile; a member-only profile's own text wins if present.
  const fields = {
    career_field: existingUser?.career_field ?? scraped.career_field,
    current_role: existingUser?.current_role ?? scraped.current_role,
    education: existingUser?.education ?? scraped.education,
    career_summary: existingUser?.career_summary ?? scraped.career_summary,
  };
  const embedText = buildEmbedSourceText(fields);
  let embedding: number[] | null = null;
  try {
    embedding = Array.from(await embedCareerFields(fields));
  } catch (err) {
    console.error("Claim embed failed:", err);
  }

  // LinkedIn photo unless the member opted out ("do not use my LinkedIn photo").
  const avatarUrl =
    body.use_linkedin_photo === false ? null : await storeLinkedInAvatar(sb, user);

  const row = {
    user_id: user.id,
    player_uid,
    full_name: userName,
    avatar_url: avatarUrl,
    career_field: fields.career_field,
    current_role: fields.current_role,
    education: fields.education,
    career_summary: fields.career_summary,
    linkedin_url: providedLinkedIn ?? existingUser?.linkedin_url ?? scraped.linkedin_url,
    known_locations: existingUser?.known_locations?.length
      ? existingUser.known_locations
      : scraped.known_locations,
    email: existingUser?.email ?? null,
    open_to_career_chats: existingUser?.open_to_career_chats ?? false,
    embed_source_text: embedText,
    embedding,
    claimed_at: new Date().toISOString(),
  };

  const { data, error } = existingUser
    ? await sb.from("career_profile_overrides").update(row).eq("user_id", user.id).select().single()
    : await sb.from("career_profile_overrides").insert(row).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sb.from("career_claim_events").insert({
    user_id: user.id,
    player_uid,
    action: "claimed",
    actor_user_id: user.id,
    linkedin_name: linkedInName,
  });

  return NextResponse.json({ profile: data, message: "Profile claimed. You can now edit your career details." });
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const suggest = searchParams.get("suggest") === "true";

  if (!suggest) {
    return NextResponse.json({ error: "Use ?suggest=true" }, { status: 400 });
  }

  const sb = createServerClient();
  const { data: throwProfile } = await sb
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!throwProfile?.full_name) {
    return NextResponse.json({ candidates: [] });
  }

  const { findClaimCandidates } = await import("@/lib/careers/search");
  const candidates = await findClaimCandidates(throwProfile.full_name, 8);

  return NextResponse.json({
    candidates: candidates.map((c) => ({
      player_uid: c.player_uid,
      full_name: c.full_name,
      career_field: c.career_field,
      current_role: c.current_role,
      known_locations: c.known_locations,
      confidence_score: c.confidence_score,
    })),
  });
}

/** Release your claim (e.g. you claimed the wrong same-name person). The profile stays listed. */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();
  const { data: claim } = await sb
    .from("career_profile_overrides")
    .select("id, player_uid")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!claim?.player_uid) {
    return NextResponse.json({ error: "You haven't claimed a profile." }, { status: 404 });
  }

  const { error } = await sb.from("career_profile_overrides").delete().eq("id", claim.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await deleteAvatar(sb, user.id);

  await sb.from("career_claim_events").insert({
    user_id: user.id,
    player_uid: claim.player_uid,
    action: "released",
    actor_user_id: user.id,
  });
  return NextResponse.json({ message: "Claim released. The profile is back to its original listing." });
}
