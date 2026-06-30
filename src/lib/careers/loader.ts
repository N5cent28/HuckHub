import fs from "fs";
import path from "path";
import crypto from "crypto";
import { loadNpyMatrix, rowFromMatrix } from "./npy";
import { normalizeLinkedInUrls } from "./linkedin";
import { distinctLocationsFromProfiles, normalizeLocationList } from "./locations";
import { buildProfileTeamHistory, distinctDivisionLabelsFromTeams } from "./teams";
import type {
  CareersManifest,
  MergedCareerProfile,
  ScrapedCareerProfile,
  TeamEntry,
} from "./types";

const CAREERS_DIR = path.join(process.cwd(), "data", "careers");
const EMBEDDING_DIM = 384;

interface CareersDataset {
  manifest: CareersManifest;
  profiles: Map<string, ScrapedCareerProfile>;
  teams: Map<string, TeamEntry[]>;
  teamsPlayed: Map<string, TeamEntry[]>;
  teamsCoached: Map<string, TeamEntry[]>;
  embeddingIds: string[];
  embeddingMatrix: Float32Array;
  uidToIndex: Map<string, number>;
  locations: string[];
}

let cached: CareersDataset | null = null;

function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function loadManifest(): CareersManifest {
  const manifestPath = path.join(CAREERS_DIR, "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as CareersManifest;
}

function validateChecksums(manifest: CareersManifest): void {
  for (const [file, expected] of Object.entries(manifest.checksums)) {
    const filePath = path.join(CAREERS_DIR, file);
    const actual = sha256File(filePath);
    if (actual !== expected) {
      throw new Error(`Checksum mismatch for ${file}: expected ${expected}, got ${actual}`);
    }
  }
}

export function loadCareersDataset(): CareersDataset {
  if (cached) return cached;

  const manifest = loadManifest();
  validateChecksums(manifest);

  const rawProfiles = JSON.parse(
    fs.readFileSync(path.join(CAREERS_DIR, "profiles.json"), "utf8")
  ) as ScrapedCareerProfile[];

  const profiles = new Map<string, ScrapedCareerProfile>();
  for (const p of rawProfiles) {
    profiles.set(p.player_uid, p);
  }

  const teamsRaw = JSON.parse(
    fs.readFileSync(path.join(CAREERS_DIR, "teams.json"), "utf8")
  ) as Record<string, TeamEntry[]>;
  const teams = new Map(Object.entries(teamsRaw));

  const teamsPlayed = new Map<string, TeamEntry[]>();
  const teamsCoached = new Map<string, TeamEntry[]>();
  for (const p of rawProfiles) {
    const legacy = teams.get(p.player_uid) || [];
    const { teams_played, teams_coached } = buildProfileTeamHistory(p, legacy);
    teamsPlayed.set(p.player_uid, teams_played);
    teamsCoached.set(p.player_uid, teams_coached);
  }

  const embeddingIds = fs
    .readFileSync(path.join(CAREERS_DIR, "embedding_ids.txt"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const embeddingMatrix = loadNpyMatrix(path.join(CAREERS_DIR, "embeddings.npy"));
  const uidToIndex = new Map<string, number>();
  embeddingIds.forEach((uid, i) => uidToIndex.set(uid, i));

  const profilesWithTeams = rawProfiles.map((p) => ({
    known_locations: normalizeLocationList(p.known_locations || []),
    teams_played: teamsPlayed.get(p.player_uid) || [],
    teams_coached: teamsCoached.get(p.player_uid) || [],
  }));

  cached = {
    manifest,
    profiles,
    teams,
    teamsPlayed,
    teamsCoached,
    embeddingIds,
    embeddingMatrix,
    uidToIndex,
    locations: distinctLocationsFromProfiles(profilesWithTeams),
  };
  return cached;
}

export function scrapedToMerged(profile: ScrapedCareerProfile, dataset: CareersDataset): MergedCareerProfile {
  const idx = dataset.uidToIndex.get(profile.player_uid);
  const embedding =
    idx != null ? rowFromMatrix(dataset.embeddingMatrix, idx, EMBEDDING_DIM) : null;

  const teams_played = dataset.teamsPlayed.get(profile.player_uid) || [];
  const teams_coached = dataset.teamsCoached.get(profile.player_uid) || [];

  return {
    player_uid: profile.player_uid,
    full_name: profile.full_name,
    source: profile.source,
    career_field: profile.career_field,
    current_role: profile.current_role,
    education: profile.education,
    career_summary: profile.career_summary,
    confidence_score: profile.confidence_score,
    linkedin_verified: profile.linkedin_verified,
    linkedin_url: profile.linkedin_url,
    linkedin_urls: normalizeLinkedInUrls(profile),
    llm_rationale: profile.llm_rationale,
    known_locations: normalizeLocationList(profile.known_locations || []),
    teams_played,
    teams_coached,
    provenance: "inferred",
    is_user_edited: false,
    is_admin_edited: false,
    open_to_career_chats: false,
    email: null,
    age_point_estimate_2026: profile.age_point_estimate_2026 ?? null,
    age_min_2026: profile.age_min_2026 ?? null,
    age_max_2026: profile.age_max_2026 ?? null,
    age_source: profile.age_source ?? null,
    age_confidence: profile.age_confidence ?? null,
    embed_source_text: profile.embed_source_text,
    embedding,
    embedding_index: idx ?? null,
  };
}

export function getAllScrapedMerged(): MergedCareerProfile[] {
  const dataset = loadCareersDataset();
  return [...dataset.profiles.values()].map((p) => scrapedToMerged(p, dataset));
}

export function getMergedByUid(uid: string): MergedCareerProfile | null {
  const dataset = loadCareersDataset();
  const scraped = dataset.profiles.get(uid);
  if (scraped) return scrapedToMerged(scraped, dataset);
  return null;
}

export function getCareersMeta() {
  const dataset = loadCareersDataset();
  return {
    generated_at: dataset.manifest.generated_at,
    n_profiles: dataset.manifest.n_profiles,
    embedding_model: dataset.manifest.embedding_model,
    schema_version: dataset.manifest.schema_version,
    n_locations: dataset.locations.length,
  };
}

export function getDistinctLocations(): string[] {
  return loadCareersDataset().locations;
}

export function getDistinctDivisions(): string[] {
  const dataset = loadCareersDataset();
  return distinctDivisionLabelsFromTeams(dataset.teamsPlayed.values());
}

export { EMBEDDING_DIM, CAREERS_DIR };
