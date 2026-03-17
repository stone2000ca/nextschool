// Function: importEnrichedSchools
// Purpose: Import V2-schema enriched school CSVs in chunks with deduplication, idempotency, and progress logging
// Entities: School, ImportRun
// Last Modified: 2026-03-16
// Dependencies: PapaParse, Base44 SDK

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Papa from 'npm:papaparse';

// ─── V2 Boolean fields ────────────────────────────────────────────────────────
const BOOLEAN_FIELDS = [
  'boarding_available', 'is_bilingual', 'is_faith_based', 'uniform_required',
  'financial_aid_available', 'interview_required', 'ssat_required'
];

// ─── V2 Number fields ─────────────────────────────────────────────────────────
const NUMBER_FIELDS = [
  'lat', 'lng', 'founded', 'day_tuition', 'boarding_tuition', 'effective_tuition',
  'enrollment', 'avg_enrollment_per_grade', 'avg_class_size', 'acceptance_rate',
  'international_student_pct', 'boarding_pct', 'financial_aid_pct', 'median_aid_amount'
];

// ─── V2 Array fields (comma-separated in CSV) ─────────────────────────────────
const ARRAY_FIELDS = [
  'languages_of_instruction', 'living_arrangements', 'developmental_priorities',
  'curriculum', 'specializations', 'sports_programs', 'clubs', 'arts_programs',
  'special_needs_categories', 'special_ed_programs', 'additional_support_services',
  'values', 'highlights', 'facilities', 'photo_gallery', 'videos',
  'ai_enriched_fields', 'notable_alumni', 'associations', 'accreditations',
  'admission_requirements', 'day_entry_grades', 'boarding_entry_grades'
];

// ─── All valid V2 field names (whitelist — no V1 fields written) ──────────────
const V2_FIELDS = new Set([
  'name','slug','address','city','province_state','country','market_region','lat','lng',
  'transportation_options','grades_served','lowest_grade','highest_grade','school_focus',
  'developmental_priorities','academic_culture','curriculum_pace','languages_of_instruction',
  'is_bilingual','school_type_label','living_arrangements','boarding_available','boarding_type',
  'gender_policy','faith_based','is_faith_based','uniform_required','founded',
  'curriculum','specializations','math_approach','science_approach','language_arts_approach',
  'second_language_approach','homework_by_grade','currency','day_tuition','boarding_tuition',
  'effective_tuition','tuition_notes','financial_aid_available','financial_aid_pct',
  'financial_aid_grades','median_aid_amount','financial_aid_details','scholarships_json',
  'enrollment','avg_enrollment_per_grade','avg_class_size','student_teacher_ratio',
  'acceptance_rate','international_student_pct','boarding_pct','admission_requirements',
  'entrance_requirements','day_entry_grades','boarding_entry_grades','interview_required',
  'interview_grades','ssat_required','day_admission_deadline','boarding_admission_deadline',
  'open_house_dates','sports_programs','sports_programs_other','clubs','clubs_other',
  'arts_programs','arts_programs_other','special_needs_categories','special_ed_programs',
  'safety_policies','additional_support_services','before_after_care_model','before_after_care',
  'mission_statement','description','teaching_philosophy','values','highlights','community_vibe',
  'parent_involvement','diversity_statement','leadership_team','editorial_summary',
  'reviews_summary','notable_alumni','associations','accreditations','website','phone','email',
  'logo_url','header_photo_url','photo_gallery','videos','virtual_tour_url','campus_size',
  'facilities','status','claim_status','school_tier','admin_user_id','data_source',
  'government_id','ai_enriched_fields','verified_fields','import_batch_id',
  'created_at','updated_at','created_by_id','updated_by_id'
]);

// ─── Parse a raw CSV row into a typed V2 School object ────────────────────────
function parseRow(raw) {
  const school = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!V2_FIELDS.has(key)) continue; // drop any non-V2 columns
    if (value === '' || value === null || value === undefined) continue;

    if (BOOLEAN_FIELDS.includes(key)) {
      school[key] = String(value).toLowerCase() === 'true' || value === '1';
    } else if (NUMBER_FIELDS.includes(key)) {
      const n = parseFloat(value);
      if (!isNaN(n)) school[key] = n;
    } else if (ARRAY_FIELDS.includes(key)) {
      school[key] = String(value).split(',').map(s => s.trim()).filter(Boolean);
    } else {
      school[key] = String(value).trim();
    }
  }
  return school;
}

