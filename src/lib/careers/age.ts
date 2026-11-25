/**
 * Under-18 gate for HuckHub Careers.
 *
 * ExpertScraper's publish step stores `adult_from_year` (the first calendar
 * year a player is estimated to be 18+) from the age-estimate floor. The gate
 * deliberately ignores age_confidence: every current estimate is "low", so a
 * confidence-based gate never excluded anyone.
 */

export interface AgeGateFields {
  adult_from_year?: number | null;
  is_user_edited?: boolean;
  is_admin_edited?: boolean;
}

export function careersAsOfYear(asOf = new Date()): number {
  return asOf.getFullYear();
}

/** True when a scraped profile should be hidden because the player may be a minor. */
export function isAgeGated(profile: AgeGateFields, asOfYear = careersAsOfYear()): boolean {
  if (profile.is_user_edited || profile.is_admin_edited) return false;
  return profile.adult_from_year != null && profile.adult_from_year > asOfYear;
}

export function isEligibleForCareersSearch(
  profile: AgeGateFields,
  asOfYear = careersAsOfYear()
): boolean {
  return !isAgeGated(profile, asOfYear);
}
