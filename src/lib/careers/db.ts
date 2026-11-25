import { createServerClient } from "@/lib/supabase";
import type { CareerAdminEdit, CareerProfileOverride } from "./types";
import { ADMIN_USER_ID } from "@/lib/admin";
import { buildProfileVoteStats, verifiedLinkedInPairs, type ProfileVoteStats } from "./votes";

/** Community/admin-verified LinkedIn links, optionally for one profile. */
export async function loadVerifiedLinkedIn(
  playerUid?: string
): Promise<{ player_uid: string; linkedin_url: string }[]> {
  const sb = createServerClient();
  let q = sb
    .from("career_profile_votes")
    .select("player_uid, voter_user_id, vote, linkedin_url")
    .eq("aspect", "linkedin")
    .not("linkedin_url", "is", null);
  if (playerUid) q = q.eq("player_uid", playerUid);
  const { data, error } = await q;
  if (error) {
    console.warn("career_profile_votes (verified) load failed:", error.message);
    return [];
  }
  return verifiedLinkedInPairs(data || [], ADMIN_USER_ID);
}

export async function loadOverrides(): Promise<CareerProfileOverride[]> {
  const sb = createServerClient();
  const { data, error } = await sb.from("career_profile_overrides").select("*");
  if (error) {
    console.warn("career_profile_overrides load failed:", error.message);
    return [];
  }
  return (data || []) as CareerProfileOverride[];
}

export async function loadAdminEdits(): Promise<CareerAdminEdit[]> {
  const sb = createServerClient();
  const { data, error } = await sb.from("career_admin_edits").select("*");
  if (error) {
    console.warn("career_admin_edits load failed:", error.message);
    return [];
  }
  return (data || []) as CareerAdminEdit[];
}

export async function loadVoteStatsForProfile(
  playerUid: string,
  requestingUserId?: string,
  linkedInCandidates: string[] = []
): Promise<ProfileVoteStats> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("career_profile_votes")
    .select("aspect, vote, voter_user_id, linkedin_url")
    .eq("player_uid", playerUid);

  if (error) {
    console.warn("career_profile_votes load failed:", error.message);
    return buildProfileVoteStats([], requestingUserId, linkedInCandidates);
  }

  return buildProfileVoteStats(data || [], requestingUserId, linkedInCandidates);
}
