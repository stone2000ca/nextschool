// Function: searchSchools
// Purpose: Search and rank schools based on family profile and location filters
// Entities: School, SearchLog
// Last Modified: 2026-03-09
// S112-WC1: F7 P0 Fix - Religious & gender filters now enforced in relaxed fallback pass

import { School, SearchLog } from '@/lib/entities-server'

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
    const schoolAffiliation = (school.faithBased || '').toLowerCase().trim().replace(/[\s-]+/g, ' ');
    const knownReligiousAffiliations = ['christian', 'catholic', 'islamic', 'jewish', 'lutheran', 'baptist', 'methodist', 'presbyterian', 'anglican', 'orthodox', 'evangelical', 'pentecostal', 'adventist', 'mormon', 'lds', 'quaker', 'mennonite', 'amish', 'hindu', 'buddhist', 'sikh', 'muslim'];
    if (school.faithBased && knownReligiousAffiliations.includes(schoolAffiliation)) {
      console.log(`[RELIGIOUS FILTER] Excluded ${school.name}: religious affiliation`);
      return false;
    }
    const religiousKeywords = ['christian', 'catholic', 'islamic', 'jewish', 'lutheran', 'baptist', 'adventist', 'anglican', 'yeshiva', 'hebrew', 'our lady', 'gospel', 'covenant', 'faith-based', 'huraira', 'mosque', 'synagogue', 'church school', 'bible', 'quaker', 'mennonite', 'amish', 'hindu', 'buddhist', 'sikh', 'muslim', 'baeck', 'heschel', 'tayyibah', 'khairul', 'wali ul', 'orthodox', 'mother of god'];
    const schoolNameLower = school.name?.toLowerCase() || '';
    if (religiousKeywords.some(keyword => schoolNameLower.includes(keyword))) {
      console.log(`[RELIGIOUS FILTER] Excluded ${school.name}: name contains religious keyword`);
      return false;
    }
  }
  return true;
}

