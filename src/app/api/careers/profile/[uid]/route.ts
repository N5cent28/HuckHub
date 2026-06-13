import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/careers/auth";
import { getProfileForDisplay } from "@/lib/careers/search";

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
    const payload = {
      player_uid: profile.player_uid,
      full_name: authenticated ? profile.full_name : null,
      name_blurred: !authenticated,
      career_field: profile.career_field,
      current_role: profile.current_role,
      education: profile.education,
      career_summary: profile.career_summary,
      known_locations: profile.known_locations,
      teams: profile.teams,
      confidence_score: profile.confidence_score,
      linkedin_verified: profile.linkedin_verified,
      linkedin_url: authenticated ? profile.linkedin_url : null,
      llm_rationale: profile.llm_rationale,
      provenance: profile.provenance,
      is_user_edited: profile.is_user_edited,
      open_to_career_chats: authenticated ? profile.open_to_career_chats : false,
      email: authenticated ? profile.email : null,
      can_claim: profile.can_claim,
    };

    return NextResponse.json({ profile: payload, authenticated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
