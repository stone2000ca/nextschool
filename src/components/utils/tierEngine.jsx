import { buildPriorityChecks } from '@/components/schools/SchoolCard';

export const IMPORTANT_FIELDS = ['name', 'city', 'curriculum', 'gender_policy', 'day_tuition', 'tuition', 'lowest_grade', 'highest_grade', 'boarding_available', 'description', 'header_photo_url', 'logo_url'];

// E49-S2A: Distance band helper for diversify()
function distanceBand(km) {
  if (km == null) return 'unknown';
  if (km <= 10) return '0-10';
  if (km <= 25) return '10-25';
  if (km <= 50) return '25-50';
  return '50+';
}

// E49-S2A: Curriculum key for diversify()
function curriculumKey(school) {
  if (Array.isArray(school.curriculum) && school.curriculum.length > 0) {
    return school.curriculum.map(c => c.toLowerCase()).sort().join(',');
  }
  return 'unknown';
}

// E49-S2A: Avoid too many consecutive schools with same curriculum + distance band
// at the head of each tier. If 2+ consecutive share the same combo, swap with the
// next different one found later in the list.
export function diversify(list) {
  if (!list || list.length <= 2) return list;
  const result = [...list];

  function comboKey(school) {
    return curriculumKey(school) + '|' + distanceBand(school.distance_km);
  }

  for (let i = 1; i < result.length; i++) {
    if (comboKey(result[i]) === comboKey(result[i - 1])) {
      // Find the next school with a different combo
      let swapIdx = -1;
      for (let j = i + 1; j < result.length; j++) {
        if (comboKey(result[j]) !== comboKey(result[i])) {
          swapIdx = j;
          break;
        }
      }
      if (swapIdx !== -1) {
        [result[i], result[swapIdx]] = [result[swapIdx], result[i]];
      }
    }
  }
  return result;
}

// E49-S2A: Detect thin-profile scenario where few preferences are known
// and score differentiation is low, leading to false-precision rankings.
function detectThinProfile(scored, effectiveProfile) {
  if (!effectiveProfile || scored.length === 0) return false;

  // avgMatchOrMiss: average number of match/mismatch statuses per school
  let totalMatchOrMiss = 0;
  scored.forEach(s => {
    const checks = buildPriorityChecks(s.school, effectiveProfile);
    const decisive = checks.filter(r => r.status === 'match' || r.status === 'mismatch');
    totalMatchOrMiss += decisive.length;
  });
  const avgMatchOrMiss = totalMatchOrMiss / scored.length;

  // scoreSpread: max - min score among passing schools
  const scores = scored.map(s => s.score);
  const scoreSpread = Math.max(...scores) - Math.min(...scores);

  return avgMatchOrMiss <= 2 && scoreSpread <= 1;
}

export function buildTiers(schools, familyProfile, sortMode = 'bestFit', priorityOverrides = {}) {
  if (!schools || schools.length === 0) return null;

  // Apply T-RES-006: filter out musthave mismatches, weight dontcares out
  const effectiveProfile = familyProfile ? { ...familyProfile } : null;

  function applySort(arr) {
    if (sortMode === 'closest') {
      return [...arr].sort((a, b) => (a.school.distance_km ?? 99999) - (b.school.distance_km ?? 99999));
    }
    if (sortMode === 'affordable') {
      const tval = s => s.school.day_tuition ?? s.school.tuition ?? 99999;
      return [...arr].sort((a, b) => tval(a) - tval(b));
    }
    if (sortMode === 'newest') {
      return [...arr].sort(() => Math.random() - 0.5);
    }
    // bestFit (default)
    return [...arr].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.completeness !== a.completeness) return b.completeness - a.completeness;
      return a.proximity - b.proximity;
    });
  }

  const scored = schools.map(s => {
    const checks = buildPriorityChecks(s, effectiveProfile);
    // Apply overrides: musthave mismatch → penalize heavily; dontcare → skip from score
    let score = 0;
    let mustHaveFail = false;
    checks.forEach(row => {
      const flex = priorityOverrides[row.id] || 'nicetohave';
      if (flex === 'dontcare') return;
      if (row.status === 'match') score += (flex === 'musthave' ? 2 : 1);
      if (row.status === 'mismatch' && flex === 'musthave') mustHaveFail = true;
    });
    const completeness = IMPORTANT_FIELDS.filter(f => s[f] != null && s[f] !== '').length;
    const proximity = s.distance_km != null ? s.distance_km : 99999;
    return { school: s, score, completeness, proximity, mustHaveFail };
  });

  // Filter out must-have failures
  const passing = scored.filter(s => !s.mustHaveFail);
  const sorted = applySort(passing);

  // E49-S2A: Detect thin-profile mode
  const isThinProfile = detectThinProfile(passing, effectiveProfile);
  const mode = isThinProfile ? 'thinProfile' : 'normal';

  // Tier sizes differ based on mode
  let TIER1_SIZE, TIER2_SIZE;
  if (isThinProfile) {
    // Thin-profile: wider tiers to present curated breadth
    TIER1_SIZE = Math.min(6, Math.max(3, Math.ceil(sorted.length * 0.2)));
    TIER2_SIZE = Math.min(10, Math.max(4, Math.ceil(sorted.length * 0.3)));
  } else {
    // Normal mode: S1B tier sizes preserved
    TIER1_SIZE = Math.min(6, Math.max(3, Math.ceil(sorted.length * 0.25)));
    TIER2_SIZE = Math.min(8, Math.max(4, Math.ceil(sorted.length * 0.25)));
  }

  const tier1Schools = sorted.slice(0, TIER1_SIZE).map(s => s.school);
  const remaining = sorted.slice(TIER1_SIZE);

  // For non-bestFit sorts, preserve sort order in tier2; for bestFit shuffle tier2
  const tier2pool = sortMode === 'bestFit' ? [...remaining].sort(() => Math.random() - 0.5) : remaining;
  const tier2Schools = tier2pool.slice(0, TIER2_SIZE).map(s => s.school);
  const tier2Ids = new Set(tier2Schools.map(s => s.id));

  const seeAll = remaining
    .filter(s => !tier2Ids.has(s.school.id))
    .map(s => s.school);

  // E49-S2A: In thin-profile mode, diversify tier heads to avoid
  // consecutive schools with same curriculum + distance band
  const topMatches = isThinProfile ? diversify(tier1Schools) : tier1Schools;
  const alsoWorthExploring = isThinProfile ? diversify(tier2Schools) : tier2Schools;

  return { topMatches, alsoWorthExploring, seeAll, mode };
}
