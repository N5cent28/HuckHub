import type { MergedCareerProfile, TeamEntry } from "./types";

/** Collapse whitespace and normalize comma spacing: "Madison , Wisconsin" → "Madison, Wisconsin". */
export function normalizeLocationString(loc: string): string {
  return loc.trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
}

const STATE_ALIASES: Record<string, string[]> = {
  alabama: ["al", "alabama"],
  alaska: ["ak", "alaska"],
  arizona: ["az", "arizona"],
  arkansas: ["ar", "arkansas"],
  california: ["ca", "california"],
  colorado: ["co", "colorado"],
  connecticut: ["ct", "connecticut"],
  delaware: ["de", "delaware"],
  florida: ["fl", "florida"],
  georgia: ["ga", "georgia"],
  hawaii: ["hi", "hawaii"],
  idaho: ["id", "idaho"],
  illinois: ["il", "illinois"],
  indiana: ["in", "indiana"],
  iowa: ["ia", "iowa"],
  kansas: ["ks", "kansas"],
  kentucky: ["ky", "kentucky"],
  louisiana: ["la", "louisiana"],
  maine: ["me", "maine"],
  maryland: ["md", "maryland"],
  massachusetts: ["ma", "massachusetts"],
  michigan: ["mi", "michigan"],
  minnesota: ["mn", "minnesota"],
  mississippi: ["ms", "mississippi"],
  missouri: ["mo", "missouri"],
  montana: ["mt", "montana"],
  nebraska: ["ne", "nebraska"],
  nevada: ["nv", "nevada"],
  "new hampshire": ["nh", "new hampshire"],
  "new jersey": ["nj", "new jersey"],
  "new mexico": ["nm", "new mexico"],
  "new york": ["ny", "new york"],
  "north carolina": ["nc", "north carolina"],
  "north dakota": ["nd", "north dakota"],
  ohio: ["oh", "ohio"],
  oklahoma: ["ok", "oklahoma"],
  oregon: ["or", "oregon"],
  pennsylvania: ["pa", "pennsylvania"],
  "rhode island": ["ri", "rhode island"],
  "south carolina": ["sc", "south carolina"],
  "south dakota": ["sd", "south dakota"],
  tennessee: ["tn", "tennessee"],
  texas: ["tx", "texas"],
  utah: ["ut", "utah"],
  vermont: ["vt", "vermont"],
  virginia: ["va", "virginia"],
  washington: ["wa", "washington"],
  "west virginia": ["wv", "west virginia"],
  wisconsin: ["wi", "wisconsin"],
  wyoming: ["wy", "wyoming"],
  "district of columbia": ["dc", "district of columbia"],
};

function stateTokens(part: string): string[] {
  const key = part.toLowerCase().trim();
  if (!key) return [];
  for (const tokens of Object.values(STATE_ALIASES)) {
    if (tokens.includes(key)) return tokens;
  }
  return [key];
}

function parseCityState(loc: string): { city: string; stateTokens: string[] } | null {
  const normalized = normalizeLocationString(loc);
  const comma = normalized.indexOf(",");
  if (comma === -1) {
    return { city: normalized.toLowerCase(), stateTokens: [] };
  }
  const city = normalized.slice(0, comma).trim().toLowerCase();
  const statePart = normalized.slice(comma + 1).trim();
  return { city, stateTokens: stateTokens(statePart) };
}

function cityStateMatches(a: string, b: string): boolean {
  const pa = parseCityState(a);
  const pb = parseCityState(b);
  if (!pa || !pb) return false;
  if (pa.city !== pb.city) return false;
  if (pa.stateTokens.length === 0 || pb.stateTokens.length === 0) return true;
  return pa.stateTokens.some((t) => pb.stateTokens.includes(t));
}

function collectProfileLocations(profile: MergedCareerProfile): string[] {
  const locs = (profile.known_locations || []).map(normalizeLocationString).filter(Boolean);
  for (const team of [...(profile.teams_played || []), ...(profile.teams_coached || [])]) {
    if (team.team_location) {
      locs.push(normalizeLocationString(team.team_location));
    }
  }
  return locs;
}

/** True when a profile's locations match the user's location filter. */
export function locationMatchesProfile(profile: MergedCareerProfile, filter: string): boolean {
  const trimmed = filter.trim();
  if (!trimmed) return true;

  const filterNorm = normalizeLocationString(trimmed).toLowerCase();
  const profileLocs = collectProfileLocations(profile);

  if (profileLocs.some((l) => l.toLowerCase().includes(filterNorm))) {
    return true;
  }

  if (filterNorm.includes(",")) {
    return profileLocs.some((l) => cityStateMatches(l, trimmed));
  }

  return profileLocs.some((l) => parseCityState(l)?.city === filterNorm);
}

export function normalizeLocationList(locs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const loc of locs) {
    const n = normalizeLocationString(loc);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

export function distinctLocationsFromProfiles(
  profiles: { known_locations?: string[]; teams_played?: TeamEntry[]; teams_coached?: TeamEntry[] }[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const profile of profiles) {
    const locs = [
      ...(profile.known_locations || []),
      ...(profile.teams_played || []).map((t) => t.team_location).filter(Boolean) as string[],
      ...(profile.teams_coached || []).map((t) => t.team_location).filter(Boolean) as string[],
    ];
    for (const loc of locs) {
      const n = normalizeLocationString(loc);
      if (!n) continue;
      const key = n.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}
