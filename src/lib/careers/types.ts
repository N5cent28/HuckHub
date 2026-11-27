export type TeamRole = "player" | "coach";

export interface TeamEntry {
  team_name: string;
  year: number;
  competition_level: string | null;
  division_name: string | null;
  team_location: string | null;
  role?: TeamRole;
}

/** Scraped directory profile as read from Postgres (career_profiles_by_uid). */
export interface ScrapedCareerProfile {
  player_uid: string;
  full_name: string;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  confidence_score: number | null;
  linkedin_urls: string[];
  llm_rationale: string | null;
  /** First year the player is estimated to be 18+; null = no age gate. */
  adult_from_year: number | null;
  has_embedding: boolean;
  known_locations: string[];
  teams_played: TeamEntry[];
  teams_coached: TeamEntry[];
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
  avatar_url?: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareerAdminEdit {
  id: string;
  player_uid: string;
  full_name: string;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  linkedin_url: string | null;
  known_locations: string[];
  embed_source_text: string | null;
  embedding: number[] | null;
  edited_by: string;
  created_at: string;
  updated_at: string;
}

export type CareerProvenance = "user" | "admin" | "inferred";

export interface MergedCareerProfile {
  player_uid: string;
  full_name: string;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  confidence_score: number | null;
  linkedin_verified: boolean;
  linkedin_url: string | null;
  linkedin_urls: string[];
  llm_rationale: string | null;
  known_locations: string[];
  teams_played: TeamEntry[];
  teams_coached: TeamEntry[];
  provenance: CareerProvenance;
  is_user_edited: boolean;
  is_admin_edited: boolean;
  open_to_career_chats: boolean;
  email: string | null;
  adult_from_year: number | null;
  /** LinkedIn photo copied at claim time (members only; null otherwise). */
  avatar_url: string | null;
  /** Only set for member/admin edits (stored in Supabase); scraped vectors stay in Postgres. */
  embedding: Float32Array | null;
}

export interface CareerSearchResult {
  player_uid: string;
  full_name: string | null;
  name_blurred: boolean;
  career_field: string | null;
  current_role: string | null;
  education: string | null;
  career_summary: string | null;
  career_summary_name_prefix: string | null;
  known_locations: string[];
  confidence_score: number | null;
  confidence_label: "high" | "medium" | "low" | "member" | "admin";
  linkedin_verified: boolean;
  provenance: CareerProvenance;
  is_user_edited: boolean;
  is_admin_edited: boolean;
  open_to_career_chats: boolean;
  avatar_url: string | null;
  score: number;
  match_reasons: string[];
}

export interface CareersMeta {
  generated_at: string;
  n_profiles: number;
  n_with_career: number;
  n_embeddings: number;
  embedding_model: string;
  schema_version: string;
}
