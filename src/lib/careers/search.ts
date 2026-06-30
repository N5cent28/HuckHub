import type { CareerSearchResult, MergedCareerProfile } from "./types";
import { confidenceLabel, normalizeDisplayName, summaryNamePrefix } from "./names";
import { isEligibleForCareersSearch } from "./age";
import { locationMatchesProfile } from "./locations";
import { profileMatchesDivision } from "./teams";
import { embedText } from "./embed";
import { getAllScrapedMerged } from "./loader";
import { mergeProfiles, overrideToMerged, adminEditToMerged } from "./merge";
import { loadOverrides, loadAdminEdits } from "./db";

export interface SearchParams {
  query?: string;
  location?: string;
  min_confidence?: number;
  linkedin_verified?: boolean;
  division?: string;
  top_k?: number;
  offset?: number;
  limit?: number;
  authenticated?: boolean;
}

async function loadAllOverrides() {
  const [overrides, adminEdits] = await Promise.all([loadOverrides(), loadAdminEdits()]);
  return { overrides, adminEdits };
}

function keywordScore(profile: MergedCareerProfile, query: string): { score: number; reasons: string[] } {
  const q = query.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const nameNorm = normalizeDisplayName(profile.full_name).toLowerCase();
  if (nameNorm.includes(q) || q.split(/\s+/).every((t) => nameNorm.includes(t))) {
    score += 1.2;
    reasons.push("name");
  }

  for (const loc of profile.known_locations) {
    if (loc.toLowerCase().includes(q)) {
      score += 0.9;
      reasons.push("location");
      break;
    }
  }

  const textFields = [
    profile.career_field,
    profile.current_role,
    profile.education,
    profile.career_summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (textFields.includes(q)) {
    score += 0.7;
    reasons.push("keyword");
  } else if (q.split(/\s+/).some((t) => t.length > 2 && textFields.includes(t))) {
    score += 0.4;
    reasons.push("keyword");
  }

  return { score, reasons };
}

function passesFilters(
  profile: MergedCareerProfile,
  params: SearchParams
): boolean {
  if (params.location && !locationMatchesProfile(profile, params.location)) {
    return false;
  }

  if (params.linkedin_verified && !profile.linkedin_verified && !profile.is_user_edited && !profile.is_admin_edited) {
    return false;
  }

  if (params.division && !profileMatchesDivision(profile, params.division)) {
    return false;
  }

  if (params.min_confidence != null && !profile.is_user_edited && !profile.is_admin_edited) {
    const conf = profile.confidence_score ?? 0;
    if (conf < params.min_confidence) return false;
  }

  if (!isEligibleForCareersSearch(profile)) {
    return false;
  }

  return true;
}

function toSearchResult(
  profile: MergedCareerProfile,
  score: number,
  matchReasons: string[],
  authenticated: boolean
): CareerSearchResult {
  const summaryPrefix =
    !authenticated && profile.career_summary
      ? summaryNamePrefix(profile.full_name, profile.career_summary)
      : null;

  return {
    player_uid: profile.player_uid,
    full_name: normalizeDisplayName(profile.full_name),
    name_blurred: !authenticated,
    career_field: profile.career_field,
    current_role: profile.current_role,
    education: profile.education,
    career_summary: profile.career_summary,
    career_summary_name_prefix: summaryPrefix,
    known_locations: profile.known_locations,
    confidence_score: profile.confidence_score,
    confidence_label: confidenceLabel(
      profile.confidence_score,
      profile.is_user_edited,
      profile.is_admin_edited
    ),
    linkedin_verified: profile.linkedin_verified,
    provenance: profile.provenance,
    is_user_edited: profile.is_user_edited,
    is_admin_edited: profile.is_admin_edited,
    open_to_career_chats: authenticated ? profile.open_to_career_chats : false,
    score,
    match_reasons: matchReasons,
  };
}

export async function searchCareers(params: SearchParams): Promise<{
  results: CareerSearchResult[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}> {
  const { overrides, adminEdits } = await loadAllOverrides();
  const scraped = getAllScrapedMerged();
  const profiles = mergeProfiles(scraped, overrides, adminEdits);
  const filtered = profiles.filter((p) => passesFilters(p, params));

  const query = params.query?.trim() || "";
  const offset = Math.max(0, params.offset ?? 0);
  const limit = params.limit ?? params.top_k ?? 30;
  const authenticated = params.authenticated ?? false;

  if (!query) {
    const sorted = filtered.sort((a, b) => {
        const rank = (p: MergedCareerProfile) =>
          p.is_user_edited ? 2 : p.is_admin_edited ? 1 : 0;
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return rb - ra;
        return (b.confidence_score ?? 0) - (a.confidence_score ?? 0);
      });

    const page = sorted.slice(offset, offset + limit);
    return {
      results: page.map((p) => toSearchResult(p, p.confidence_score ?? 0, ["browse"], authenticated)),
      total: sorted.length,
      offset,
      limit,
      has_more: offset + page.length < sorted.length,
    };
  }

  let queryVec: Float32Array | null = null;
  try {
    queryVec = await embedText(query);
  } catch (err) {
    console.error("Query embed failed:", err);
  }

  const scored = filtered.map((profile) => {
    const { score: kwScore, reasons } = keywordScore(profile, query);
    let semantic = 0;
    if (queryVec && profile.embedding) {
      let dot = 0;
      for (let i = 0; i < queryVec.length; i++) dot += queryVec[i] * profile.embedding[i];
      semantic = dot;
      if (semantic > 0.35) reasons.push("semantic");
    }
    const confidenceBoost =
      profile.is_user_edited ? 0.05 : profile.is_admin_edited ? 0.04 : (profile.confidence_score ?? 0) * 0.1;
    const total = kwScore + semantic + confidenceBoost;
    return { profile, total, reasons: [...new Set(reasons)] };
  });

  scored.sort((a, b) => b.total - a.total);

  const ranked = scored.filter((s) => s.total > 0.05 || query.length <= 2);
  const page = ranked.slice(offset, offset + limit);

  return {
    results: page.map((s) => toSearchResult(s.profile, s.total, s.reasons, authenticated)),
    total: ranked.length,
    offset,
    limit,
    has_more: offset + page.length < ranked.length,
  };
}

export async function resolveMergedProfile(uid: string): Promise<MergedCareerProfile | null> {
  const { overrides, adminEdits } = await loadAllOverrides();
  const override = overrides.find((o) => (o.player_uid || `user:${o.user_id}`) === uid);
  if (override) return overrideToMerged(override);

  const admin = adminEdits.find((a) => a.player_uid === uid);
  if (admin) return adminEditToMerged(admin);

  const { getMergedByUid } = await import("./loader");
  return getMergedByUid(uid);
}

export async function getProfileForDisplay(
  uid: string,
  authenticated: boolean,
  requestingUserId?: string
): Promise<
  (MergedCareerProfile & {
    can_claim: boolean;
    can_attempt_claim: boolean;
    claimed_by_other: boolean;
  }) | null
> {
  const { overrides } = await loadAllOverrides();
  const merged = await resolveMergedProfile(uid);
  if (!merged) return null;

  if (!isEligibleForCareersSearch(merged)) {
    return null;
  }

  const override = overrides.find((o) => (o.player_uid || `user:${o.user_id}`) === uid);

  if (override) {
    const isOwner = Boolean(requestingUserId && override.user_id === requestingUserId);
    const claimedByOther = Boolean(requestingUserId && !isOwner);
    return {
      ...merged,
      can_claim: false,
      can_attempt_claim: false,
      claimed_by_other: claimedByOther,
    };
  }

  const existingClaim = overrides.find((o) => o.player_uid === uid);
  const claimedByOther = Boolean(
    existingClaim && requestingUserId && existingClaim.user_id !== requestingUserId
  );
  const canClaim = authenticated && !existingClaim && Boolean(requestingUserId);
  const canAttemptClaim =
    authenticated && Boolean(requestingUserId) && (!existingClaim || claimedByOther);

  if (!authenticated) {
    return {
      ...merged,
      full_name: merged.full_name,
      linkedin_url: null,
      email: null,
      open_to_career_chats: false,
      can_claim: false,
      can_attempt_claim: false,
      claimed_by_other: false,
    };
  }

  return {
    ...merged,
    can_claim: canClaim,
    can_attempt_claim: canAttemptClaim,
    claimed_by_other: claimedByOther,
  };
}

export async function findClaimCandidates(userFullName: string, limit = 5) {
  const { overrides } = await loadAllOverrides();
  const scraped = getAllScrapedMerged();
  const claimed = new Set(overrides.map((o) => o.player_uid).filter(Boolean));

  const { namesMatch } = await import("./names");
  return scraped
    .filter((p) => !claimed.has(p.player_uid) && namesMatch(p.full_name, userFullName))
    .slice(0, limit);
}