function applyGenderFilter(school: any, familyProfile: any) {
  const gp = school.genderPolicy || null;
  if (gp === null) return true;

  const rawGender = (familyProfile?.childGender || familyProfile?.gender || '').toLowerCase().trim();
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

  const exclusions = familyProfile?.schoolGenderExclusions || [];
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

  const genderPref = familyProfile?.schoolGenderPreference || null;
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

  let allSchools: any[] = [];
  try {
    allSchools = await School.filter({}, '-createdAt', 1000);
    if (allSchools.length === 1000) {
      console.warn('[searchSchools] WARNING: School count hit limit (1000). Results may be incomplete.');
    }
  } catch (filterError: any) {
    console.error('[searchSchools] School.filter failed:', filterError.message);
    return {
      schools: [],
      total: 0,
      returned: 0,
      edgeCaseMessage: 'School data could not be loaded. Please try again.',
      error: 'db_fetch_failed'
    };
  }
  let schools = allSchools.filter((s: any) => s.status === 'active');

  let locationFiltered = schools;

  let aliasedCities: string[] = [];
  let aliasedProvinces: string[] = [];
  const aliasKey = (region || city || '').toLowerCase().trim();
  const alias = regionAliases[aliasKey];
  if (alias) {
    if (alias.cities) aliasedCities = alias.cities;
    if (alias.provinces) aliasedProvinces = alias.provinces;
    console.log(`[S151] Region alias matched: "${aliasKey}" -> ${aliasedCities.length} cities`);
  }

  if (aliasedCities.length > 0) {
    locationFiltered = locationFiltered.filter((s: any) =>
      aliasedCities.some(c => s.city?.toLowerCase() === c.toLowerCase())
    );
  } else if (aliasedProvinces.length > 0) {
    locationFiltered = locationFiltered.filter((s: any) => {
      if (!s.provinceState) return false;
      const schoolPS = s.provinceState.toLowerCase();
      return aliasedProvinces.some(p => schoolPS === p.toLowerCase());
    });
  }

  if (city && aliasedCities.length === 0) {
    const cityLower = city.trim().toLowerCase();
    let cityMatches = locationFiltered.filter((s: any) =>
      s.city && s.city.toLowerCase() === cityLower
    );
    if (cityMatches.length === 0) {
      cityMatches = locationFiltered.filter((s: any) =>
        s.city && s.city.toLowerCase().includes(cityLower)
      );
    }
    if (cityMatches.length === 0 && (resolvedLat || finalLat)) {
      console.log(`[CITY FILTER] Falling back to coordinate-based with 75km cap`);
      locationFiltered = locationFiltered.filter((s: any) => {
        if (!s.lat || !s.lng) return false;
        const dist = calculateDistance(finalLat, finalLng, s.lat, s.lng);
        return dist <= 75;
      });
    } else {
      locationFiltered = cityMatches;
    }
    console.log(`[CITY FILTER] city="${city}" → ${locationFiltered.length} schools`);
  }

  if (provinceState && provinceState.trim() && aliasedProvinces.length === 0) {
    const psUpper = provinceState.toUpperCase().trim();
    const fullProvinceName = provinceAbbreviations[psUpper] || stateAbbreviations[psUpper];
    const normalizedProvince = fullProvinceName || toTitleCase(provinceState.trim());
    const provinceRegex = new RegExp(`^${normalizedProvince}$`, 'i');
    locationFiltered = locationFiltered.filter((s: any) => {
      const schoolPS = s.provinceState?.toUpperCase().trim();
      const expandedSchoolPS = provinceAbbreviations[schoolPS] || stateAbbreviations[schoolPS] || s.provinceState;
      return provinceRegex.test(expandedSchoolPS) || provinceRegex.test(s.provinceState);
    });
  }

  if (region && !aliasedCities.length && !aliasedProvinces.length && !city) {
    const regionMatched = locationFiltered.filter((s: any) => s.region === region);
    if (regionMatched.length > 0) {
      locationFiltered = regionMatched;
    } else if (finalLat && finalLng) {
      console.log(`[S151-WC3] region="${region}" matched 0 schools - falling back to geo radius`);
      locationFiltered = locationFiltered.filter((s: any) => {
        if (!s.lat || !s.lng) return false;
        return calculateDistance(finalLat, finalLng, s.lat, s.lng) <= 75;
      });
    }
  }
  if (country) {
    locationFiltered = locationFiltered.filter((s: any) => s.country === country);
  }

  if (locationFiltered.length === schools.length && finalLat && finalLng) {
    console.log('[S161-WC1-FIX-B] No location filter applied - enforcing 100km safety radius');
    locationFiltered = locationFiltered.filter((s: any) => {
      if (!s.lat || !s.lng) return false;
      const dist = calculateDistance(finalLat, finalLng, s.lat, s.lng);
      return dist <= 100;
    });
  }

  let hardFiltered = locationFiltered.filter((school: any) => {
    const parsedMinGrade = minGrade !== undefined && minGrade !== null ? parseInt(minGrade) : null;
    if (parsedMinGrade !== null) {
      let sLow = parseInt(school.lowestGrade);
      let sHigh = parseInt(school.highestGrade);
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

    const schoolTuition = school.tuition || school.dayTuition || school.tuitionMin || null;
    if (maxTuition && maxTuition !== 'unlimited') {
      if (schoolTuition && schoolTuition > maxTuition) {
        console.log(`[BUDGET FILTER] Filtered out ${school.name}: tuition $${schoolTuition} exceeds budget $${maxTuition}`);
        return false;
      }
    }

    if (!applyReligiousFilter(school, familyProfile, payload)) return false;
    if (!applyGenderFilter(school, familyProfile)) return false;

    if (familyProfile?.commuteToleranceMinutes && school.distanceKm) {
      const estimatedCommute = school.distanceKm * 2;
      if (estimatedCommute > familyProfile.commuteToleranceMinutes) {
        console.log(`Hard-filtered ${school.name}: commute ${estimatedCommute}min exceeds tolerance ${familyProfile.commuteToleranceMinutes}min`);
        return false;
      }
    }

    return true;
  });

  console.log(`Hard filters: ${locationFiltered.length} → ${hardFiltered.length} schools`);

  let schoolsToRank = hardFiltered;
  let isRelaxedPass = false;
  if (hardFiltered.length === 0) {
    console.log('[FALLBACK] No schools after strict filters — attempting relaxed pass');
    schoolsToRank = locationFiltered.filter((school: any) => {
      const parsedMinGrade = minGrade !== undefined && minGrade !== null ? parseInt(minGrade) : null;
      if (parsedMinGrade !== null) {
        let sLow = parseInt(school.lowestGrade);
        let sHigh = parseInt(school.highestGrade);
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
      if (school.lowestGrade <= targetGrade && school.highestGrade >= targetGrade) {
        score += 2;
      } else {
        const distanceOutsideRange = targetGrade < school.lowestGrade ? school.lowestGrade - targetGrade : (targetGrade > school.highestGrade ? targetGrade - school.highestGrade : 0);
        if (distanceOutsideRange <= 2) {
          score -= 1;
          console.log(`[GRADE SCORE] Soft penalty for ${school.name}: ${distanceOutsideRange} grade(s) outside range`);
        }
      }
    }

    if (maxTuition !== undefined && school.tuition) {
      if (school.tuition <= maxTuition) {
        score += 2;
      }
    }

    if (curriculum && school.curriculum?.includes(curriculum)) {
      score += 3;
    }

    if (schoolTypeLabel && school.schoolTypeLabel === schoolTypeLabel) {
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
      const schoolArts = (school.artsPrograms || []).map((a: string) => a.toLowerCase());
      const schoolSports = (school.sportsPrograms || []).map((s: string) => s.toLowerCase());
      const artMatches = interestLower.filter((i: string) => schoolArts.some((a: string) => a.includes(i) || i.includes(a))).length;
      const sportMatches = interestLower.filter((i: string) => schoolSports.some((s: string) => s.includes(i) || i.includes(s))).length;
      score += Math.min(artMatches + sportMatches, 3);
    }

    if (familyProfile?.academicStruggles?.length > 0 || familyProfile?.learningDifferences?.length > 0) {
      if (school.avgClassSize && school.avgClassSize <= 18) score += 1;
      if (school.studentTeacherRatio && parseFloat(school.studentTeacherRatio) <= 10) score += 1;
      const supportKeywords = ['learning support', 'special needs', 'differentiated', 'individualized', 'ld support', 'resource'];
      const specLower = (school.specializations || []).map((s: string) => s.toLowerCase());
      if (supportKeywords.some(kw => specLower.some((s: string) => s.includes(kw)))) score += 2;
    }

    return { school, score };
  });

  schools = scored.sort((a: any, b: any) => b.score - a.score).map((s: any) => { s.school._matchScore = s.score; return s.school; });

  if (finalLat && finalLng) {
    schools = schools.map((school: any) => {
      if (school.lat && school.lng) {
        const distance = calculateDistance(finalLat, finalLng, school.lat, school.lng);
        return { ...school, distanceKm: distance };
      }
      return school;
    });

    if (maxDistanceKm) {
      schools = schools.filter((s: any) => !s.distanceKm || s.distanceKm <= maxDistanceKm);
    }

    if (schools.length === 0 && schoolsToRank.length > 0) {
      console.log('[S151-WC2] Post-scoring distance filter killed all results - falling back');
      schools = scored
        .filter((s: any) => !s.school.distanceKm || s.school.distanceKm <= 150)
        .sort((a: any, b: any) => b.score - a.score)
        .map((s: any) => s.school);
    }

    schools.sort((a: any, b: any) => {
      const scoreA = (a._matchScore || 0) - ((a.distanceKm || 0) * 0.1);
      const scoreB = (b._matchScore || 0) - ((b.distanceKm || 0) * 0.1);
      return scoreB - scoreA;
    });
  }

  if (familyProfile) {
    schools = schools.filter((school: any) => {
      if (familyProfile.commuteToleranceMinutes && school.distanceKm) {
        const estimatedCommute = school.distanceKm * 2;
        const tolerance = familyProfile.commuteToleranceMinutes;
        if (estimatedCommute > tolerance + 50) {
          console.log(`Filtered out ${school.name}: commute ${estimatedCommute}min exceeds tolerance ${tolerance}min by 50+min`);
          return false;
        }
      }

      if (familyProfile.maxTuition && school.tuition) {
        if (school.tuition > familyProfile.maxTuition * 2) {
          console.log(`Filtered out ${school.name}: tuition $${school.tuition} is 2x+ budget $${familyProfile.maxTuition}`);
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
    provinceState: s.provinceState,
    gradesServed: `${s.lowestGrade}-${s.highestGrade}`,
    lowestGrade: s.lowestGrade,
    highestGrade: s.highestGrade,
    tuition: s.tuition,
    dayTuition: s.dayTuition,
    currency: s.currency,
    curriculum: s.curriculum,
    genderPolicy: s.genderPolicy,
    region: s.region,
    specializations: s.specializations,
    distanceKm: s.distanceKm,
    schoolTypeLabel: s.schoolTypeLabel,
    headerPhotoUrl: s.headerPhotoUrl,
    logoUrl: s.logoUrl,
    artsPrograms: s.artsPrograms?.slice(0, 5) || [],
    sportsPrograms: s.sportsPrograms?.slice(0, 5) || [],
    avgClassSize: s.avgClassSize || null,
    schoolTier: s.schoolTier || null,
    claimStatus: s.claimStatus || null,
    relaxedMatch: isRelaxedPass
  }));

  try {
    const topResultsForLog = condensedSchools.slice(0, 10).map((s: any, idx: number) => ({
      schoolName: s.name,
      score: scored.find((sc: any) => sc.school.id === s.id)?.score || 0,
      reasons: [
        s.distanceKm ? `${s.distanceKm.toFixed(1)}km away` : null,
        s.tuition && maxTuition && s.tuition <= maxTuition ? 'Within budget' : null,
        s.curriculum?.includes(curriculum) ? `${curriculum} curriculum` : null,
        s.specializations?.some((spec: string) => specializations?.includes(spec)) ? 'Matches specializations' : null
      ].filter(Boolean)
    }));

    await SearchLog.create({
      query: searchQuery || `Search for grade ${minGrade} in ${city || region || 'unspecified'}`,
      inputFilters: {
        city,
        provinceState,
        region,
        minGrade,
        maxGrade,
        maxTuition,
        curriculum,
        specializations,
        schoolTypeLabel,
        maxDistanceKm,
        dealbreakers: payload.dealbreakers || familyProfile?.dealbreakers || []
      },
      totalSchoolsPassingFilters: originalFilteredCount,
      topResults: topResultsForLog,
      conversationId,
      userId
    });
  } catch (logError) {
    console.error('Failed to create SearchLog:', logError);
  }

  return {
    schools: condensedSchools,
    total: schools.length,
    returned: condensedSchools.length,
    edgeCaseMessage,
    relaxedFilters: isRelaxedPass
  };
}
