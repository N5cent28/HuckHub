import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { createServerClient } from "@/lib/supabase";
import { getMergedByUid } from "@/lib/careers/loader";
import { namesMatch } from "@/lib/careers/names";
import { embedCareerFields } from "@/lib/careers/embed";
import { buildEmbedSourceText } from "@/lib/careers/merge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { player_uid } = await req.json();
  if (!player_uid || typeof player_uid !== "string") {
    return NextResponse.json({ error: "player_uid is required" }, { status: 400 });
  }

  const scraped = getMergedByUid(player_uid);
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

  const row = {
    user_id: user.id,
    player_uid,
    full_name: userName,
    career_field: fields.career_field,
    current_role: fields.current_role,
    education: fields.education,
    career_summary: fields.career_summary,
    linkedin_url: existingUser?.linkedin_url ?? scraped.linkedin_url,
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
