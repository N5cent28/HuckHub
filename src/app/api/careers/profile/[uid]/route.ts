import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { getProfileForDisplay } from "@/lib/careers/search";
import { loadVoteStatsForProfile } from "@/lib/careers/db";
import { normalizeLinkedInUrls } from "@/lib/careers/linkedin";
import { HIDDEN_NAME, normalizeDisplayName, redactName, redactedSummaryPrefix } from "@/lib/careers/names";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const user = await getAuthUser(req);
    const profile = await getProfileForDisplay(uid, Boolean(user), user?.id);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const authenticated = Boolean(user);
    // Signed-out visitors never receive the real name (the UI blur is cosmetic).
    const hide = (text: string | null) => (authenticated ? text : redactName(text, profile.full_name));
    const summary = hide(profile.career_summary);

    const linkedInUrls = authenticated ? normalizeLinkedInUrls(profile) : [];
    const voteStats = await loadVoteStatsForProfile(uid, user?.id, linkedInUrls);

    const payload = {
      player_uid: profile.player_uid,
      full_name: authenticated ? normalizeDisplayName(profile.full_name) : HIDDEN_NAME,
      name_blurred: !authenticated,
      career_field: hide(profile.career_field),
      current_role: hide(profile.current_role),
      education: hide(profile.education),
      career_summary: summary,
      career_summary_name_prefix: authenticated ? null : redactedSummaryPrefix(summary),
      known_locations: profile.known_locations,
      teams_played: profile.teams_played,
      teams_coached: profile.teams_coached,
      confidence_score: profile.confidence_score,
      linkedin_verified: profile.linkedin_verified,
      linkedin_url: authenticated ? profile.linkedin_url : null,
      linkedin_urls: linkedInUrls,
      llm_rationale: hide(profile.llm_rationale),
      avatar_url: authenticated ? profile.avatar_url : null,
      provenance: profile.provenance,
      is_user_edited: profile.is_user_edited,
      is_admin_edited: profile.is_admin_edited,
      open_to_career_chats: authenticated ? profile.open_to_career_chats : false,
      email: authenticated ? profile.email : null,
      can_claim: profile.can_claim,
      can_attempt_claim: profile.can_attempt_claim,
      claimed_by_other: profile.claimed_by_other,
      is_owner: profile.is_owner,
      vote_stats: voteStats,
      is_admin: isAdmin(user?.id),
    };

    return NextResponse.json({ profile: payload, authenticated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
