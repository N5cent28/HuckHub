import { normalizeLinkedInUrls } from "./linkedin";
import type {
  CareerAdminEdit,
  CareerProfileOverride,
  MergedCareerProfile,
  ScrapedCareerProfile,
} from "./types";

const EMBEDDING_DIM = 384;

export function buildEmbedSourceText(fields: {
  career_field?: string | null;
  current_role?: string | null;
  education?: string | null;
  career_summary?: string | null;
}): string {
  const parts: string[] = [];
  if (fields.career_field && fields.career_field !== "unknown") {
    parts.push(`Career field: ${fields.career_field}`);
  }
  if (fields.current_role && fields.current_role !== "unknown") {
    parts.push(`Role: ${fields.current_role}`);
  }
  if (fields.education && fields.education !== "unknown") {
    parts.push(`Education: ${fields.education}`);
  }
  if (fields.career_summary && fields.career_summary !== "unknown") {
    parts.push(`Summary: ${fields.career_summary}`);
  }
  return parts.join(". ");
}

function toVector(raw: number[] | null): Float32Array | null {
  return raw && raw.length === EMBEDDING_DIM ? new Float32Array(raw) : null;
}

export function scrapedToMerged(p: ScrapedCareerProfile): MergedCareerProfile {
  const urls = normalizeLinkedInUrls(p);
  return {
    player_uid: p.player_uid,
    full_name: p.full_name,
    career_field: p.career_field,
    current_role: p.current_role,
    education: p.education,
    career_summary: p.career_summary,
    confidence_score: p.confidence_score,
    // Set from community/admin votes by the caller (see loadVerifiedLinkedIn).
    linkedin_verified: false,
    linkedin_url: urls[0] ?? null,
    linkedin_urls: urls,
    llm_rationale: p.llm_rationale,
    known_locations: p.known_locations,
    teams_played: p.teams_played,
    teams_coached: p.teams_coached,
    provenance: "inferred",
    is_user_edited: false,
    is_admin_edited: false,
    open_to_career_chats: false,
    email: null,
    adult_from_year: p.adult_from_year,
    avatar_url: null,
    embedding: null,
  };
}

export function overrideToMerged(
  override: CareerProfileOverride,
  scraped: ScrapedCareerProfile | null | undefined
): MergedCareerProfile {
  return {
    player_uid: override.player_uid || `user:${override.user_id}`,
    full_name: override.full_name,
    career_field: override.career_field,
    current_role: override.current_role,
    education: override.education,
    career_summary: override.career_summary,
    confidence_score: scraped?.confidence_score ?? 1,
    linkedin_verified: Boolean(override.linkedin_url),
    linkedin_url: override.linkedin_url,
    linkedin_urls: normalizeLinkedInUrls({ linkedin_url: override.linkedin_url }),
    llm_rationale: scraped?.llm_rationale ?? null,
    known_locations: override.known_locations || [],
    teams_played: scraped?.teams_played ?? [],
    teams_coached: scraped?.teams_coached ?? [],
    provenance: "user",
    is_user_edited: true,
    is_admin_edited: false,
    open_to_career_chats: override.open_to_career_chats,
    email: override.email,
    adult_from_year: scraped?.adult_from_year ?? null,
    avatar_url: override.avatar_url ?? null,
    embedding: toVector(override.embedding),
  };
}

export function adminEditToMerged(
  edit: CareerAdminEdit,
  scraped: ScrapedCareerProfile | null | undefined
): MergedCareerProfile {
  return {
    player_uid: edit.player_uid,
    full_name: edit.full_name,
    career_field: edit.career_field,
    current_role: edit.current_role,
    education: edit.education,
    career_summary: edit.career_summary,
    confidence_score: scraped?.confidence_score ?? 1,
    linkedin_verified: Boolean(edit.linkedin_url),
    linkedin_url: edit.linkedin_url,
    linkedin_urls: normalizeLinkedInUrls({ linkedin_url: edit.linkedin_url }),
    llm_rationale: scraped?.llm_rationale ?? null,
    known_locations: edit.known_locations || [],
    teams_played: scraped?.teams_played ?? [],
    teams_coached: scraped?.teams_coached ?? [],
    provenance: "admin",
    is_user_edited: false,
    is_admin_edited: true,
    open_to_career_chats: false,
    email: null,
    adult_from_year: scraped?.adult_from_year ?? null,
    avatar_url: null,
    embedding: toVector(edit.embedding),
  };
}

/**
 * Member overrides win over admin edits, which win over scraped data.
 * Returns the edited profiles (scraped-only rows stay in Postgres).
 */
export function mergeEditedProfiles(
  overrides: CareerProfileOverride[],
  adminEdits: CareerAdminEdit[],
  scrapedByUid: Map<string, ScrapedCareerProfile>
): MergedCareerProfile[] {
  const userOverrideUids = new Set(overrides.map((o) => o.player_uid).filter(Boolean) as string[]);
  const merged: MergedCareerProfile[] = [];
  for (const edit of adminEdits) {
    if (userOverrideUids.has(edit.player_uid)) continue;
    merged.push(adminEditToMerged(edit, scrapedByUid.get(edit.player_uid)));
  }
  for (const override of overrides) {
    merged.push(overrideToMerged(override, override.player_uid ? scrapedByUid.get(override.player_uid) : null));
  }
  return merged;
}

export function overrideFromForm(
  userId: string,
  existing: Pick<CareerProfileOverride, "full_name" | "known_locations"> | null,
  body: Record<string, unknown>
): Partial<CareerProfileOverride> {
  const knownLocations = Array.isArray(body.known_locations)
    ? (body.known_locations as string[]).map((s) => s.trim()).filter(Boolean)
    : typeof body.known_locations === "string"
      ? (body.known_locations as string).split(",").map((s) => s.trim()).filter(Boolean)
      : existing?.known_locations || [];

  const fields = {
    career_field: (body.career_field as string) || null,
    current_role: (body.current_role as string) || null,
    education: (body.education as string) || null,
    career_summary: (body.career_summary as string) || null,
  };

  return {
    user_id: userId,
    full_name: (body.full_name as string)?.trim() || existing?.full_name || "",
    career_field: fields.career_field,
    current_role: fields.current_role,
    education: fields.education,
    career_summary: fields.career_summary,
    linkedin_url: (body.linkedin_url as string) || null,
    known_locations: knownLocations,
    email: (body.email as string) || null,
    open_to_career_chats: Boolean(body.open_to_career_chats),
    embed_source_text: buildEmbedSourceText(fields),
  };
}
