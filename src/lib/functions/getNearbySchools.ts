import { School } from '@/lib/entities-server'

const TIMEOUT_MS = 25000;

// --- Inlined filter utilities (aligned with searchSchools.ts) ---

const religiousDealbreakTerms = [
  'religious', 'religion', 'secular only', 'non-religious', 'faith-based', 'faith based',
  'catholic', 'christian', 'church', 'denominational', 'secular', 'islamic', 'jewish'
];

const nonReligiousAffiliations = new Set(['none', 'secular', 'non-denominational', 'n/a', '']);

const religiousKeywords = [
  'christian', 'catholic', 'islamic', 'jewish', 'lutheran', 'baptist',
  'adventist', 'anglican', 'saint', 'st.', 'holy', 'sacred', 'blessed',
  'bishop', 'trinity', 'yeshiva', 'hebrew', 'our lady', 'gospel', 'covenant', 'faith'
];

function applyReligiousFilter(school: any, dealbreakers: string[]): boolean {
  const hasReligiousDealbreaker = Array.isArray(dealbreakers) && dealbreakers.some(d =>
    typeof d === 'string' && religiousDealbreakTerms.some(term => d.toLowerCase().includes(term))
  );
  if (!hasReligiousDealbreaker) return true;

  const affiliationNorm = (school.faith_based || '').toLowerCase().trim();
  if (school.faith_based && !nonReligiousAffiliations.has(affiliationNorm)) {
    console.log(`[RELIGIOUS FILTER] Excluded ${school.name}: affiliation (${school.faith_based})`);
    return false;
  }
  const nameLower = school.name?.toLowerCase() || '';
  if (religiousKeywords.some(kw => nameLower.includes(kw))) {
    console.log(`[RELIGIOUS FILTER] Excluded ${school.name}: name keyword`);
    return false;
  }
  return true;
}

function applyGenderFilter(
  school: any,
  familyGender?: string,
  schoolGenderExclusions?: string[],
  schoolGenderPreference?: string
): boolean {
  const gp = school.gender_policy || null;
  if (gp === null) return true;

  const exclusions = schoolGenderExclusions || [];
  if (exclusions.length > 0) {
    const gpLower = gp.toLowerCase();
    const excluded = exclusions.some((ex: string) => {
      const exL = ex.toLowerCase();
      if (exL === 'all-girls') return gpLower === 'all-girls';
      if (exL === 'all-boys') return gpLower === 'all-boys';
      if (exL === 'co-ed') return gpLower === 'co-ed' || gpLower === 'co-ed with single-gender classes';
      return false;
    });
    if (excluded) return false;
  }

  if (schoolGenderPreference) {
    const gpLower = gp.toLowerCase();
    const prefLower = schoolGenderPreference.toLowerCase();
    let matches = false;
    if (prefLower === 'all-girls') matches = gpLower === 'all-girls';
    else if (prefLower === 'all-boys') matches = gpLower === 'all-boys';
    else if (prefLower === 'co-ed') matches = gpLower === 'co-ed' || gpLower === 'co-ed with single-gender classes';
    if (!matches) return false;
  }

  if (!schoolGenderPreference && familyGender) {
    if (familyGender === 'male' && gp === 'All-Girls') return false;
    if (familyGender === 'female' && gp === 'All-Boys') return false;
  }

  return true;
}

function calculateDistanceHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export async function getNearbySchools(params: {
  lat: number
  lng: number
  excludeIds?: string[]
  gradeMin?: number
  maxTuition?: number | string
  dealbreakers?: string[]
  familyGender?: string
  schoolGenderExclusions?: string[]
  schoolGenderPreference?: string
  page?: number
  pageSize?: number
}) {
  const {
    lat,
    lng,
    excludeIds = [],
    gradeMin,
    maxTuition,
    dealbreakers = [],
    familyGender,
    schoolGenderExclusions = [],
    schoolGenderPreference,
    page = 1,
    pageSize = 20,
  } = params;

  if (!lat || !lng) {
    throw Object.assign(new Error('lat and lng are required'), { statusCode: 400 });
  }

  // Use timeout wrapper
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS)
  );

  const searchPromise = (async () => {
    // 1. Fetch all active schools
    let allSchools: any[] = [];
    try {
      allSchools = await School.filter({}, '-created_date', 1000);
    } catch (err: any) {
      console.error('[getNearbySchools] School fetch failed:', err.message);
      return { schools: [], hasMore: false, totalRemaining: 0 };
    }
    let schools = allSchools.filter((s: any) => s.status === 'active');

    // 2. Exclude already-displayed/shortlisted IDs
    const excludeSet = new Set(excludeIds);
    schools = schools.filter((s: any) => !excludeSet.has(s.id));

    // 3. Grade filter: exclude if >2 grades outside range
    if (gradeMin !== undefined && gradeMin !== null) {
      const grade = typeof gradeMin === 'number' ? gradeMin : parseInt(String(gradeMin));
      if (!isNaN(grade)) {
        schools = schools.filter((school: any) => {
          const sLow = parseInt(school.lowest_grade);
          const sHigh = parseInt(school.highest_grade);
          if (isNaN(sLow) || isNaN(sHigh)) return true;
          const outside = grade < sLow ? sLow - grade : grade > sHigh ? grade - sHigh : 0;
          return outside <= 2;
        });
      }
    }

    // 4. Budget filter at 1.5x tolerance
    if (maxTuition) {
      const budget = typeof maxTuition === 'number' ? maxTuition : parseInt(String(maxTuition));
      if (!isNaN(budget)) {
        const cap = budget * 1.5;
        schools = schools.filter((school: any) => {
          const tuition = school.tuition || school.day_tuition || school.tuition_min;
          if (!tuition) return true;
          return tuition <= cap;
        });
      }
    }

    // 5. Religious filter
    schools = schools.filter((s: any) => applyReligiousFilter(s, dealbreakers));

    // 6. Gender filter
    schools = schools.filter((s: any) =>
      applyGenderFilter(s, familyGender, schoolGenderExclusions, schoolGenderPreference)
    );

    // 7. Calculate Haversine distance (only for schools with coords)
    schools = schools.map((school: any) => {
      if (school.lat && school.lng) {
        return { ...school, distanceKm: calculateDistanceHaversine(lat, lng, school.lat, school.lng) };
      }
      return school;
    });

    // 8. Sort by distance ASC (schools without coords go last)
    schools.sort((a: any, b: any) => (a.distanceKm || Infinity) - (b.distanceKm || Infinity));

    const totalRemaining = schools.length;

    // 9. Paginate
    const offset = (page - 1) * pageSize;
    const pageSchools = schools.slice(offset, offset + pageSize);
    const hasMore = offset + pageSize < totalRemaining;

    // 10. Condense to same shape as searchSchools.ts
    const condensed = pageSchools.map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      city: s.city,
      province_state: s.province_state,
      grades_served: `${s.lowest_grade}-${s.highest_grade}`,
      lowest_grade: s.lowest_grade,
      highest_grade: s.highest_grade,
      tuition: s.tuition,
      day_tuition: s.day_tuition,
      currency: s.currency,
      curriculum: s.curriculum,
      gender_policy: s.gender_policy,
      region: s.region,
      specializations: s.specializations,
      distanceKm: s.distanceKm,
      school_type_label: s.school_type_label,
      header_photo_url: s.header_photo_url,
      logo_url: s.logo_url,
      arts_programs: s.arts_programs?.slice(0, 5) || [],
      sports_programs: s.sports_programs?.slice(0, 5) || [],
      avg_class_size: s.avg_class_size || null,
      school_tier: s.school_tier || null,
      claim_status: s.claim_status || null,
      relaxedMatch: false,
    }));

    console.log(`[getNearbySchools] page=${page} pageSize=${pageSize} totalRemaining=${totalRemaining} returned=${condensed.length}`);

    return { schools: condensed, hasMore, totalRemaining };
  })();

  return Promise.race([searchPromise, timeoutPromise]);
}