// ─── Dedupe key for a row ─────────────────────────────────────────────────────
function dedupeKey(row) {
  if (row.government_id) return `gov:${row.government_id}`;
  if (row.slug) return `slug:${row.slug}`;
  return `name_city:${(row.name || '').toLowerCase().trim()}|${(row.city || '').toLowerCase().trim()}`;
}

// ─── Find existing School by dedupe key ──────────────────────────────────────
async function findExisting(base44, row) {
  if (row.government_id) {
    const r = await base44.asServiceRole.entities.School.filter({ government_id: row.government_id });
    if (r.length) return r[0];
  }
  if (row.slug) {
    const r = await base44.asServiceRole.entities.School.filter({ slug: row.slug });
    if (r.length) return r[0];
  }
  if (row.name && row.city) {
    const r = await base44.asServiceRole.entities.School.filter({ name: row.name, city: row.city });
    if (r.length) return r[0];
  }
  return null;
}

// ─── Process a single chunk file ─────────────────────────────────────────────
async function processChunk(base44, fileUrl, filename, chunkIndex, totalChunks) {
  console.log(`\n[CHUNK ${chunkIndex}/${totalChunks}] Processing: ${filename}`);

  const csvResponse = await fetch(fileUrl);
  if (!csvResponse.ok) throw new Error(`HTTP ${csvResponse.status} fetching ${filename}`);
  const csvText = await csvResponse.text();

  const result = Papa.parse(csvText, { header: true, dynamicTyping: false, skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error(`CSV parse errors: ${result.errors.slice(0, 3).map(e => e.message).join('; ')}`);
  }

  const rows = result.data || [];
  console.log(`  Rows in file: ${rows.length}`);

  let created = 0, updated = 0, skippedDupes = 0;
  const seenKeysInFile = new Set();
  const rowErrors = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    try {
      const school = parseRow(raw);

      if (!school.name || !school.slug) {
        rowErrors.push(`Row ${i + 1}: missing name or slug — skipped`);
        continue;
      }

      // Within-file duplicate check
      const key = dedupeKey(school);
      if (seenKeysInFile.has(key)) {
        console.warn(`  [DUPE] Row ${i + 1}: duplicate key "${key}" in file — skipped`);
        skippedDupes++;
        continue;
      }
      seenKeysInFile.add(key);

      // DB dedupe
      const existing = await findExisting(base44, school);
      if (existing) {
        await base44.asServiceRole.entities.School.update(existing.id, school);
        updated++;
      } else {
        await base44.asServiceRole.entities.School.create(school);
        created++;
      }

      // Gentle rate limit
      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${rows.length} rows (${created} created, ${updated} updated)`);
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      rowErrors.push(`Row ${i + 1} (${raw.slug || raw.name || '?'}): ${err.message}`);
    }
  }

  const summary = `${filename}: success (${rows.length} rows, ${created} created, ${updated} updated, ${skippedDupes} dupe rows skipped${rowErrors.length ? `, ${rowErrors.length} row errors` : ''})`;
  console.log(`  ✓ ${summary}`);
  if (rowErrors.length) console.warn(`  Row errors:\n  ${rowErrors.join('\n  ')}`);

  return { rowCount: rows.length, created, updated, skippedDupes, rowErrors, summary };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    // fileUrls: array of { filename: 'schools_v2_part_1.csv', url: 'https://...' }
    // OR single: { fileUrl, filename } for backward compat
    let chunks = [];

    if (body.fileUrls && Array.isArray(body.fileUrls)) {
      chunks = body.fileUrls;
    } else if (body.fileUrl) {
      // Backward-compatible single file mode
      chunks = [{ filename: body.filename || 'schools_v2_part_1.csv', url: body.fileUrl }];
    } else {
      return Response.json({ error: 'Provide fileUrls (array) or fileUrl (string)' }, { status: 400 });
    }

    const totalChunks = chunks.length;
    console.log(`\n=== importEnrichedSchools V2 ===`);
    console.log(`Total chunk files: ${totalChunks}`);

    // Load all existing ImportRun records for these filenames
    const allRuns = await base44.asServiceRole.entities.ImportRun.filter({});
    const runMap = {};
    for (const run of allRuns) runMap[run.filename] = run;

    const results = [];
    let skippedChunks = 0, processedChunks = 0;

    for (let i = 0; i < chunks.length; i++) {
      const { filename, url } = chunks[i];
      const existingRun = runMap[filename];

      // Skip already-successful chunks
      if (existingRun?.status === 'success') {
        console.log(`[CHUNK ${i + 1}/${totalChunks}] SKIPPED (already success): ${filename}`);
        skippedChunks++;
        results.push({ filename, status: 'skipped', reason: 'already imported successfully' });
        continue;
      }

      const prevStatus = existingRun?.status || 'none';
      console.log(`[CHUNK ${i + 1}/${totalChunks}] Starting: ${filename} (prev status: ${prevStatus})`);

      // Upsert ImportRun record to "pending"
      let runRecord = existingRun;
      if (runRecord) {
        await base44.asServiceRole.entities.ImportRun.update(runRecord.id, {
          status: 'pending', processedAt: new Date().toISOString(), errorMessage: null
        });
      } else {
        runRecord = await base44.asServiceRole.entities.ImportRun.create({
          filename, status: 'pending', processedAt: new Date().toISOString()
        });
      }

      try {
        const chunkResult = await processChunk(base44, url, filename, i + 1, totalChunks);

        // Mark success
        await base44.asServiceRole.entities.ImportRun.update(runRecord.id, {
          status: 'success',
          processedAt: new Date().toISOString(),
          rowCount: chunkResult.rowCount,
          created: chunkResult.created,
          updated: chunkResult.updated,
          skippedDupes: chunkResult.skippedDupes,
          errorMessage: chunkResult.rowErrors.length > 0
            ? `${chunkResult.rowErrors.length} row-level errors: ${chunkResult.rowErrors.slice(0, 3).join('; ')}`
            : null
        });

        processedChunks++;
        results.push({ filename, status: 'success', ...chunkResult, summary: chunkResult.summary });
      } catch (err) {
        console.error(`[CHUNK ${i + 1}/${totalChunks}] ERROR on ${filename}: ${err.message}`);

        await base44.asServiceRole.entities.ImportRun.update(runRecord.id, {
          status: 'error',
          processedAt: new Date().toISOString(),
          errorMessage: err.message
        });

        results.push({ filename, status: 'error', error: err.message });
        // Don't abort — move to next chunk
      }
    }

    // ─── Final summary ────────────────────────────────────────────────────────
    console.log(`\n=== IMPORT SUMMARY ===`);
    console.log(`Total chunks discovered: ${totalChunks}`);
    console.log(`Already-successful (skipped): ${skippedChunks}`);
    console.log(`Processed in this run: ${processedChunks}`);
    console.log(`Errors: ${results.filter(r => r.status === 'error').length}`);
    console.log(`\nPer-chunk results:`);
    for (const r of results) {
      if (r.summary) console.log(`  ${r.summary}`);
      else if (r.status === 'skipped') console.log(`  ${r.filename}: skipped (${r.reason})`);
      else if (r.status === 'error') console.log(`  ${r.filename}: ERROR — ${r.error}`);
    }

    const totalCreated = results.reduce((sum, r) => sum + (r.created || 0), 0);
    const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0);
    const totalSkippedDupes = results.reduce((sum, r) => sum + (r.skippedDupes || 0), 0);
    const totalRows = results.reduce((sum, r) => sum + (r.rowCount || 0), 0);

    console.log(`\n=== GRAND TOTALS ===`);
    console.log(`Rows processed: ${totalRows}`);
    console.log(`Created: ${totalCreated}`);
    console.log(`Updated: ${totalUpdated}`);
    console.log(`Skipped (dupes): ${totalSkippedDupes}`);

    return Response.json({
      success: true,
      totalChunks,
      skippedChunks,
      processedChunks,
      totals: {
        rows: totalRows,
        created: totalCreated,
        updated: totalUpdated,
        skippedDupes: totalSkippedDupes,
      },
      results
    });

  } catch (error) {
    console.error('[FATAL]', error.message);
    return Response.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
});