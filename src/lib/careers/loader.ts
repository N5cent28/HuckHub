import fs from "fs";
import path from "path";
import crypto from "crypto";
import { loadNpyMatrix, rowFromMatrix } from "./npy";
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

  const embeddingIds = fs
    .readFileSync(path.join(CAREERS_DIR, "embedding_ids.txt"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const embeddingMatrix = loadNpyMatrix(path.join(CAREERS_DIR, "embeddings.npy"));
  const uidToIndex = new Map<string, number>();
  embeddingIds.forEach((uid, i) => uidToIndex.set(uid, i));

  const locationSet = new Set<string>();
  for (const p of rawProfiles) {
    for (const loc of p.known_locations || []) {
      if (loc) locationSet.add(loc);
    }
  }

  cached = {
    manifest,
    profiles,
    teams,
    embeddingIds,
    embeddingMatrix,
    uidToIndex,
    locations: [...locationSet].sort((a, b) => a.localeCompare(b)),
  };
  return cached;
}

export function scrapedToMerged(profile: ScrapedCareerProfile, dataset: CareersDataset): MergedCareerProfile {
  const idx = dataset.uidToIndex.get(profile.player_uid);
  const embedding =
    idx != null ? rowFromMatrix(dataset.embeddingMatrix, idx, EMBEDDING_DIM) : null;

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
    llm_rationale: profile.llm_rationale,
    known_locations: profile.known_locations || [],
    teams: dataset.teams.get(profile.player_uid) || [],
    provenance: "inferred",
    is_user_edited: false,
    open_to_career_chats: false,
    email: null,
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

export { EMBEDDING_DIM, CAREERS_DIR };
