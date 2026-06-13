import type { CareerProfileOverride, MergedCareerProfile } from "./types";
import { loadCareersDataset, scrapedToMerged } from "./loader";
import { EMBEDDING_DIM } from "./loader";

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

export function overrideToMerged(override: CareerProfileOverride): MergedCareerProfile {
  const dataset = loadCareersDataset();
  const scraped = override.player_uid ? dataset.profiles.get(override.player_uid) : null;
  const teams = override.player_uid ? dataset.teams.get(override.player_uid) || [] : [];

  let embedding: Float32Array | null = null;
  if (override.embedding && override.embedding.length === EMBEDDING_DIM) {
    embedding = new Float32Array(override.embedding);
  }

  return {
    player_uid: override.player_uid || `user:${override.user_id}`,
    full_name: override.full_name,
    source: scraped?.source || "user",
    career_field: override.career_field,
    current_role: override.current_role,
    education: override.education,
    career_summary: override.career_summary,
    confidence_score: scraped?.confidence_score ?? 1,
    linkedin_verified: Boolean(override.linkedin_url),
    linkedin_url: override.linkedin_url,
    llm_rationale: scraped?.llm_rationale ?? null,
    known_locations: override.known_locations || [],
    teams,
    provenance: "user",
    is_user_edited: true,
    open_to_career_chats: override.open_to_career_chats,
    email: override.email,
    embed_source_text: override.embed_source_text,
    embedding,
    embedding_index: null,
  };
}

export function mergeProfiles(
  scrapedList: MergedCareerProfile[],
  overrides: CareerProfileOverride[]
): MergedCareerProfile[] {
  const overriddenUids = new Set(
    overrides.map((o) => o.player_uid).filter(Boolean) as string[]
  );
  const merged: MergedCareerProfile[] = [];

  for (const scraped of scrapedList) {
    if (overriddenUids.has(scraped.player_uid)) continue;
    merged.push(scraped);
  }

  for (const override of overrides) {
    merged.push(overrideToMerged(override));
  }

  return merged;
}

export function overrideFromForm(
  userId: string,
  existing: CareerProfileOverride | null,
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
