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

/**
 * Name relevance tiers (mirrored in SQL career_search):
 *   5   exact normalized name
 *   3   query starts at a word boundary ("nico r" -> "nico ranabhat", or a surname)
 *   2   every query word starts a name word, in order ("noah nicol" -> "noah ryan nicol")
 *   1.5 the first query word is a whole name word ("nico r" -> "nico nijhawan")
 *   0.6 looser: query or each query word appears anywhere in the name
 */
export function nameMatchScore(fullName: string, query: string): number {
  const name = normalizeNameForMatch(fullName);
  const q = normalizeNameForMatch(query);
  if (!q || !name) return 0;
  if (name === q) return 5;
  if ((" " + name).includes(" " + q)) return 3;
  const tokens = q.split(" ").filter(Boolean);
  const inOrder = new RegExp("(^| )" + tokens.join("[^ ]*( [^ ]+)* "));
  if (inOrder.test(name)) return 2;
  if (tokens.length > 1 && ` ${name} `.includes(` ${tokens[0]} `)) return 1.5;
  if (name.includes(q) || tokens.every((t) => name.includes(t))) return 0.6;
  return 0;
}

/** Shown (blurred) in place of a real name for signed-out visitors. */
export const HIDDEN_NAME = "Ultimate Player";
const NAME_TOKEN_MASK = "[name]";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove a person's name from free text for signed-out responses. Replaces the
 * full name (either order) and then each name word (2+ letters) as a whole word.
 * The blur in the UI is cosmetic; this is what actually keeps names private.
 */
export function redactName(text: string | null, fullName: string): string | null {
  if (!text) return text;
  const display = normalizeDisplayName(fullName);
  const words = display
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter((w) => w.length >= 2);
  let out = text;
  const variants = [display, fullName.trim(), words.slice().reverse().join(" ")].filter(
    (v) => v.length >= 2
  );
  for (const v of variants.sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(escapeRegExp(v), "gi"), NAME_TOKEN_MASK);
  }
  for (const w of words) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(w)}(?![\\p{L}\\p{N}])`, "giu"), NAME_TOKEN_MASK);
  }
  return out;
}

/** Leading "[name]" in a redacted summary, so the UI can blur it like a real name. */
export function redactedSummaryPrefix(summary: string | null): string | null {
  return summary?.startsWith(NAME_TOKEN_MASK) ? NAME_TOKEN_MASK : null;
}
