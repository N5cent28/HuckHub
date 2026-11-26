import type { CareerSearchResult, MergedCareerProfile } from "./types";
import {
  confidenceLabel,
  nameMatchScore,
  namesMatch,
  normalizeDisplayName,
  HIDDEN_NAME,
  redactName,
  redactedSummaryPrefix,
} from "./names";
import { isEligibleForCareersSearch } from "./age";
import { locationMatchesProfile } from "./locations";
import { profileMatchesDivision } from "./teams";
import { embedText } from "./embed";
import { mergeEditedProfiles, overrideToMerged, adminEditToMerged, scrapedToMerged } from "./merge";
import { loadOverrides, loadAdminEdits, loadVerifiedLinkedIn } from "./db";
import {
  browseDirectory,
  findNameCandidates,
  getScrapedByUid,
  getScrapedByUids,
  loadSuppressedUids,
  searchDirectory,
  type DirectoryFilters,
  type DirectoryRow,
} from "./directory";

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

/** Deepest result the search pages through (scored candidate pool is ~300–600). */
const MAX_SEARCH_DEPTH = 600;

/**
 * Member/admin edits live in small Supabase tables and are merged in Node;
 * the ~120K scraped profiles are filtered, scored, and paged in Postgres.
 */
async function loadEditedProfiles(): Promise<MergedCareerProfile[]> {
  const [allOverrides, allAdminEdits, suppressed] = await Promise.all([
    loadOverrides(),
    loadAdminEdits(),
    loadSuppressedUids(),
  ]);
  // Admin edits are kept for removed profiles (so a removal can be undone); hide them.
  const overrides = allOverrides.filter((o) => !o.player_uid || !suppressed.has(o.player_uid));
  const adminEdits = allAdminEdits.filter((a) => !suppressed.has(a.player_uid));
  const uids = [
    ...overrides.map((o) => o.player_uid).filter(Boolean),
    ...adminEdits.map((a) => a.player_uid),
  ] as string[];
  const scraped = await getScrapedByUids(uids);
  return mergeEditedProfiles(overrides, adminEdits, scraped);
}

