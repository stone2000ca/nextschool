// E31-006: Canonical filter utilities shared across frontend hooks
// CANONICAL SOURCE: src/components/utils/filterUtils.js
// NOTE: functions/searchSchools.ts contains the server-side equivalents (inlined per Deno rules)

export const religiousDealbreakTerms = [
  'religious', 'religion', 'secular only', 'catholic', 'christian',
  'church', 'denominational', 'secular', 'islamic', 'jewish',
  'faith-based', 'faith based'
];

export const nonReligiousAffiliations = new Set(['none', 'secular', 'non-denominational', 'n/a', '']);

export const religiousKeywords = [
  'christian', 'catholic', 'islamic', 'jewish', 'lutheran', 'baptist',
  'adventist', 'anglican', 'saint', 'st.', 'holy', 'sacred', 'blessed',
  'bishop', 'trinity', 'yeshiva', 'hebrew', 'our lady', 'gospel',
  'covenant', 'faith'
];

/**
 * Haversine distance between two lat/lng points in kilometers.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns false if the school should be excluded due to a religious dealbreaker.
 * Aligned with server-side version in searchSchools.ts (S112-WC3).
 */
export function applyReligiousFilter(school, familyProfile, payload) {
  const dealbreakers = payload?.dealbreakers || familyProfile?.dealbreakers || [];
  const hasReligiousDealbreaker = Array.isArray(dealbreakers) && dealbreakers.some(d =>
    typeof d === 'string' && religiousDealbreakTerms.some(term => d.toLowerCase().includes(term))
  );
  if (hasReligiousDealbreaker) {
    const affiliationNorm = (school.faith_based || '').toLowerCase().trim();
    if (school.faith_based && !nonReligiousAffiliations.has(affiliationNorm)) {
      console.log(`[RELIGIOUS FILTER] Excluded ${school.name}: religious affiliation (${school.faith_based})`);
      return false;
    }
    const schoolNameLower = school.name?.toLowerCase() || '';
    if (religiousKeywords.some(keyword => schoolNameLower.includes(keyword))) {
      console.log(`[RELIGIOUS FILTER] Excluded ${school.name}: name contains religious keyword`);
      return false;
    }
  }
  return true;
}

/**
 * Returns false if the school should be excluded due to gender policy mismatch.
 * Aligned with server-side version in searchSchools.ts.
 */
export function applyGenderFilter(school, familyProfile) {
  const gp = school.gender_policy || null;
  if (gp === null) return true;
  const exclusions = familyProfile?.schoolGenderExclusions || [];
  if (Array.isArray(exclusions) && exclusions.length > 0) {
    const gpLower = gp.toLowerCase();
    const excluded = exclusions.some(ex => {
      const exL = ex.toLowerCase();
      if (exL === 'all-girls') return gpLower === 'all-girls';
      if (exL === 'all-boys') return gpLower === 'all-boys';
      if (exL === 'co-ed') return gpLower === 'co-ed' || gpLower === 'co-ed with single-gender classes';
      return false;
    });
    if (excluded) { console.log(`[GENDER] Excluded (exclusion) ${school.name}: gender_policy="${gp}"`); return false; }
  }
  const genderPref = familyProfile?.schoolGenderPreference || null;
  if (genderPref) {
    const gpLower = gp.toLowerCase();
    const prefLower = genderPref.toLowerCase();
    let matches = false;
    if (prefLower === 'all-girls') matches = gpLower === 'all-girls';
    else if (prefLower === 'all-boys') matches = gpLower === 'all-boys';
    else if (prefLower === 'co-ed') matches = gpLower === 'co-ed' || gpLower === 'co-ed with single-gender classes';
    if (!matches) { console.log(`[GENDER] Excluded (pref=${genderPref}) ${school.name}: gender_policy="${gp}"`); return false; }
  }
  if (!genderPref) {
    const childGender = familyProfile?.childGender || null;
    if (childGender === 'male' && gp === 'All-Girls') return false;
    if (childGender === 'female' && gp === 'All-Boys') return false;
  }
  return true;
}