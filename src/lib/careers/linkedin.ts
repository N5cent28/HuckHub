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

/** Short label for a LinkedIn URL, e.g. linkedin.com/in/liu-al → liu-al */
export function linkedInCandidateLabel(url: string, index: number): string {
  const slug = url.replace(/\/$/, "").split("/").pop();
  if (slug && slug !== "in") return slug;
  return `Candidate ${index + 1}`;
}