function keywordScore(profile: MergedCareerProfile, query: string): { score: number; reasons: string[] } {
  const q = query.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const nameScore = nameMatchScore(profile.full_name, query);
  if (nameScore > 0) {
    score += nameScore;
    reasons.push(nameScore === 5 ? "exact_name" : "name");
  }

  const locs = [
    ...profile.known_locations,
    ...[...profile.teams_played, ...profile.teams_coached].map((t) => t.team_location || ""),
  ];
  if (locs.some((loc) => loc.toLowerCase().includes(q))) {
    score += 0.9;
    reasons.push("location");
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

function passesFilters(profile: MergedCareerProfile, params: SearchParams): boolean {
  if (params.location && !locationMatchesProfile(profile, params.location)) return false;
  if (params.linkedin_verified && !profile.linkedin_verified) return false;
  if (params.division && !profileMatchesDivision(profile, params.division)) return false;
  if (params.min_confidence != null && !profile.is_user_edited && !profile.is_admin_edited) {
    if ((profile.confidence_score ?? 0) < params.min_confidence) return false;
  }
  return isEligibleForCareersSearch(profile);
}

/** Mark a profile verified when votes verified one of its current LinkedIn links. */
function markVoteVerified(
  profile: MergedCareerProfile,
  pairs: { player_uid: string; linkedin_url: string }[] | undefined
): MergedCareerProfile {
  if (!pairs || profile.linkedin_verified) return profile;
  const hit = pairs.some(
    (v) => v.player_uid === profile.player_uid && profile.linkedin_urls.includes(v.linkedin_url)
  );
  return hit ? { ...profile, linkedin_verified: true } : profile;
}

function editRank(p: { is_user_edited: boolean; is_admin_edited: boolean }): number {
  return p.is_user_edited ? 2 : p.is_admin_edited ? 1 : 0;
}

function toSearchResult(
  profile: MergedCareerProfile,
  score: number,
  matchReasons: string[],
  authenticated: boolean
): CareerSearchResult {
  // Signed-out visitors never receive the real name (the UI blur is cosmetic).
  const hide = (text: string | null) => (authenticated ? text : redactName(text, profile.full_name));
  const summary = hide(profile.career_summary);
  return {
    player_uid: profile.player_uid,
    full_name: authenticated ? normalizeDisplayName(profile.full_name) : HIDDEN_NAME,
    name_blurred: !authenticated,
    career_field: hide(profile.career_field),
    current_role: hide(profile.current_role),
    education: hide(profile.education),
    career_summary: summary,
    career_summary_name_prefix: authenticated ? null : redactedSummaryPrefix(summary),
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

/** Directory rows only carry card fields; fill the rest with scraped defaults. */
function rowToMerged(row: DirectoryRow): MergedCareerProfile {
  return scrapedToMerged({
    ...row,
    llm_rationale: null,
    adult_from_year: null,
    has_embedding: false,
    teams_played: [],
    teams_coached: [],
  });
}

export async function searchCareers(params: SearchParams): Promise<{
  results: CareerSearchResult[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}> {
  const query = params.query?.trim() || "";
  const offset = Math.min(Math.max(0, params.offset ?? 0), MAX_SEARCH_DEPTH);
  const limit = Math.min(params.limit ?? params.top_k ?? 30, 100);
  const authenticated = params.authenticated ?? false;

  const verified = params.linkedin_verified ? await loadVerifiedLinkedIn() : undefined;
  const edited = (await loadEditedProfiles())
    .map((p) => markVoteVerified(p, verified))
    .filter((p) => passesFilters(p, params));
  const filters: DirectoryFilters = {
    location: params.location,
    division: params.division,
    min_confidence: params.min_confidence,
    verified,
    exclude_uids: edited.map((p) => p.player_uid),
  };

  if (!query) {
    // Members first, then admin-verified, then the scraped directory
    // (by confidence when Min confidence is set, otherwise alphabetical).
    const byConfidence = params.min_confidence != null;
    edited.sort(
      (a, b) =>
        editRank(b) - editRank(a) ||
        (byConfidence ? (b.confidence_score ?? 0) - (a.confidence_score ?? 0) : 0) ||
        normalizeDisplayName(a.full_name).localeCompare(normalizeDisplayName(b.full_name), undefined, {
          sensitivity: "base",
        })
    );
    const editedPage = edited.slice(offset, offset + limit);
    const remaining = limit - editedPage.length;
    const { rows, total: dirTotal } = await browseDirectory(
      filters,
      Math.max(0, offset - edited.length),
      remaining
    );
    const results = [
      ...editedPage.map((p) => toSearchResult(p, 0, ["browse"], authenticated)),
      ...rows.map((r) => toSearchResult(rowToMerged(r), 0, ["browse"], authenticated)),
    ];
    const total = edited.length + dirTotal;
    return { results, total, offset, limit, has_more: offset + results.length < total };
  }

  let queryVec: Float32Array | null = null;
  try {
    queryVec = await embedText(query);
  } catch (err) {
    console.error("Query embed failed:", err);
  }

  const editedScored = edited
    .map((profile) => {
      const { score: kw, reasons } = keywordScore(profile, query);
      let semantic = 0;
      if (queryVec && profile.embedding) {
        for (let i = 0; i < queryVec.length; i++) semantic += queryVec[i] * profile.embedding[i];
        if (semantic > 0.35) reasons.push("semantic");
      }
      return { profile, total: kw + semantic, reasons: [...new Set(reasons)] };
    })
    .filter((s) => s.total > 0.05 || query.length <= 2);

  const { rows, total: dirTotal } = await searchDirectory(query, queryVec, filters, offset + limit);

  const merged = [
    ...editedScored.map((s) => ({
      score: s.total,
      name: normalizeDisplayName(s.profile.full_name),
      result: () => toSearchResult(s.profile, s.total, s.reasons, authenticated),
    })),
    ...rows.map((r) => ({
      score: r.score,
      name: normalizeDisplayName(r.full_name),
      result: () => toSearchResult(rowToMerged(r), r.score, r.reasons, authenticated),
    })),
  ].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const results = merged.slice(offset, offset + limit).map((m) => m.result());
  const total = Math.min(editedScored.length + dirTotal, MAX_SEARCH_DEPTH + limit);
  return { results, total, offset, limit, has_more: offset + results.length < total };
}

export async function resolveMergedProfile(uid: string): Promise<MergedCareerProfile | null> {
  const [overrides, adminEdits, suppressed] = await Promise.all([
    loadOverrides(),
    loadAdminEdits(),
    loadSuppressedUids(),
  ]);
  if (suppressed.has(uid)) return null;
  const override = overrides.find((o) => (o.player_uid || `user:${o.user_id}`) === uid);
  const admin = override ? undefined : adminEdits.find((a) => a.player_uid === uid);

  const scraped = uid.startsWith("user:") ? null : await getScrapedByUid(uid);
  if (override) return overrideToMerged(override, scraped);
  if (admin) return adminEditToMerged(admin, scraped);
  if (!scraped) return null;
  return markVoteVerified(scrapedToMerged(scraped), await loadVerifiedLinkedIn(uid));
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
    is_owner: boolean;
  }) | null
> {
  const overrides = await loadOverrides();
  const merged = await resolveMergedProfile(uid);
  if (!merged) return null;
  if (!isEligibleForCareersSearch(merged)) return null;

  const override = overrides.find((o) => (o.player_uid || `user:${o.user_id}`) === uid);
  const isOwner = Boolean(override && requestingUserId && override.user_id === requestingUserId);

  if (override) {
    return {
      ...merged,
      can_claim: false,
      can_attempt_claim: false,
      claimed_by_other: Boolean(requestingUserId && !isOwner),
      is_owner: isOwner,
    };
  }

  if (!authenticated || !requestingUserId) {
    return {
      ...merged,
      linkedin_url: null,
      email: null,
      open_to_career_chats: false,
      can_claim: false,
      can_attempt_claim: false,
      claimed_by_other: false,
      is_owner: false,
    };
  }

  return {
    ...merged,
    can_claim: true,
    can_attempt_claim: true,
    claimed_by_other: false,
    is_owner: false,
  };
}

export async function findClaimCandidates(userFullName: string, limit = 5) {
  const overrides = await loadOverrides();
  const claimed = new Set(overrides.map((o) => o.player_uid).filter(Boolean));
  const candidates = (await findNameCandidates(userFullName, 50))
    .filter((c) => !claimed.has(c.player_uid) && namesMatch(c.full_name, userFullName))
    .slice(0, limit);
  const scraped = await getScrapedByUids(candidates.map((c) => c.player_uid));
  return candidates
    .map((c) => scraped.get(c.player_uid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map(scrapedToMerged);
}
