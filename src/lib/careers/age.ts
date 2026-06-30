/** Age fields in profiles.json are anchored to this calendar year (ExpertScraper export). */
export const AGE_DATA_REFERENCE_YEAR = 2026;

export type AgeConfidence = "high" | "medium" | "low" | "none" | string | null;

export interface AgeEstimateFields {
  age_point_estimate_2026?: number | null;
  age_min_2026?: number | null;
  age_max_2026?: number | null;
  age_confidence?: AgeConfidence;
  age_source?: string | null;
  is_user_edited?: boolean;
  is_admin_edited?: boolean;
}

export function careersAsOfYear(asOf = new Date()): number {
  return asOf.getFullYear();
}

export function projectedAgeMin(profile: AgeEstimateFields, asOfYear = careersAsOfYear()): number | null {
  if (profile.age_min_2026 == null) return null;
  return profile.age_min_2026 + (asOfYear - AGE_DATA_REFERENCE_YEAR);
}

export function projectedAgeMax(profile: AgeEstimateFields, asOfYear = careersAsOfYear()): number | null {
  if (profile.age_max_2026 == null) return null;
  return profile.age_max_2026 + (asOfYear - AGE_DATA_REFERENCE_YEAR);
}

/** True when age data is strong enough to treat a player as a minor for careers search. */
export function isConfidentlyUnder18(
  profile: AgeEstimateFields,
  asOfYear = careersAsOfYear()
): boolean {
  if (profile.is_user_edited || profile.is_admin_edited) return false;

  const conf = (profile.age_confidence || "none").toLowerCase();
  if (conf !== "high" && conf !== "medium") return false;

  const minAge = projectedAgeMin(profile, asOfYear);
  if (minAge == null) return false;

  return minAge < 18;
}

export function isEligibleForCareersSearch(
  profile: AgeEstimateFields,
  asOfYear = careersAsOfYear()
): boolean {
  return !isConfidentlyUnder18(profile, asOfYear);
}
