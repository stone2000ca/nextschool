// Function: importEnrichedSchools
// Purpose: Import V2-schema enriched school CSVs in chunks with deduplication
// Entities: School, ImportRun
// Last Modified: 2026-03-16

import { School, ImportRun } from '@/lib/entities-server'
import Papa from 'papaparse'

const BOOLEAN_FIELDS = ['boarding_available', 'is_bilingual', 'is_faith_based', 'uniform_required', 'financial_aid_available', 'interview_required', 'ssat_required'];
const NUMBER_FIELDS = ['lat', 'lng', 'founded', 'day_tuition', 'boarding_tuition', 'effective_tuition', 'enrollment', 'avg_enrollment_per_grade', 'avg_class_size', 'acceptance_rate', 'international_student_pct', 'boarding_pct', 'financial_aid_pct', 'median_aid_amount'];
const ARRAY_FIELDS = ['languages_of_instruction', 'living_arrangements', 'developmental_priorities', 'curriculum', 'specializations', 'sports_programs', 'clubs', 'arts_programs', 'special_needs_categories', 'special_ed_programs', 'additional_support_services', 'values', 'highlights', 'facilities', 'photo_gallery', 'videos', 'ai_enriched_fields', 'notable_alumni', 'associations', 'accreditations', 'admission_requirements', 'day_entry_grades', 'boarding_entry_grades'];
const V2_FIELDS = new Set(['name','slug','address','city','province_state','country','market_region','lat','lng','transportation_options','grades_served','lowest_grade','highest_grade','school_focus','developmental_priorities','academic_culture','curriculum_pace','languages_of_instruction','is_bilingual','school_type_label','living_arrangements','boarding_available','boarding_type','gender_policy','faith_based','is_faith_based','uniform_required','founded','curriculum','specializations','math_approach','science_approach','language_arts_approach','second_language_approach','homework_by_grade','currency','day_tuition','boarding_tuition','effective_tuition','tuition_notes','financial_aid_available','financial_aid_pct','financial_aid_grades','median_aid_amount','financial_aid_details','scholarships_json','enrollment','avg_enrollment_per_grade','avg_class_size','student_teacher_ratio','acceptance_rate','international_student_pct','boarding_pct','admission_requirements','entrance_requirements','day_entry_grades','boarding_entry_grades','interview_required','interview_grades','ssat_required','day_admission_deadline','boarding_admission_deadline','open_house_dates','sports_programs','sports_programs_other','clubs','clubs_other','arts_programs','arts_programs_other','special_needs_categories','special_ed_programs','safety_policies','additional_support_services','before_after_care_model','before_after_care','mission_statement','description','teaching_philosophy','values','highlights','community_vibe','parent_involvement','diversity_statement','leadership_team','editorial_summary','reviews_summary','notable_alumni','associations','accreditations','website','phone','email','logo_url','header_photo_url','photo_gallery','videos','virtual_tour_url','campus_size','facilities','status','claim_status','school_tier','admin_user_id','data_source','government_id','ai_enriched_fields','verified_fields','import_batch_id','created_at','updated_at','created_by_id','updated_by_id']);

function parseRow(raw: any) {
  const school: any = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!V2_FIELDS.has(key)) continue;
    if (value === '' || value === null || value === undefined) continue;
    if (BOOLEAN_FIELDS.includes(key)) school[key] = String(value).toLowerCase() === 'true' || value === '1';
    else if (NUMBER_FIELDS.includes(key)) { const n = parseFloat(value as string); if (!isNaN(n)) school[key] = n; }
    else if (ARRAY_FIELDS.includes(key)) school[key] = String(value).split(',').map(s => s.trim()).filter(Boolean);
    else school[key] = String(value).trim();
  }
  return school;
}

function dedupeKey(row: any) {
  if (row.government_id) return `gov:${row.government_id}`;
  if (row.slug) return `slug:${row.slug}`;
  return `name_city:${(row.name || '').toLowerCase().trim()}|${(row.city || '').toLowerCase().trim()}`;
}

