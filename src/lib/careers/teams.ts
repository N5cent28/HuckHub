import type { MergedCareerProfile, TeamEntry } from "./types";

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

  const div = team.division_name?.trim();
  const level = team.competition_level?.toLowerCase();

  // MUFA rows have competition_level "league", so check before the generic league rule.
  if (div === "MUFA League") return "MUFA";
  if (isLeagueTeam(team)) return "League";
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

/** Split a published team history (role on each row) into played vs coached. */
export function splitTeamHistory(teams: TeamEntry[]): { teams_played: TeamEntry[]; teams_coached: TeamEntry[] } {
  return {
    teams_played: teams.filter((t) => t.role !== "coach"),
    teams_coached: teams.filter((t) => t.role === "coach"),
  };
}

export type DivisionPair = [competition_level: string | null, division_name: string | null];

/** Filter-dropdown labels from the distinct (competition_level, division_name) pairs in Postgres. */
export function divisionLabelsFromPairs(pairs: DivisionPair[]): string[] {
  const labels = new Set<string>(DIVISION_FILTER_ORDER);
  for (const [competition_level, division_name] of pairs) {
    const label = formatDivisionFilterLabel({ team_name: "", year: 0, competition_level, division_name, team_location: null });
    if (label) labels.add(label);
  }
  return sortDivisionLabels([...labels]);
}

/** Pairs that map to a filter label, as the parallel arrays career_search expects. */
export function resolveDivisionFilter(
  label: string,
  pairs: DivisionPair[]
): { levels: string[]; names: string[] } {
  const levels: string[] = [];
  const names: string[] = [];
  for (const [competition_level, division_name] of pairs) {
    const l = formatDivisionFilterLabel({ team_name: "", year: 0, competition_level, division_name, team_location: null });
    if (l === label.trim()) {
      levels.push(competition_level ?? "");
      names.push(division_name ?? "");
    }
  }
  return { levels, names };
}
