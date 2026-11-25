/**
 * Scraped careers directory in Supabase Postgres (replaces the in-repo
 * profiles.json / teams.json / embeddings.npy bundle).
 *
 * Tables + RPCs: supabase/migrations/20261122_careers_directory_pg.sql
 * Written by:    ExpertScraper `python -m expertscraper publish-careers`
 *
 * All RPCs are granted to service_role only, so this module must run
 * server-side with SUPABASE_SERVICE_ROLE_KEY set.
 */
import { createServerClient } from "@/lib/supabase";
import { careersAsOfYear } from "./age";
import { normalizeLocationList, resolveLocationFilter } from "./locations";
import { normalizeNameForMatch } from "./names";
import { divisionLabelsFromPairs, resolveDivisionFilter, splitTeamHistory, type DivisionPair } from "./teams";
import type { CareersMeta, ScrapedCareerProfile, TeamEntry } from "./types";

const FACET_TTL_MS = 10 * 60 * 1000;

function db() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set; the careers directory RPCs are service-role only."
    );
  }
  return createServerClient();
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

// ---------------------------------------------------------------------------
// Facets + meta (small, cached per server instance)
// ---------------------------------------------------------------------------

interface Facets {
  locations: string[];
  divisionPairs: DivisionPair[];
  divisionLabels: string[];
  loadedAt: number;
}

let facetsCache: Facets | null = null;
let metaCache: { meta: CareersMeta; loadedAt: number } | null = null;

export async function getFacets(): Promise<Facets> {
  if (facetsCache && Date.now() - facetsCache.loadedAt < FACET_TTL_MS) return facetsCache;
  const raw = await rpc<{ locations: string[]; divisions: DivisionPair[] }>("career_facets", {});
  facetsCache = {
    locations: raw.locations || [],
    divisionPairs: raw.divisions || [],
    divisionLabels: divisionLabelsFromPairs(raw.divisions || []),
    loadedAt: Date.now(),
  };
  return facetsCache;
}

