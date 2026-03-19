// Function: matchSchoolsForProfile
// Purpose: Re-run school matching when a user edits their profile, updating ChatSession with new matches
// Entities: ChatSession, School
// Last Modified: 2026-03-01
// Dependencies: searchSchools function, School entity

import { ChatSession } from '@/lib/entities-server'
import { searchSchoolsLogic } from './searchSchools'

function resolveLocationCoords(locationArea: string | null) {
  const CANADIAN_METRO_COORDS: Record<string, { lat: number; lng: number }> = {
    'toronto': { lat: 43.6532, lng: -79.3832 },
    'gta': { lat: 43.6532, lng: -79.3832 },
    'vancouver': { lat: 49.2827, lng: -123.1207 },
    'montreal': { lat: 45.5017, lng: -73.5673 },
    'ottawa': { lat: 45.4215, lng: -75.6972 },
    'calgary': { lat: 51.0447, lng: -114.0719 },
    'edmonton': { lat: 53.5461, lng: -113.4938 },
    'winnipeg': { lat: 49.8951, lng: -97.1384 },
  };
  if (!locationArea) return null;
  const key = locationArea.toLowerCase().trim();
  if (CANADIAN_METRO_COORDS[key]) return CANADIAN_METRO_COORDS[key];
  for (const [cityKey, coords] of Object.entries(CANADIAN_METRO_COORDS)) {
    if (key.includes(cityKey) || cityKey.includes(key)) {
      return coords;
    }
  }
  return null;
}

export async function matchSchoolsForProfileLogic(params: { sessionId: string; familyProfile: any; userId?: string }) {
  const { sessionId, familyProfile, userId } = params;

  if (!sessionId || !familyProfile) {
    throw Object.assign(new Error('Missing sessionId or familyProfile'), { status: 400 });
  }

  // Fetch ChatSession
  const sessions = await ChatSession.filter({ id: sessionId });
  if (sessions.length === 0) {
    throw Object.assign(new Error('ChatSession not found'), { status: 404 });
  }
  const session = sessions[0];

  // Build search params from updated profile
  const searchParams: any = {
    limit: 50,
    familyProfile: familyProfile
  };

  if (familyProfile.locationArea) {
    const locationAreaLower = familyProfile.locationArea.toLowerCase().trim();
    const regionAliases = ['gta', 'greater toronto area', 'lower mainland', 'metro vancouver'];
    if (regionAliases.includes(locationAreaLower)) {
      searchParams.region = familyProfile.locationArea;
    } else {
      const cityToProvinceMap: Record<string, string> = {
        'toronto': 'Ontario',
        'vancouver': 'British Columbia',
        'calgary': 'Alberta',
        'edmonton': 'Alberta',
        'montreal': 'Quebec',
        'ottawa': 'Ontario',
      };
      const locationParts = familyProfile.locationArea.split(',').map((s: string) => s.trim());
      searchParams.city = locationParts[0];
      const inferredProvince = cityToProvinceMap[locationParts[0].toLowerCase()];
      if (inferredProvince) {
        searchParams.provinceState = inferredProvince;
      }
    }
  }

  const locationCoords = resolveLocationCoords(familyProfile.locationArea);
  if (locationCoords) {
    searchParams.resolvedLat = locationCoords.lat;
    searchParams.resolvedLng = locationCoords.lng;
  }

  if (familyProfile.childGrade !== null && familyProfile.childGrade !== undefined) {
    searchParams.minGrade = familyProfile.childGrade;
    searchParams.maxGrade = familyProfile.childGrade;
  }

  if (familyProfile.maxTuition) {
    searchParams.maxTuition = familyProfile.maxTuition;
  }

  // Call searchSchools directly
  let schools: any[] = [];
  try {
    const searchResult: any = await searchSchoolsLogic({
      ...searchParams,
      conversationId: (session as any).chat_history_id,
      userId: userId,
      searchQuery: 'profile_edit_refresh'
    });
    schools = searchResult.schools || [];
  } catch (searchError: any) {
    console.error('[matchSchoolsForProfile] searchSchools failed:', searchError.message);
    schools = [];
  }

  // Filter and deduplicate
  schools = schools.filter((s: any) => s.school_type_label !== 'Special Needs' && s.school_type_label !== 'Public');
  const seen = new Set();
  const deduplicated: any[] = [];
  for (const school of schools) {
    if (!seen.has(school.name)) {
      seen.add(school.name);
      deduplicated.push(school);
    }
  }

  const matchingSchools = deduplicated.slice(0, 20);

  // Update ChatSession with new matches
  const matchedSchoolIds = matchingSchools.map((s: any) => s.id);
  await ChatSession.update(sessionId, {
    matched_schools: JSON.stringify(matchedSchoolIds)
  });

  console.log('[matchSchoolsForProfile] Updated ChatSession with', matchedSchoolIds.length, 'matched schools');

  return {
    success: true,
    matchedCount: matchingSchools.length,
    schools: matchingSchools
  };
}
