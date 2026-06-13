/** Normalize MUFA "Last, First" and compare names for claim verification. */

export function normalizeDisplayName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",").map((s) => s.trim());
    if (first && last) return `${first} ${last}`;
  }
  return trimmed.replace(/\s+/g, " ");
}

export function normalizeNameForMatch(name: string): string {
  return normalizeDisplayName(name).toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function namesMatch(a: string, b: string): boolean {
  const na = normalizeNameForMatch(a);
  const nb = normalizeNameForMatch(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Allow first + last token overlap for minor formatting differences
  const tokensA = new Set(na.split(" "));
  const tokensB = new Set(nb.split(" "));
  const shared = [...tokensA].filter((t) => tokensB.has(t) && t.length > 1);
  return shared.length >= 2;
}

export function confidenceLabel(
  score: number | null,
  isUserEdited: boolean
): "high" | "medium" | "low" | "member" {
  if (isUserEdited) return "member";
  if (score == null) return "low";
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}
