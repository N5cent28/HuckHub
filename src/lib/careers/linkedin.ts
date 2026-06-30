const MAX_LINKEDIN_CANDIDATES = 2;

export function normalizeLinkedInUrls(profile: {
  linkedin_url?: string | null;
  linkedin_urls?: string[] | null;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of profile.linkedin_urls || []) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_LINKEDIN_CANDIDATES) return out;
  }

  const primary = profile.linkedin_url?.trim();
  if (primary && !seen.has(primary)) {
    out.unshift(primary);
    if (out.length > MAX_LINKEDIN_CANDIDATES) return out.slice(0, MAX_LINKEDIN_CANDIDATES);
  }

  return out;
}

/** Button label for a LinkedIn profile link on the careers profile page. */
export function linkedInButtonLabel(index: number, candidateCount: number): string {
  if (candidateCount <= 1) return "LinkedIn";
  return `Candidate ${index + 1}`;
}
