// Function: searchSchools
// Purpose: Search and rank schools based on family profile and location filters
// Entities: School, SearchLog
// Last Modified: 2026-03-09
// S112-WC1: F7 P0 Fix - Religious & gender filters now enforced in relaxed fallback pass

import { School, SearchLog } from '@/lib/entities-server'
import { getAdminClient } from '@/lib/supabase/admin'

const TIMEOUT_MS = 25000;

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
}

// S112-WC3: F7 P0 Fix
function applyReligiousFilter(school: any, familyProfile: any, payload: any) {
  const dealbreakers = payload?.dealbreakers || familyProfile?.dealbreakers || [];
  const religiousDealbreakTerms = ['religious', 'religion', 'secular only', 'non-religious', 'faith-based', 'faith based', 'catholic', 'christian', 'church', 'denominational', 'secular', 'islamic', 'jewish'];
  const hasReligiousDealbreaker = Array.isArray(dealbreakers) && dealbreakers.some((d: string) =>
    typeof d === 'string' && religiousDealbreakTerms.some(term => d.toLowerCase().includes(term))
  );
  if (hasReligiousDealbreaker) {
    const schoolAffiliation = (school.faith_based || '').toLowerCase().trim().replace(/[\s-]+/g, ' ');
    const secularValues = ['', 'non-sectarian', 'nonsectarian', 'secular', 'none', 'n/a'];
    // Only exclude schools with a confirmed religious faithBased value
    if (school.faith_based && !secularValues.includes(schoolAffiliation)) {
      console.log(`[RELIGIOUS FILTER] Excluded ${school.name}: faith_based="${school.faith_based}"`);
      return false;
    }
  }
  return true;
}

function applyGenderFilter(school: any, familyProfile: any) {
  const gp = school.gender_policy || null;
  if (gp === null) return true;

  const rawGender = (familyProfile?.child_gender || familyProfile?.gender || '').toLowerCase().trim();
  const MALE_TERMS = ['male', 'boy', 'son', 'm', 'he', 'him'];
  const FEMALE_TERMS = ['female', 'girl', 'daughter', 'f', 'she', 'her'];
  const childGender = MALE_TERMS.includes(rawGender) ? 'male' : FEMALE_TERMS.includes(rawGender) ? 'female' : null;

  const gpLower = gp.toLowerCase();

  const isGirlsSchool = ['all-girls', 'girls only', 'girls', 'female only', 'all girls'].includes(gpLower);
  const isBoysSchool = ['all-boys', 'boys only', 'boys', 'male only', 'all boys'].includes(gpLower);

  if (childGender === 'male' && isGirlsSchool) {
    console.log(`[GENDER] Excluded (childGender=male) ${school.name}: genderPolicy="${gp}"`);
    return false;
  }
  if (childGender === 'female' && isBoysSchool) {
    console.log(`[GENDER] Excluded (childGender=female) ${school.name}: genderPolicy="${gp}"`);
    return false;
  }

  const exclusions = familyProfile?.school_gender_exclusions || [];
  if (Array.isArray(exclusions) && exclusions.length > 0) {
    const excluded = exclusions.some((ex: string) => {
      const exL = ex.toLowerCase();
      if (exL === 'all-girls') return gpLower === 'all-girls';
      if (exL === 'all-boys') return gpLower === 'all-boys';
      if (exL === 'co-ed') return gpLower === 'co-ed' || gpLower === 'co-ed with single-gender classes';
      return false;
    });
    if (excluded) { console.log(`[GENDER] Excluded (exclusion) ${school.name}: genderPolicy="${gp}"`); return false; }
  }

  const genderPref = familyProfile?.school_gender_preference || null;
  if (genderPref) {
    const prefLower = genderPref.toLowerCase();
    let matches = false;
    if (prefLower === 'all-girls') matches = gpLower === 'all-girls';
    else if (prefLower === 'all-boys') matches = gpLower === 'all-boys';
    else if (prefLower === 'co-ed') matches = gpLower === 'co-ed' || gpLower === 'co-ed with single-gender classes';
    if (!matches) { console.log(`[GENDER] Excluded (pref=${genderPref}) ${school.name}: genderPolicy="${gp}"`); return false; }
  }

  return true;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
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

export async function searchSchoolsLogic(payload: any) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Search request timeout')), TIMEOUT_MS)
  );

  const searchPromise = performSearch(payload);

  return await Promise.race([searchPromise, timeoutPromise]);
}

