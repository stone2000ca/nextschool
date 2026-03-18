// Function: updateSchoolPhotos
// Purpose: For each school with website but no headerPhotoUrl, find best photo and write it
// Entities: School, PhotoCandidate
// Last Modified: 2026-03-17

import { School, PhotoCandidate } from '@/lib/entities-server'
import { scrapeSchoolPhotosLogic } from './scrapeSchoolPhotos'

function pickBest(candidates: any[]) {
  if (!candidates?.length) return null;
  const hero = candidates.find((c: any) => c.inferredType === 'hero');
  if (hero) return hero;
  const campus = candidates.find((c: any) => c.inferredType === 'campus');
  if (campus) return campus;
  return candidates.sort((a: any, b: any) => (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0))[0];
}

export async function updateSchoolPhotosLogic(params: { schoolIds?: string[] }) {
  const { schoolIds } = params;

  let schools: any[] = [];
  if (schoolIds && schoolIds.length > 0) {
    const fetched = await Promise.all(schoolIds.map((id: string) => School.get(id)));
    schools = fetched.filter((s: any) => s && s.website && !s.headerPhotoUrl && s.status === 'active');
  } else {
    const all = await School.filter({ status: 'active' });
    schools = all.filter((s: any) => s.website && !s.headerPhotoUrl);
  }

  console.log(`[UPDATE PHOTOS] Processing ${schools.length} schools`);
  const results = { updated: [] as any[], skipped: [] as any[], errors: [] as any[] };

  for (const school of schools) {
    try {
      let candidates = await PhotoCandidate.filter({ schoolId: school.id });
      if (!candidates?.length) {
        console.log(`[UPDATE PHOTOS] No candidates for ${school.name} — scraping...`);
        // Use scrapeSchoolPhotosLogic to scrape and store candidates, then re-fetch
        await scrapeSchoolPhotosLogic({ schoolId: school.id });
        candidates = await PhotoCandidate.filter({ schoolId: school.id });
      }

      const best = pickBest(candidates);
      if (!best) { results.skipped.push({ name: school.name, reason: 'no_candidates' }); continue; }

      await School.update(school.id, { headerPhotoUrl: best.imageUrl });
      results.updated.push({ name: school.name, type: best.inferredType, url: best.imageUrl });
    } catch (err: any) {
      results.errors.push({ name: school.name, error: err?.message || String(err) });
    }
  }

  return { success: true, processed: schools.length, updated: results.updated.length, skipped: results.skipped.length, errors: results.errors.length, details: results };
}
