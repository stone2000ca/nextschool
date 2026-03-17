// MIGRATION — DELETE AFTER RUNNING
// Function: migration_2026-03-17_fix-school-array-fields
// Purpose: Reformat array fields in School entities stored as malformed JSON strings (e.g. '["Local","Other"]' as a string)
// Entities: School (read + update)
// Last Modified: 2026-03-17 6PM
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
  if (Array.isArray(val)) return { isArray: true, value: val }; // already correct
  if (typeof val !== 'string') return null;

  const trimmed = val.trim();
  if (!trimmed.startsWith('[')) return null; // not an array string, skip

  try {
    let parsed = JSON.parse(trimmed);
    // Handle double-encoded strings
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (Array.isArray(parsed)) return { isArray: false, value: parsed };
  } catch {
    // malformed — try stripping brackets and splitting
    const inner = trimmed.replace(/^\[|\]$/g, '').trim();
    if (!inner) return { isArray: false, value: [] };
    const items = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    return { isArray: false, value: items };
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

    // Support pagination for re-runs after rate limits: pass { skip: N } in body
    const body = await req.json().catch(() => ({}));
    const skip = parseInt(body.skip || 0, 10);
    const batchSize = parseInt(body.batchSize || 500, 10);

    console.log(`[MIGRATION] Fetching schools (skip=${skip}, batchSize=${batchSize})...`);
    const allSchools = await base44.asServiceRole.entities.School.list(null, batchSize, skip);
    console.log(`[MIGRATION] Processing ${allSchools.length} schools in this batch.`);

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const school of allSchools) {
      const updates = {};

      for (const field of ARRAY_FIELDS) {
        const result = tryParseArray(school[field]);
        if (!result) { continue; } // null/undefined/non-array-string — skip field
        if (result.isArray) { continue; } // already a proper array — skip field
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
          console.log(`[MIGRATION] Progress: ${updated} updated so far...`);
          await new Promise(r => setTimeout(r, 200)); // gentle throttle
        }
      } catch (err) {
        errors.push({ schoolId: school.id, name: school.name, error: err.message });
        console.error(`[MIGRATION] Failed on ${school.name} (${school.id}):`, err.message);
      }
    }

    const summary = {
      success: errors.length === 0,
      batchProcessed: allSchools.length,
      updated,
      skipped,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
      nextSkip: skip + allSchools.length,
      hasMore: allSchools.length === batchSize,
      message: `Batch done. ${updated} updated, ${skipped} skipped. ${allSchools.length === batchSize ? `Re-run with skip=${skip + allSchools.length} for next batch.` : 'All records processed.'}`,
    };

    console.log(`[MIGRATION] ${summary.message}`);
    return Response.json(summary);

  } catch (error) {
    console.error('[MIGRATION] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