async function performSearch(payload: any) {
  console.log('[SEARCH RECEIVED] Complete payload:', JSON.stringify(payload, null, 2));

  const {
    region,
    country,
    city,
    provinceState,
    minGrade,
    maxGrade,
    minTuition,
    maxTuition,
    curriculum,
    specializations,
    schoolTypeLabel,
    userLat,
    userLng,
    resolvedLat,
    resolvedLng,
    maxDistanceKm,
    commuteToleranceMinutes,
    limit = 20,
    familyProfile = null,
    conversationId = null,
    userId = null,
    searchQuery = ''
  } = payload;

  // BUG-SEARCH-003: Validate minimum required search params exist
  const hasLocation = !!(region || city || provinceState || country || resolvedLat || resolvedLng);
  const hasGrade = minGrade !== null && minGrade !== undefined;

  if (!hasLocation && !hasGrade) {
    console.error('[SEARCH] Both location and grade are missing — cannot perform meaningful search');
    return {
      schools: [],
      total: 0,
      returned: 0,
      edgeCaseMessage: "I need your location and your child's grade to search for schools.",
      error: 'insufficient_data'
    };
  }

  const provinceAbbreviations: Record<string, string> = {
    'BC': 'British Columbia', 'AB': 'Alberta', 'SK': 'Saskatchewan', 'MB': 'Manitoba',
    'ON': 'Ontario', 'QC': 'Quebec', 'NB': 'New Brunswick', 'NS': 'Nova Scotia',
    'PE': 'Prince Edward Island', 'PEI': 'Prince Edward Island', 'NL': 'Newfoundland and Labrador',
    'YT': 'Yukon', 'NT': 'Northwest Territories', 'NU': 'Nunavut'
  };

  const stateAbbreviations: Record<string, string> = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
  };

  const neighbourhoodMap: Record<string, { lat: number; lng: number }> = {
    'midtown': { lat: 43.7, lng: -79.39 }, 'yorkville': { lat: 43.67, lng: -79.39 },
    'leaside': { lat: 43.71, lng: -79.36 }, 'forest hill': { lat: 43.69, lng: -79.41 },
    'rosedale': { lat: 43.68, lng: -79.38 }, 'the annex': { lat: 43.67, lng: -79.41 },
    'annex': { lat: 43.67, lng: -79.41 }, 'lawrence park': { lat: 43.73, lng: -79.40 },
    'north york': { lat: 43.77, lng: -79.41 }, 'scarborough': { lat: 43.77, lng: -79.26 },
    'etobicoke': { lat: 43.65, lng: -79.51 }, 'mississauga': { lat: 43.59, lng: -79.64 },
    'oakville': { lat: 43.45, lng: -79.68 }, 'richmond hill': { lat: 43.87, lng: -79.44 },
    'markham': { lat: 43.86, lng: -79.34 }
  };

  const regionAliases: Record<string, { cities?: string[]; provinces?: string[] }> = {
    'toronto': { cities: ['Toronto', 'North York', 'Scarborough', 'Etobicoke', 'East York', 'York', 'Markham', 'Mississauga', 'Richmond Hill', 'Vaughan', 'Oakville', 'Burlington'] },
    'gta': { cities: ['Toronto', 'Mississauga', 'Brampton', 'Oakville', 'Markham', 'Vaughan', 'Richmond Hill'] },
    'greater toronto area': { cities: ['Toronto', 'Mississauga', 'Brampton', 'Oakville', 'Markham', 'Vaughan', 'Richmond Hill'] },
    'lower mainland': { cities: ['Vancouver', 'Burnaby', 'Surrey', 'Richmond', 'Coquitlam'] },
    'metro vancouver': { cities: ['Vancouver', 'Burnaby', 'Surrey', 'Richmond', 'Coquitlam'] },
    'greater vancouver': { cities: ['Vancouver', 'Burnaby', 'Surrey', 'Richmond', 'Coquitlam'] },
    'montreal': { cities: ['Montreal', 'Laval', 'Longueuil'] },
    'greater montreal': { cities: ['Montreal', 'Laval', 'Longueuil'] },
    'vancouver': { cities: ['Vancouver', 'Burnaby', 'Surrey', 'Richmond', 'Coquitlam', 'North Vancouver', 'West Vancouver', 'New Westminster'], provinces: ['British Columbia', 'BC'] },
    'ottawa': { cities: ['Ottawa', 'Gatineau', 'Kanata', 'Orleans', 'Nepean', 'Barrhaven', 'Gloucester', 'Nottawa'], provinces: ['Ontario', 'ON'] },
    'calgary': { cities: ['Calgary', 'Airdrie', 'Cochrane', 'Okotoks'], provinces: ['Alberta', 'AB'] },
    'edmonton': { cities: ['Edmonton', 'Sherwood Park', 'St. Albert', 'Spruce Grove', 'Leduc'], provinces: ['Alberta', 'AB'] },
    'winnipeg': { cities: ['Winnipeg', 'Steinbach'], provinces: ['Manitoba', 'MB'] },
    'hamilton': { cities: ['Hamilton', 'Burlington', 'Dundas', 'Ancaster', 'Stoney Creek'], provinces: ['Ontario', 'ON'] }
  };

  let finalLat = resolvedLat || userLat;
  let finalLng = resolvedLng || userLng;
  if (!finalLat && !finalLng && city) {
    const neighbourhood = neighbourhoodMap[city.toLowerCase().trim()];
    if (neighbourhood) {
      finalLat = neighbourhood.lat;
      finalLng = neighbourhood.lng;
      console.log(`Resolved neighbourhood "${city}" to coordinates:`, neighbourhood);
    }
  }
  if (resolvedLat && resolvedLng) {
    console.log(`[T045] Using orchestrator-resolved coords: ${finalLat}, ${finalLng}`);
  }

  // ─── DB-level location filtering ─────────────────────────────────────
  // Push city/province filters to the database to avoid full table scan.
  let aliasedCities: string[] = [];
  let aliasedProvinces: string[] = [];
  const aliasKey = (region || city || '').toLowerCase().trim();
  const alias = regionAliases[aliasKey];
  if (alias) {
    if (alias.cities) aliasedCities = alias.cities;
    if (alias.provinces) aliasedProvinces = alias.provinces;
    console.log(`[S151] Region alias matched: "${aliasKey}" -> ${aliasedCities.length} cities`);
  }

  let locationFiltered: any[] = [];
  const searchStartTime = Date.now();

  try {
    const db = getAdminClient().from('schools') as any;
    let query = db.select('*').eq('status', 'active');

    // Determine if we can push a WHERE clause to the DB
    const canFilterByCity = aliasedCities.length > 0 || (city && aliasedCities.length === 0);
    const canFilterByProvince = aliasedProvinces.length > 0 || (provinceState && provinceState.trim());

    if (aliasedCities.length > 0) {
      // Region alias with known cities — use .in() for exact DB-level filtering
      query = query.in('city', aliasedCities);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      locationFiltered = data || [];
      console.log(`[DB FILTER] aliasedCities .in() → ${locationFiltered.length} schools`);
    } else if (city) {
      // Direct city match — try exact match at DB level via ilike
      const { data, error } = await query.ilike('city', city.trim()).limit(500);
      if (error) throw error;
      locationFiltered = data || [];
      console.log(`[DB FILTER] city ilike "${city}" → ${locationFiltered.length} schools`);

      // Fallback: partial match
      if (locationFiltered.length === 0) {
        const { data: partialData, error: partialError } = await db.select('*').eq('status', 'active').ilike('city', `%${city.trim()}%`).limit(500);
        if (!partialError && partialData) locationFiltered = partialData;
        console.log(`[DB FILTER] city partial ilike "%${city}%" → ${locationFiltered.length} schools`);
      }

      // Fallback: coordinate-based (requires loading broader set)
      if (locationFiltered.length === 0 && (resolvedLat || finalLat)) {
        console.log(`[CITY FILTER] Falling back to coordinate-based with 75km cap`);
        // Load schools from the broader province/country if available, else all active
        let geoQuery = db.select('*').eq('status', 'active');
        if (provinceState) {
          const psUpper = provinceState.toUpperCase().trim();
          const fullPN = provinceAbbreviations[psUpper] || stateAbbreviations[psUpper] || toTitleCase(provinceState.trim());
          geoQuery = geoQuery.or(`province_state.ilike.${fullPN},province_state.ilike.${psUpper}`);
        } else if (country) {
          geoQuery = geoQuery.eq('country', country);
        }
        const { data: geoData, error: geoError } = await geoQuery.limit(1000);
        if (!geoError && geoData) {
          locationFiltered = geoData.filter((s: any) => {
            if (!s.lat || !s.lng) return false;
            return calculateDistance(finalLat, finalLng, s.lat, s.lng) <= 75;
          });
        }
        console.log(`[DB FILTER] geo fallback → ${locationFiltered.length} schools`);
      }
    } else if (aliasedProvinces.length > 0) {
      // Province alias
      query = query.in('province_state', aliasedProvinces);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      locationFiltered = data || [];
      console.log(`[DB FILTER] aliasedProvinces .in() → ${locationFiltered.length} schools`);
    } else if (provinceState && provinceState.trim()) {
      const psUpper = provinceState.toUpperCase().trim();
      const fullProvinceName = provinceAbbreviations[psUpper] || stateAbbreviations[psUpper];
      const normalizedProvince = fullProvinceName || toTitleCase(provinceState.trim());
      const { data, error } = await query.or(`province_state.ilike.${normalizedProvince},province_state.ilike.${psUpper}`).limit(500);
      if (error) throw error;
      locationFiltered = data || [];
      console.log(`[DB FILTER] province "${normalizedProvince}" → ${locationFiltered.length} schools`);
    } else if (region) {
      // Try region field match
      const { data, error } = await query.eq('region', region).limit(500);
      if (error) throw error;
      locationFiltered = data || [];
      if (locationFiltered.length === 0 && finalLat && finalLng) {
        console.log(`[S151-WC3] region="${region}" matched 0 schools - falling back to geo radius`);
        const { data: allData, error: allError } = await db.select('*').eq('status', 'active').limit(1000);
        if (!allError && allData) {
          locationFiltered = allData.filter((s: any) => {
            if (!s.lat || !s.lng) return false;
            return calculateDistance(finalLat, finalLng, s.lat, s.lng) <= 75;
          });
        }
      }
      console.log(`[DB FILTER] region "${region}" → ${locationFiltered.length} schools`);
    } else if (country) {
      const { data, error } = await query.eq('country', country).limit(500);
      if (error) throw error;
      locationFiltered = data || [];
      console.log(`[DB FILTER] country "${country}" → ${locationFiltered.length} schools`);
    } else if (finalLat && finalLng) {
      // No location text — use geo radius
      const { data, error } = await db.select('*').eq('status', 'active').limit(1000);
      if (error) throw error;
      locationFiltered = (data || []).filter((s: any) => {
        if (!s.lat || !s.lng) return false;
        return calculateDistance(finalLat, finalLng, s.lat, s.lng) <= 100;
      });
      console.log(`[DB FILTER] geo-only 100km radius → ${locationFiltered.length} schools`);
    } else {
      // Last resort: load all active (same as before but shouldn't normally reach here)
      const { data, error } = await db.select('*').eq('status', 'active').limit(1000);
      if (error) throw error;
      locationFiltered = data || [];
      console.log(`[DB FILTER] no location filter, loaded ${locationFiltered.length} active schools`);
    }
  } catch (filterError: any) {
    console.error('[searchSchools] DB query failed:', filterError.message);
    return {
      schools: [],
      total: 0,
      returned: 0,
      edgeCaseMessage: 'School data could not be loaded. Please try again.',
      error: 'db_fetch_failed'
    };
  }

  // Apply safety radius if no location narrowing occurred and we have coordinates
  if (locationFiltered.length > 200 && finalLat && finalLng) {
    console.log('[S161-WC1-FIX-B] Large result set — enforcing 100km safety radius');
    locationFiltered = locationFiltered.filter((s: any) => {
      if (!s.lat || !s.lng) return false;
      return calculateDistance(finalLat, finalLng, s.lat, s.lng) <= 100;
    });
  }

  console.log(`[FILTER STAGE] After location filter: ${locationFiltered.length} (DB query took ${Date.now() - searchStartTime}ms)`);

  let hardFiltered = locationFiltered.filter((school: any) => {
    const parsedMinGrade = minGrade !== undefined && minGrade !== null ? parseInt(minGrade) : null;
    if (parsedMinGrade !== null) {
      let sLow = parseInt(school.lowest_grade);
      let sHigh = parseInt(school.highest_grade);
      if (!isNaN(sLow) && !isNaN(sHigh)) {
        const distanceOutsideRange = parsedMinGrade < sLow ? sLow - parsedMinGrade : (parsedMinGrade > sHigh ? parsedMinGrade - sHigh : 0);
        if (distanceOutsideRange > 0) {
          console.log(`[GRADE FILTER] Excluded ${school.name}: grades ${sLow}-${sHigh}, need ${parsedMinGrade} (${distanceOutsideRange} grades outside range)`);
          return false;
        }
      } else {
        console.log(`[GRADE FILTER] Keeping ${school.name}: Missing grade info, but not filtering out`);
      }
    }

    const schoolTuition = school.day_tuition || school.effective_tuition || school.boarding_tuition || null;
    if (maxTuition && maxTuition !== 'unlimited') {
      if (schoolTuition && schoolTuition > maxTuition) {
        console.log(`[BUDGET FILTER] Filtered out ${school.name}: tuition $${schoolTuition} exceeds budget $${maxTuition}`);
        return false;
      }
    }

    if (!applyReligiousFilter(school, familyProfile, payload)) return false;
    if (!applyGenderFilter(school, familyProfile)) return false;

    if (familyProfile?.commute_tolerance_minutes && school.distance_km) {
      const estimatedCommute = school.distance_km * 2;
      if (estimatedCommute > familyProfile.commute_tolerance_minutes) {
        console.log(`Hard-filtered ${school.name}: commute ${estimatedCommute}min exceeds tolerance ${familyProfile.commute_tolerance_minutes}min`);
        return false;
      }
    }

    return true;
  });

  console.log(`[FILTER STAGE] After hard filters (grade+budget+religious+gender): ${locationFiltered.length} → ${hardFiltered.length} schools`);

  let schoolsToRank = hardFiltered;
  let isRelaxedPass = false;
  if (hardFiltered.length === 0) {
    console.log('[FALLBACK] No schools after strict filters — attempting relaxed pass');
    schoolsToRank = locationFiltered.filter((school: any) => {
      const parsedMinGrade = minGrade !== undefined && minGrade !== null ? parseInt(minGrade) : null;
      if (parsedMinGrade !== null) {
        let sLow = parseInt(school.lowest_grade);
        let sHigh = parseInt(school.highest_grade);
        if (!isNaN(sLow) && !isNaN(sHigh)) {
          const distanceOutsideRange = parsedMinGrade < sLow ? sLow - parsedMinGrade : (parsedMinGrade > sHigh ? parsedMinGrade - sHigh : 0);
          if (distanceOutsideRange > 1) {
            return false;
          }
        }
      }
      if (!applyReligiousFilter(school, familyProfile, payload)) return false;
      if (!applyGenderFilter(school, familyProfile)) return false;
      return true;
    });
    isRelaxedPass = true;
    console.log(`[FALLBACK] Relaxed pass: ${schoolsToRank.length} schools available`);
  }

  if (schoolsToRank.length === 0) {
    return {
      schools: [],
      total: 0,
      returned: 0,
      edgeCaseMessage: "No schools matched your criteria. Try expanding your location, budget, or grade range.",
      relaxedFilters: false
    };
  }

  const scored = schoolsToRank.map((school: any) => {
    let score = 0;

    if (minGrade !== undefined) {
      const targetGrade = minGrade !== undefined ? minGrade : maxGrade;
      if (school.lowest_grade <= targetGrade && school.highest_grade >= targetGrade) {
        score += 2;
      } else {
        const distanceOutsideRange = targetGrade < school.lowest_grade ? school.lowest_grade - targetGrade : (targetGrade > school.highest_grade ? targetGrade - school.highest_grade : 0);
        if (distanceOutsideRange <= 2) {
          score -= 1;
          console.log(`[GRADE SCORE] Soft penalty for ${school.name}: ${distanceOutsideRange} grade(s) outside range`);
        }
      }
    }

    const scoreTuition = school.day_tuition || school.effective_tuition || school.boarding_tuition || null;
    if (maxTuition !== undefined && scoreTuition) {
      if (scoreTuition <= maxTuition) {
        score += 2;
      }
    }

    if (curriculum && school.curriculum?.includes(curriculum)) {
      score += 3;
    }

    if (schoolTypeLabel && school.school_type_label === schoolTypeLabel) {
      score += 2;
    }

    if (specializations && specializations.length > 0) {
      if (school.specializations) {
        const matches = specializations.filter((spec: string) => school.specializations.includes(spec)).length;
        score += matches;
      }
    }

    if (familyProfile?.interests?.length > 0 && school.specializations?.length > 0) {
      const interestLower = familyProfile.interests.map((i: string) => i.toLowerCase());
      const specLower = school.specializations.map((s: string) => s.toLowerCase());
      const interestMatches = interestLower.filter((interest: string) =>
        specLower.some((spec: string) => spec.includes(interest) || interest.includes(spec))
      ).length;
      if (interestMatches > 0) score += interestMatches;
    }

    if (familyProfile?.interests?.length > 0) {
      const interestLower = familyProfile.interests.map((i: string) => i.toLowerCase());
      const schoolArts = (school.arts_programs || []).map((a: string) => a.toLowerCase());
      const schoolSports = (school.sports_programs || []).map((s: string) => s.toLowerCase());
      const artMatches = interestLower.filter((i: string) => schoolArts.some((a: string) => a.includes(i) || i.includes(a))).length;
      const sportMatches = interestLower.filter((i: string) => schoolSports.some((s: string) => s.includes(i) || i.includes(s))).length;
      score += Math.min(artMatches + sportMatches, 3);
    }

    if (familyProfile?.academic_struggles?.length > 0 || familyProfile?.learning_differences?.length > 0) {
      if (school.avg_class_size && school.avg_class_size <= 18) score += 1;
      if (school.student_teacher_ratio && parseFloat(school.student_teacher_ratio) <= 10) score += 1;
      const supportKeywords = ['learning support', 'special needs', 'differentiated', 'individualized', 'ld support', 'resource'];
      const specLower = (school.specializations || []).map((s: string) => s.toLowerCase());
      if (supportKeywords.some(kw => specLower.some((s: string) => s.includes(kw)))) score += 2;
    }

    return { school, score };
  });

  let schools = scored.sort((a: any, b: any) => b.score - a.score).map((s: any) => { s.school._matchScore = s.score; return s.school; });

  if (finalLat && finalLng) {
    schools = schools.map((school: any) => {
      if (school.lat && school.lng) {
        const distance = calculateDistance(finalLat, finalLng, school.lat, school.lng);
        return { ...school, distance_km: distance };
      }
      return school;
    });

    if (maxDistanceKm) {
      schools = schools.filter((s: any) => !s.distance_km || s.distance_km <= maxDistanceKm);
    }

    if (schools.length === 0 && schoolsToRank.length > 0) {
      console.log('[S151-WC2] Post-scoring distance filter killed all results - falling back');
      schools = scored
        .filter((s: any) => !s.school.distance_km || s.school.distance_km <= 150)
        .sort((a: any, b: any) => b.score - a.score)
        .map((s: any) => s.school);
    }

    schools.sort((a: any, b: any) => {
      const scoreA = (a._matchScore || 0) - ((a.distance_km || 0) * 0.1);
      const scoreB = (b._matchScore || 0) - ((b.distance_km || 0) * 0.1);
      return scoreB - scoreA;
    });
  }

  if (familyProfile) {
    schools = schools.filter((school: any) => {
      if (familyProfile.commute_tolerance_minutes && school.distance_km) {
        const estimatedCommute = school.distance_km * 2;
        const tolerance = familyProfile.commute_tolerance_minutes;
        if (estimatedCommute > tolerance + 50) {
          console.log(`Filtered out ${school.name}: commute ${estimatedCommute}min exceeds tolerance ${tolerance}min by 50+min`);
          return false;
        }
      }

      const postTuition = school.day_tuition || school.effective_tuition || school.boarding_tuition || null;
      if (familyProfile.max_tuition && postTuition) {
        if (postTuition > familyProfile.max_tuition * 2) {
          console.log(`Filtered out ${school.name}: tuition $${postTuition} is 2x+ budget $${familyProfile.max_tuition}`);
          return false;
        }
      }

      return true;
    });
  }

  const originalFilteredCount = schools.length;
  let edgeCaseMessage: string | null = null;

  if (schools.length === 0) {
    edgeCaseMessage = "No schools matched your criteria. Try expanding your location, budget, or grade range.";
    console.log('[EDGE CASE] All schools filtered out - returning empty array');
  } else if (schools.length > 15) {
    edgeCaseMessage = "I found quite a few options! Would you like to narrow it down by adding more preferences (budget, curriculum, specializations)?";
  }

  const maxResults = Math.min(schools.length, 20);
  const condensedSchools = schools.slice(0, maxResults).map((s: any) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    city: s.city,
    province_state: s.province_state,
    gradesServed: `${s.lowest_grade}-${s.highest_grade}`,
    lowest_grade: s.lowest_grade,
    highest_grade: s.highest_grade,
    tuition: s.tuition,
    day_tuition: s.day_tuition,
    currency: s.currency,
    curriculum: s.curriculum,
    gender_policy: s.gender_policy,
    region: s.region,
    specializations: s.specializations,
    distance_km: s.distance_km,
    school_type_label: s.school_type_label,
    header_photo_url: s.header_photo_url,
    logo_url: s.logo_url,
    arts_programs: s.arts_programs?.slice(0, 5) || [],
    sports_programs: s.sports_programs?.slice(0, 5) || [],
    avg_class_size: s.avg_class_size || null,
    school_tier: s.school_tier || null,
    claim_status: s.claim_status || null,
    relaxedMatch: isRelaxedPass
  }));

  // Fire-and-forget: SearchLog write should not block the response
  SearchLog.create({
    query: searchQuery || `Search for grade ${minGrade} in ${city || region || 'unspecified'}`,
    input_filters: {
      city, provinceState, region, minGrade, maxGrade, maxTuition,
      curriculum, specializations, schoolTypeLabel, maxDistanceKm,
      dealbreakers: payload.dealbreakers || familyProfile?.dealbreakers || []
    },
    total_schools_passing_filters: originalFilteredCount,
    top_results: condensedSchools.slice(0, 10).map((s: any) => ({
      schoolName: s.name,
      score: scored.find((sc: any) => sc.school.id === s.id)?.score || 0,
      reasons: [
        s.distance_km ? `${s.distance_km.toFixed(1)}km away` : null,
        s.tuition && maxTuition && s.tuition <= maxTuition ? 'Within budget' : null,
        s.curriculum?.includes(curriculum) ? `${curriculum} curriculum` : null,
      ].filter(Boolean)
    })),
    conversation_id: conversationId,
    user_id: userId
  }).catch((logError: any) => console.error('Failed to create SearchLog:', logError));

  return {
    schools: condensedSchools,
    total: schools.length,
    returned: condensedSchools.length,
    edgeCaseMessage,
    relaxedFilters: isRelaxedPass
  };
}