export async function getCareersMeta(): Promise<CareersMeta & { n_locations: number }> {
  if (!metaCache || Date.now() - metaCache.loadedAt >= FACET_TTL_MS) {
    const { data, error } = await db().from("career_dataset_meta").select("*").maybeSingle();
    if (error) throw new Error(`career_dataset_meta: ${error.message}`);
    if (!data) throw new Error("Careers directory has not been published yet (career_dataset_meta is empty).");
    metaCache = {
      meta: {
        generated_at: data.generated_at,
        n_profiles: data.n_profiles,
        n_with_career: data.n_with_career,
        n_embeddings: data.n_embeddings,
        embedding_model: data.embedding_model,
        schema_version: data.schema_version,
      },
      loadedAt: Date.now(),
    };
  }
  const facets = await getFacets();
  return { ...metaCache.meta, n_locations: facets.locations.length };
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface DirectoryFilters {
  location?: string;
  division?: string;
  min_confidence?: number;
  /** When set, only these community/admin-verified (uid, LinkedIn URL) pairs. */
  verified?: { player_uid: string; linkedin_url: string }[];
  exclude_uids?: string[];
}

async function filterArgs(f: DirectoryFilters) {
  const facets = await getFacets();
  const args: Record<string, unknown> = {
    p_min_confidence: f.min_confidence ?? null,
    p_verified_uids: f.verified ? f.verified.map((v) => v.player_uid) : null,
    p_verified_urls: f.verified ? f.verified.map((v) => v.linkedin_url) : null,
    p_as_of_year: careersAsOfYear(),
    p_exclude_uids: f.exclude_uids ?? [],
    p_locations: null,
    p_div_levels: null,
    p_div_names: null,
  };
  if (f.location?.trim()) {
    args.p_locations = resolveLocationFilter(f.location, facets.locations);
  }
  if (f.division?.trim()) {
    const { levels, names } = resolveDivisionFilter(f.division, facets.divisionPairs);
    args.p_div_levels = levels;
    args.p_div_names = names;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Browse + search
// ---------------------------------------------------------------------------

export interface DirectoryRow {
  player_uid: string;
  full_name: string;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  confidence_score: number | null;
  linkedin_urls: string[];
  known_locations: string[];
  score: number;
  reasons: string[];
}

interface RawRow extends Omit<DirectoryRow, "score" | "reasons"> {
  score?: number;
  reasons?: string[];
  total_count: number;
}

function toRows(raw: RawRow[] | null): { rows: DirectoryRow[]; total: number } {
  const list = raw || [];
  return {
    total: list.length ? Number(list[0].total_count) : 0,
    rows: list.map(({ total_count: _t, ...r }) => ({
      ...r,
      known_locations: normalizeLocationList(r.known_locations || []),
      linkedin_urls: r.linkedin_urls || [],
      score: r.score ?? 0,
      reasons: r.reasons ?? ["browse"],
    })),
  };
}

/** Career profiles first, then alphabetical. `total` counts every match. */
export async function browseDirectory(
  filters: DirectoryFilters,
  offset: number,
  limit: number
): Promise<{ rows: DirectoryRow[]; total: number }> {
  // limit >= 1 so the total still comes back when the page is all overrides.
  const raw = await rpc<RawRow[]>("career_browse", {
    ...(await filterArgs(filters)),
    p_offset: offset,
    p_limit: Math.max(1, limit),
  });
  const out = toRows(raw);
  return { rows: out.rows.slice(0, limit), total: out.total };
}

/** Top `limit` scored matches; `total` is the size of the scored candidate pool. */
export async function searchDirectory(
  query: string,
  queryVec: Float32Array | null,
  filters: DirectoryFilters,
  limit: number
): Promise<{ rows: DirectoryRow[]; total: number }> {
  const raw = await rpc<RawRow[]>("career_search", {
    ...(await filterArgs(filters)),
    p_query: query,
    p_query_norm: normalizeNameForMatch(query),
    p_query_vec: queryVec ? `[${Array.from(queryVec).join(",")}]` : null,
    p_limit: limit,
  });
  return toRows(raw);
}

// ---------------------------------------------------------------------------
// Single profiles
// ---------------------------------------------------------------------------

interface RawProfile extends Omit<ScrapedCareerProfile, "teams_played" | "teams_coached" | "known_locations"> {
  teams: TeamEntry[];
}

export async function getScrapedByUids(uids: string[]): Promise<Map<string, ScrapedCareerProfile>> {
  const out = new Map<string, ScrapedCareerProfile>();
  const unique = [...new Set(uids.filter(Boolean))];
  if (!unique.length) return out;

  const raw = await rpc<RawProfile[]>("career_profiles_by_uid", { p_uids: unique });
  for (const r of raw || []) {
    const { teams, ...rest } = r;
    const { teams_played, teams_coached } = splitTeamHistory(teams || []);
    out.set(r.player_uid, {
      ...rest,
      linkedin_urls: rest.linkedin_urls || [],
      teams_played,
      teams_coached,
      known_locations: normalizeLocationList(
        teams_played.map((t) => t.team_location).filter(Boolean) as string[]
      ),
    });
  }
  return out;
}

export async function getScrapedByUid(uid: string): Promise<ScrapedCareerProfile | null> {
  return (await getScrapedByUids([uid])).get(uid) ?? null;
}

/** Fuzzy name lookup for claim suggestions (adults only). */
export async function findNameCandidates(fullName: string, limit = 50) {
  return rpc<{ player_uid: string; full_name: string }[]>("career_name_candidates", {
    p_query_norm: normalizeNameForMatch(fullName),
    p_as_of_year: careersAsOfYear(),
    p_limit: limit,
  });
}

/** Hide a scraped profile now and keep it out of future publishes. */
export async function suppressProfile(
  playerUid: string,
  reason: "owner_request" | "admin_approved_request" | "admin",
  requestedBy: string | null
): Promise<void> {
  await rpc<null>("career_suppress_profile", {
    p_uid: playerUid,
    p_reason: reason,
    p_requested_by: requestedBy,
  });
}
