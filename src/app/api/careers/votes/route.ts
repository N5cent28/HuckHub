import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { createServerClient } from "@/lib/supabase";
import { loadVoteStatsForProfile } from "@/lib/careers/db";
import { normalizeLinkedInUrls } from "@/lib/careers/linkedin";
import { resolveMergedProfile } from "@/lib/careers/search";
import type { VoteAspect, VoteValue } from "@/lib/careers/votes";

export const dynamic = "force-dynamic";

const VALID_ASPECTS: VoteAspect[] = ["overall", "linkedin"];
const VALID_VOTES: VoteValue[] = ["accurate", "inaccurate"];

async function linkedInCandidatesFor(playerUid: string): Promise<string[]> {
  const profile = await resolveMergedProfile(playerUid);
  if (!profile) return [];
  return normalizeLinkedInUrls(profile);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerUid = searchParams.get("player_uid");
  if (!playerUid) {
    return NextResponse.json({ error: "player_uid is required" }, { status: 400 });
  }

  const user = await getAuthUser(req);
  const candidates = await linkedInCandidatesFor(playerUid);
  const stats = await loadVoteStatsForProfile(playerUid, user?.id, candidates);

  return NextResponse.json({ stats, authenticated: Boolean(user) });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { player_uid, aspect, vote, linkedin_url: linkedinUrl } = body;

  if (!player_uid || typeof player_uid !== "string") {
    return NextResponse.json({ error: "player_uid is required" }, { status: 400 });
  }
  if (!VALID_ASPECTS.includes(aspect)) {
    return NextResponse.json({ error: "Invalid aspect" }, { status: 400 });
  }
  if (!VALID_VOTES.includes(vote)) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }

  const candidates = await linkedInCandidatesFor(player_uid);
  let linkedin_url: string | null = null;

  if (aspect === "linkedin") {
    const url = typeof linkedinUrl === "string" ? linkedinUrl.trim() : "";
    if (!url || !candidates.includes(url)) {
      return NextResponse.json({ error: "Valid linkedin_url is required for LinkedIn votes" }, { status: 400 });
    }
    linkedin_url = url;
  }

  const sb = createServerClient();
  let existingQuery = sb
    .from("career_profile_votes")
    .select("id")
    .eq("player_uid", player_uid)
    .eq("voter_user_id", user.id)
    .eq("aspect", aspect);

  existingQuery =
    linkedin_url != null
      ? existingQuery.eq("linkedin_url", linkedin_url)
      : existingQuery.is("linkedin_url", null);

  const { data: existing } = await existingQuery.maybeSingle();

  const row = {
    player_uid,
    voter_user_id: user.id,
    aspect,
    vote,
    linkedin_url,
  };

  const { error } = existing
    ? await sb.from("career_profile_votes").update(row).eq("id", existing.id)
    : await sb.from("career_profile_votes").insert(row);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = await loadVoteStatsForProfile(player_uid, user.id, candidates);
  return NextResponse.json({ stats, message: "Thanks — your feedback helps improve HuckHub Careers." });
}
