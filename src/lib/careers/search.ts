import type { CareerProfileOverride, CareerSearchResult, MergedCareerProfile } from "./types";
import { confidenceLabel, normalizeDisplayName } from "./names";
import { embedText } from "./embed";
import { getAllScrapedMerged } from "./loader";
import { mergeProfiles, overrideToMerged } from "./merge";
import { createServerClient } from "@/lib/supabase";

export interface SearchParams {
  query?: string;
  location?: string;
  min_confidence?: number;
  linkedin_verified?: boolean;
  top_k?: number;
  authenticated?: boolean;
}

async function loadOverrides(): Promise<CareerProfileOverride[]> {
  const sb = createServerClient();
  const { data, error } = await sb.from("career_profile_overrides").select("*");
  if (error) {
    // Table may not exist yet during local dev
    console.warn("career_profile_overrides load failed:", error.message);
    return [];
  }
  return (data || []) as CareerProfileOverride[];
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
  if (params.location) {
    const loc = params.location.toLowerCase();
    const match = profile.known_locations.some((l) => l.toLowerCase().includes(loc));
    if (!match) return false;
  }

  if (params.linkedin_verified && !profile.linkedin_verified && !profile.is_user_edited) {
    return false;
  }

  if (params.min_confidence != null && !profile.is_user_edited) {
    const conf = profile.confidence_score ?? 0;
    if (conf < params.min_confidence) return false;
  }

  return true;
}

function toSearchResult(
  profile: MergedCareerProfile,
  score: number,
  matchReasons: string[],
  authenticated: boolean
): CareerSearchResult {
  return {
    player_uid: profile.player_uid,
    full_name: authenticated ? profile.full_name : null,
    name_blurred: !authenticated,
    career_field: profile.career_field,
    current_role: profile.current_role,
    education: profile.education,
    career_summary: profile.career_summary,
    known_locations: profile.known_locations,
    confidence_score: profile.confidence_score,
    confidence_label: confidenceLabel(profile.confidence_score, profile.is_user_edited),
    linkedin_verified: profile.linkedin_verified,
    provenance: profile.provenance,
    is_user_edited: profile.is_user_edited,
    open_to_career_chats: authenticated ? profile.open_to_career_chats : false,
    score,
    match_reasons: matchReasons,
  };
}

export async function searchCareers(params: SearchParams): Promise<{
  results: CareerSearchResult[];
  total: number;
}> {
  const overrides = await loadOverrides();
  const scraped = getAllScrapedMerged();
  const profiles = mergeProfiles(scraped, overrides);
  const filtered = profiles.filter((p) => passesFilters(p, params));

  const query = params.query?.trim() || "";
  const topK = params.top_k ?? 25;
  const authenticated = params.authenticated ?? false;

  if (!query) {
    const sorted = filtered
      .sort((a, b) => {
        if (a.is_user_edited !== b.is_user_edited) return a.is_user_edited ? -1 : 1;
        return (b.confidence_score ?? 0) - (a.confidence_score ?? 0);
      })
      .slice(0, topK);

    return {
      results: sorted.map((p) =>
        toSearchResult(p, p.confidence_score ?? 0, ["browse"], authenticated)
      ),
      total: filtered.length,
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
    const confidenceBoost = profile.is_user_edited ? 0.05 : (profile.confidence_score ?? 0) * 0.1;
    const total = kwScore + semantic + confidenceBoost;
    return { profile, total, reasons: [...new Set(reasons)] };
  });

  scored.sort((a, b) => b.total - a.total);

  const results = scored
    .filter((s) => s.total > 0.05 || query.length <= 2)
    .slice(0, topK)
    .map((s) => toSearchResult(s.profile, s.total, s.reasons, authenticated));

  return { results, total: filtered.length };
}

export async function getProfileForDisplay(
  uid: string,
  authenticated: boolean,
  requestingUserId?: string
): Promise<(MergedCareerProfile & { can_claim: boolean }) | null> {
  const overrides = await loadOverrides();
  const override = overrides.find((o) => (o.player_uid || `user:${o.user_id}`) === uid);
  if (override) {
    const merged = overrideToMerged(override);
    return { ...merged, can_claim: false };
  }

  const { getMergedByUid } = await import("./loader");
  const scraped = getMergedByUid(uid);
  if (!scraped) return null;

  const alreadyClaimed = overrides.some((o) => o.player_uid === uid);
  const canClaim = authenticated && !alreadyClaimed && Boolean(requestingUserId);

  if (!authenticated) {
    return {
      ...scraped,
      full_name: "Sign in to view",
      linkedin_url: null,
      email: null,
      open_to_career_chats: false,
      can_claim: false,
    };
  }

  return { ...scraped, can_claim: canClaim };
}

export async function findClaimCandidates(userFullName: string, limit = 5) {
  const scraped = getAllScrapedMerged();
  const overrides = await loadOverrides();
  const claimed = new Set(overrides.map((o) => o.player_uid).filter(Boolean));

  const { namesMatch } = await import("./names");
  return scraped
    .filter((p) => !claimed.has(p.player_uid) && namesMatch(p.full_name, userFullName))
    .slice(0, limit);
}