async function findExisting(row: any) {
  if (row.government_id) { const r = await School.filter({ government_id: row.government_id }); if (r.length) return r[0]; }
  if (row.slug) { const r = await School.filter({ slug: row.slug }); if (r.length) return r[0]; }
  if (row.name && row.city) { const r = await School.filter({ name: row.name, city: row.city }); if (r.length) return r[0]; }
  return null;
}

async function processChunk(fileUrl: string, filename: string, chunkIndex: number, totalChunks: number) {
  console.log(`\n[CHUNK ${chunkIndex}/${totalChunks}] Processing: ${filename}`);
  const csvResponse = await fetch(fileUrl);
  if (!csvResponse.ok) throw new Error(`HTTP ${csvResponse.status} fetching ${filename}`);
  const csvText = await csvResponse.text();
  const result = Papa.parse(csvText, { header: true, dynamicTyping: false, skipEmptyLines: true });
  if (result.errors.length > 0) throw new Error(`CSV parse errors: ${result.errors.slice(0, 3).map(e => e.message).join('; ')}`);

  const rows = result.data || [];
  let created = 0, updated = 0, skippedDupes = 0;
  const seenKeysInFile = new Set();
  const rowErrors: string[] = [];

  for (let i = 0; i < (rows as any[]).length; i++) {
    const raw = (rows as any[])[i];
    try {
      const school = parseRow(raw);
      if (!school.name || !school.slug) { rowErrors.push(`Row ${i + 1}: missing name or slug`); continue; }
      const key = dedupeKey(school);
      if (seenKeysInFile.has(key)) { skippedDupes++; continue; }
      seenKeysInFile.add(key);
      const existing = await findExisting(school);
      if (existing) { await School.update(existing.id, school); updated++; }
      else { await School.create(school); created++; }
      if ((i + 1) % 10 === 0) await new Promise(r => setTimeout(r, 100));
    } catch (err: any) { rowErrors.push(`Row ${i + 1}: ${err.message}`); }
  }

  return { rowCount: (rows as any[]).length, created, updated, skippedDupes, rowErrors, summary: `${filename}: ${created} created, ${updated} updated` };
}

export async function importEnrichedSchoolsLogic(params: any) {
  let chunks: any[] = [];
  if (params.fileUrls && Array.isArray(params.fileUrls)) chunks = params.fileUrls;
  else if (params.fileUrl) chunks = [{ filename: params.filename || 'schools_v2_part_1.csv', url: params.fileUrl }];
  else throw Object.assign(new Error('Provide fileUrls (array) or fileUrl (string)'), { status: 400 });

  const totalChunks = chunks.length;
  const allRuns = await ImportRun.filter({});
  const runMap: any = {};
  for (const run of allRuns) runMap[run.filename] = run;

  const results: any[] = [];
  let skippedChunks = 0, processedChunks = 0;

  for (let i = 0; i < chunks.length; i++) {
    const { filename, url } = chunks[i];
    const existingRun = runMap[filename];
    if (existingRun?.status === 'success') { skippedChunks++; results.push({ filename, status: 'skipped', reason: 'already imported' }); continue; }

    let runRecord = existingRun;
    if (runRecord) await ImportRun.update(runRecord.id, { status: 'pending', processedAt: new Date().toISOString(), errorMessage: null });
    else runRecord = await ImportRun.create({ filename, status: 'pending', processedAt: new Date().toISOString() });

    try {
      const chunkResult = await processChunk(url, filename, i + 1, totalChunks);
      await ImportRun.update(runRecord.id, { status: 'success', processedAt: new Date().toISOString(), rowCount: chunkResult.rowCount, created: chunkResult.created, updated: chunkResult.updated, skippedDupes: chunkResult.skippedDupes, errorMessage: chunkResult.rowErrors.length > 0 ? `${chunkResult.rowErrors.length} row errors` : null });
      processedChunks++;
      results.push({ filename, status: 'success', ...chunkResult });
    } catch (err: any) {
      await ImportRun.update(runRecord.id, { status: 'error', processedAt: new Date().toISOString(), errorMessage: err.message });
      results.push({ filename, status: 'error', error: err.message });
    }
  }

  const totalCreated = results.reduce((sum, r) => sum + (r.created || 0), 0);
  const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0);

  return { success: true, totalChunks, skippedChunks, processedChunks, totals: { created: totalCreated, updated: totalUpdated }, results };
}
