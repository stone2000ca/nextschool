// Function: geocodeSchools
// Purpose: Batch geocode School records that have an address but are missing lat/lng
// Entities: School
// Last Modified: 2026-03-14

import { School } from '@/lib/entities-server'

export async function geocodeSchoolsLogic(params: { limit?: number }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw Object.assign(new Error('GOOGLE_MAPS_API_KEY not configured'), { status: 500 });

  let limit = params.limit && typeof params.limit === 'number' && params.limit > 0 ? Math.min(params.limit, 100) : 50;

  console.log(`[geocodeSchools] Fetching schools with address but missing coordinates (limit: ${limit})`);
  // Fetch schools with addresses, then filter in JS for missing lat/lng
  // (the Supabase filter can't easily express "has address AND missing lat/lng")
  const allWithAddress = await School.filter({
    address: { $ne: null }
  }, '-updated_at', limit * 5);
  const schools = allWithAddress.filter((s: any) =>
    s.address && s.address.trim() !== '' && (s.lat === null || s.lat === undefined || s.lat === '' || s.lng === null || s.lng === undefined || s.lng === '')
  ).slice(0, limit);

  if (schools.length === 0) {
    return { processed: 0, updated: 0, failed: 0, errors: [] };
  }

  let processed = 0, updated = 0, failed = 0;
  const errors: string[] = [];
  const batchSize = 10;
  const delayMs = 200;

  for (let i = 0; i < schools.length; i += batchSize) {
    const batch = schools.slice(i, i + batchSize);

    for (const school of batch) {
      try {
        const parts = [school.address, school.city, school.province_state, school.country].filter((p: any) => p && p.trim());
        const query = parts.join(', ');
        if (!query || query.trim().length === 0) { failed++; errors.push(`School ${school.id}: No valid address parts`); processed++; continue; }

        const encodedQuery = encodeURIComponent(query);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results?.length > 0) {
          const location = data.results[0].geometry.location;
          await School.update(school.id, { lat: location.lat, lng: location.lng });
          console.log(`[geocodeSchools] Updated ${school.name}: lat=${location.lat}, lng=${location.lng}`);
          updated++;
        } else {
          const errorMsg = data.status === 'ZERO_RESULTS' ? 'No results found' : data.error_message || data.status || 'Unknown error';
          failed++; errors.push(`School ${school.id} (${school.name}): ${errorMsg}`);
        }
        processed++;
      } catch (err: any) { failed++; errors.push(`School ${school.id}: ${err.message}`); processed++; }
    }

    if (i + batchSize < schools.length) await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return { processed, updated, failed, errors };
}
