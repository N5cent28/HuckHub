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
  isUserEdited: boolean,
  isAdminEdited = false
): "high" | "medium" | "low" | "member" | "admin" {
  if (isUserEdited) return "member";
  if (isAdminEdited) return "admin";
  if (score == null) return "low";
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/** Leading portion of a summary that contains the person's name (for public blur). */
export function summaryNamePrefix(fullName: string, summary: string | null): string | null {
  if (!summary?.trim() || !fullName?.trim()) return null;

  const variants = new Set<string>();
  const display = normalizeDisplayName(fullName);
  variants.add(display);
  variants.add(fullName.trim());
  if (fullName.includes(",")) {
    const [last, first] = fullName.split(",").map((s) => s.trim());
    if (first && last) variants.add(`${first} ${last}`);
  }

  const lower = summary.toLowerCase();
  for (const variant of variants) {
    if (variant.length > 1 && lower.startsWith(variant.toLowerCase())) {
      return summary.slice(0, variant.length);
    }
  }

  const tokens = display.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length >= 2) {
    const firstLast = `${tokens[0]} ${tokens[tokens.length - 1]}`;
    if (lower.startsWith(firstLast.toLowerCase())) {
      return summary.slice(0, firstLast.length);
    }
  }

  return null;
}
