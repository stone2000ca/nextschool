// MIGRATION — DELETE AFTER RUNNING
// Function: migrateSchoolArrayFields
// Purpose: Reformat malformed array fields in School entities (handles double-stringification, newlines, nested quotes)
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

function cleanString(s) {
  if (typeof s !== 'string') return s;
  return s.trim().replace(/^["']+|["']+$/g, '').replace(/\\"/g, '"').trim();
}

function tryParseArray(val) {
  // Already a proper array — recursively clean each element
  if (Array.isArray(val)) {
    const cleaned = val.flatMap(item => {
      if (typeof item === 'string') {
        const result = tryParseArray(item);
        if (result && !result.alreadyCorrect) return result.value;
        return [cleanString(item)];
      }
      return [item];
    }).filter(item => item !== null && item !== undefined && item !== '');
    return { alreadyCorrect: true, value: cleaned };
  }

  if (typeof val !== 'string') return null;

  // Normalize: remove newlines and trim
  let s = val.replace(/[\n\r]/g, '').trim();

  // Iteratively JSON.parse to unwrap multiple layers of stringification
  let parsed = null;
  for (let i = 0; i < 4; i++) {
    try {
      const attempt = JSON.parse(s);
      if (Array.isArray(attempt)) {
        parsed = attempt;
        break;
      }
      if (typeof attempt === 'string') {
        s = attempt.trim(); // unwrap one layer and try again
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  if (Array.isArray(parsed)) {
    const finalArray = parsed
      .map(item => (typeof item === 'string' ? cleanString(item) : item))
      .filter(item => item !== null && item !== undefined && item !== '');
    return { alreadyCorrect: false, value: finalArray };
  }

  // Fallback: manually strip brackets and split
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return { alreadyCorrect: false, value: [] };
    // Split by comma only when not inside quotes
    const items = inner
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map(cleanString)
      .filter(Boolean);
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

    const body = await req.json().catch(() => ({}));
    const skip = parseInt(body.skip || 0, 10);
    const batchSize = parseInt(body.batchSize || 200, 10);

    console.log(`[MIGRATION] Fetching schools (skip=${skip}, batchSize=${batchSize})...`);

    // Use 'created_date' as a stable sort field to ensure consistent pagination across batches
    const schools = await base44.asServiceRole.entities.School.list('created_date', batchSize, skip);
    console.log(`[MIGRATION] Got ${schools.length} schools in this batch.`);

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const school of schools) {
      const updates = {};

      for (const field of ARRAY_FIELDS) {
        const result = tryParseArray(school[field]);
        if (!result) continue;
        // For already-correct arrays, still write back if elements were cleaned
        const current = JSON.stringify(school[field]);
        const cleaned = JSON.stringify(result.value);
        if (current !== cleaned) {
          updates[field] = result.value;
        }
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
          await new Promise(r => setTimeout(r, 100));
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
      message: `${updated} updated, ${skipped} skipped.${hasMore ? ` Re-run with { "skip": ${nextSkip} } for next batch.` : ' All records processed.'}`,
    });

  } catch (error) {
    console.error('[MIGRATION] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});