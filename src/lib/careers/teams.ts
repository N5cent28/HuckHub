import type { MergedCareerProfile, RawProfileTeam, ScrapedCareerProfile, TeamEntry, TeamRole } from "./types";

/** Preferred order for the careers division filter dropdown. */
export const DIVISION_FILTER_ORDER = [
  "UFA",
  "PUL",
  "MUFA",
  "Men's Club",
  "Mixed Club",
  "Club Women",
  "College · Open",
  "College · Women",
  "College · Mixed",
  "League",
] as const;

const YOUTH_DIVISION_RE = /youth/i;

function isYouthTeam(team: TeamEntry): boolean {
  const level = (team.competition_level || "").toLowerCase();
  const div = team.division_name || "";
  return level === "youth club" || YOUTH_DIVISION_RE.test(div);
}

function isLeagueTeam(team: TeamEntry): boolean {
  const level = (team.competition_level || "").toLowerCase();
  const div = team.division_name || "";
  return level === "league" || div === "League Boys" || div === "League Girls";
}

export function sortDivisionLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const ia = DIVISION_FILTER_ORDER.indexOf(a as (typeof DIVISION_FILTER_ORDER)[number]);
    const ib = DIVISION_FILTER_ORDER.indexOf(b as (typeof DIVISION_FILTER_ORDER)[number]);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

/** Human-readable division on profile team tables (includes youth & league gender labels). */
export function formatTeamDivision(team: TeamEntry): string | null {
  const div = team.division_name?.trim();
  const level = team.competition_level?.toLowerCase();

  if (div === "MUFA League") return "MUFA";
  if (div === "Club Open") return "Men's Club";
  if (div === "Club Mixed") return "Mixed Club";
  if (div === "Club Women") return "Club Women";
  if (div === "UFA" || div?.includes("UFA")) return "UFA";
  if (div === "PUL" || div?.includes("PUL")) return "PUL";

  if (div?.startsWith("College")) return div.replace("College ", "College · ");
  if (level === "college") return div || "College";
  if (level === "club" && div) return div.replace(/^Club /, "Club · ");
  if (level === "club") return "Club";
  if (level === "league" && div) return div;
  if (level === "youth club" && div) return div;

  return div || null;
}

/** Division label used by the careers search filter (no youth; league genders combined). */
export function formatDivisionFilterLabel(team: TeamEntry): string | null {
  if (isYouthTeam(team)) return null;
  if (isLeagueTeam(team)) return "League";

  const div = team.division_name?.trim();
  const level = team.competition_level?.toLowerCase();

  if (div === "MUFA League") return "MUFA";
  if (div === "Club Open") return "Men's Club";
  if (div === "Club Mixed") return "Mixed Club";
  if (div === "Club Women") return "Club Women";
  if (div === "UFA" || div?.includes("UFA")) return "UFA";
  if (div === "PUL" || div?.includes("PUL")) return "PUL";

  if (div?.startsWith("College")) return div.replace("College ", "College · ");
  if (level === "college") return div || "College";
  if (level === "club" && div) return div.replace(/^Club /, "Club · ");
  if (level === "club") return "Club";

  return div || null;
}

export function profileMatchesDivision(
  profile: Pick<MergedCareerProfile, "teams_played">,
  division: string
): boolean {
  const target = division.trim();
  if (!target) return true;
  return (profile.teams_played || []).some((t) => formatDivisionFilterLabel(t) === target);
}

function teamKey(team_name: string, year: number): string {
  return `${team_name}\0${year}`;
}

function enrichRawTeam(
  raw: RawProfileTeam,
  role: TeamRole,
  enrichment: Map<string, TeamEntry>
): TeamEntry {
  const extra = enrichment.get(teamKey(raw.team_name, raw.year));
  const loc = raw.location ?? raw.team_location ?? extra?.team_location ?? null;
  return {
    team_name: raw.team_name,
    year: raw.year,
    competition_level: raw.competition_level ?? extra?.competition_level ?? null,
    division_name: raw.division_name ?? extra?.division_name ?? null,
    team_location: loc,
    role,
  };
}

function sortTeams(entries: TeamEntry[]): TeamEntry[] {
  return [...entries].sort((a, b) => b.year - a.year || a.team_name.localeCompare(b.team_name));
}

function mergeTeamEntry(existing: TeamEntry | undefined, incoming: TeamEntry): TeamEntry {
  if (!existing) return incoming;
  const role =
    existing.role === "coach" || incoming.role === "coach"
      ? ("coach" as const)
      : (incoming.role ?? existing.role ?? "player");
  return {
    team_name: incoming.team_name,
    year: incoming.year,
    competition_level: incoming.competition_level ?? existing.competition_level,
    division_name: incoming.division_name ?? existing.division_name,
    team_location: incoming.team_location ?? existing.team_location,
    role,
  };
}

function collectProfileTeams(
  profile: Pick<ScrapedCareerProfile, "playing_teams" | "coached_teams">,
  legacyTeams: TeamEntry[]
): TeamEntry[] {
  const enrichment = new Map<string, TeamEntry>();
  for (const t of legacyTeams) {
    enrichment.set(teamKey(t.team_name, t.year), t);
  }

  const merged = new Map<string, TeamEntry>();

  const add = (entry: TeamEntry) => {
    const key = teamKey(entry.team_name, entry.year);
    merged.set(key, mergeTeamEntry(merged.get(key), entry));
  };

  for (const t of legacyTeams) {
    add({
      ...t,
      role: t.role === "coach" ? "coach" : "player",
    });
  }

  for (const raw of profile.coached_teams || []) {
    add(enrichRawTeam(raw, "coach", enrichment));
  }

  for (const raw of profile.playing_teams || []) {
    const key = teamKey(raw.team_name, raw.year);
    const existing = merged.get(key);
    if (existing?.role === "coach") continue;
    add(enrichRawTeam(raw, existing?.role ?? "player", enrichment));
  }

  if (merged.size > 0) {
    return [...merged.values()];
  }

  return legacyTeams.map((t) => ({
    ...t,
    role: t.role === "coach" ? "coach" : "player",
  }));
}

/** Split roster rows into played vs coached; falls back to legacy combined teams as played. */
export function buildProfileTeamHistory(
  profile: Pick<ScrapedCareerProfile, "playing_teams" | "coached_teams">,
  legacyTeams: TeamEntry[] = []
): { teams_played: TeamEntry[]; teams_coached: TeamEntry[] } {
  const all = collectProfileTeams(profile, legacyTeams);
  const teams_coached = sortTeams(all.filter((t) => t.role === "coach"));
  const coachedKeys = new Set(teams_coached.map((t) => teamKey(t.team_name, t.year)));
  const teams_played = sortTeams(
    all.filter(
      (t) => t.role !== "coach" && !coachedKeys.has(teamKey(t.team_name, t.year))
    )
  );
  return { teams_played, teams_coached };
}

export function distinctDivisionLabelsFromTeams(teamsByUid: Iterable<TeamEntry[]>): string[] {
  const labels = new Set<string>();
  for (const teams of teamsByUid) {
    for (const team of teams) {
      const label = formatDivisionFilterLabel(team);
      if (label) labels.add(label);
    }
  }
  for (const label of DIVISION_FILTER_ORDER) {
    labels.add(label);
  }
  return sortDivisionLabels([...labels]);
}
