export interface TeamEntry {
  team_name: string;
  year: number;
  competition_level: string | null;
  division_name: string | null;
  team_location: string | null;
}

export interface ScrapedCareerProfile {
  player_uid: string;
  full_name: string;
  source: string;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  confidence_score: number | null;
  linkedin_verified: boolean;
  linkedin_url: string | null;
  llm_rationale: string | null;
  updated_at: string;
  embed_source_text: string | null;
  embedded_at: string | null;
  known_locations: string[];
  age_point_estimate_2026: number | null;
  age_min_2026: number | null;
  age_max_2026: number | null;
  age_source: string | null;
  age_confidence: string | null;
  openalex_count: number;
}

export interface CareerProfileOverride {
  id: string;
  user_id: string;
  player_uid: string | null;
  full_name: string;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  linkedin_url: string | null;
  known_locations: string[];
  email: string | null;
  open_to_career_chats: boolean;
  embed_source_text: string | null;
  embedding: number[] | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CareerProvenance = "user" | "inferred";

export interface MergedCareerProfile {
  player_uid: string;
  full_name: string;
  source: string;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  confidence_score: number | null;
  linkedin_verified: boolean;
  linkedin_url: string | null;
  llm_rationale: string | null;
  known_locations: string[];
  teams: TeamEntry[];
  provenance: CareerProvenance;
  is_user_edited: boolean;
  open_to_career_chats: boolean;
  email: string | null;
  embed_source_text: string | null;
  embedding: Float32Array | null;
  embedding_index: number | null;
}

export interface CareerSearchResult {
  player_uid: string;
  full_name: string | null;
  name_blurred: boolean;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  known_locations: string[];
  confidence_score: number | null;
  confidence_label: "high" | "medium" | "low" | "member";
  linkedin_verified: boolean;
  provenance: CareerProvenance;
  is_user_edited: boolean;
  open_to_career_chats: boolean;
  score: number;
  match_reasons: string[];
}

export interface CareersManifest {
  generated_at: string;
  schema_version: string;
  embedding_model: string;
  embedding_dim: number;
  n_profiles: number;
  n_embeddings: number;
  checksums: Record<string, string>;
}
