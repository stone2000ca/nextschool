// MIGRATION — DELETE AFTER RUNNING
// Function: migrateSchoolArrayFields
// Purpose: Reformat array fields in School entities stored as malformed JSON strings (e.g. '["Local","Other"]' as a string)
// Entities: School (read + update)
// Last Modified: 2026-03-17
// Dependencies: Base44 SDK

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ARRAY_FIELDS = [
  'values', 'highlights', 'developmentalPriorities', 'languagesOfInstruction',
  'livingArrangements', 'curriculum', 'specializations', 'specialNeedsCategories',
  'specialEdPrograms', 'additionalSupportServices', 'admissionRequirements',
  'dayEntryGrades', 'boardingEntryGrades', 'sportsPrograms', 'clubs', 'artsPrograms',
  'photoGallery', 'videos', 'facilities', 'associations', 'accreditations',
  'notableAlumni', 'aiEnrichedFields',
];

function tryParseArray(val) {
  if (Array.isArray(val)) return { alreadyCorrect: true };
  if (typeof val !== 'string') return null;

  const trimmed = val.trim();
  if (!trimmed.startsWith('[')) return null;

  try {
    let parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (Array.isArray(parsed)) return { alreadyCorrect: false, value: parsed };
  } catch {
    const inner = trimmed.replace(/^\[|\]$/g, '').trim();
    if (!inner) return { alreadyCorrect: false, value: [] };
    const items = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    return { alreadyCorrect: false, value: items };
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Pass { skip: N } in body to resume after a rate limit
    const body = await req.json().catch(() => ({}));
    const skip = parseInt(body.skip || 0, 10);
    const batchSize = parseInt(body.batchSize || 500, 10);

    console.log(`[MIGRATION] Fetching schools (skip=${skip}, batchSize=${batchSize})...`);
    const schools = await base44.asServiceRole.entities.School.list(null, batchSize, skip);
    console.log(`[MIGRATION] Processing ${schools.length} schools in this batch.`);

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const school of schools) {
      const updates = {};

      for (const field of ARRAY_FIELDS) {
        const result = tryParseArray(school[field]);
        if (!result || result.alreadyCorrect) continue;
        updates[field] = result.value;
      }

      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }

      try {
        await base44.asServiceRole.entities.School.update(school.id, updates);
        updated++;
        if (updated % 50 === 0) {
          console.log(`[MIGRATION] Progress: ${updated} updated...`);
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        errors.push({ schoolId: school.id, name: school.name, error: err.message });
        console.error(`[MIGRATION] Failed on ${school.name} (${school.id}):`, err.message);
      }
    }

    const hasMore = schools.length === batchSize;
    const nextSkip = skip + schools.length;

    console.log(`[MIGRATION] Done. ${updated} updated, ${skipped} skipped, ${errors.length} errors.${hasMore ? ` Re-run with skip=${nextSkip}` : ' All records processed.'}`);

    return Response.json({
      success: errors.length === 0,
      batchProcessed: schools.length,
      updated,
      skipped,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
      hasMore,
      nextSkip,
      message: `${updated} updated, ${skipped} skipped.${hasMore ? ` Re-run with { skip: ${nextSkip} } for next batch.` : ' All records processed.'}`,
    });

  } catch (error) {
    console.error('[MIGRATION] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});