import { School } from '@/lib/entities-server'

// =============================================================================
// Field weight tiers — per PM spec 2026-03-05
// CRITICAL (3x), HIGH (2x), STANDARD (1x)
// System/derived fields are excluded from scoring entirely.
// =============================================================================

const CRITICAL_FIELDS = [
  'name', 'description', 'day_tuition', 'lowest_grade', 'highest_grade',
  'province_state', 'country', 'gender_policy', 'school_type_label', 'city', 'lat', 'lng',
];

const HIGH_FIELDS = [
  'enrollment', 'avg_class_size', 'student_teacher_ratio', 'curriculum',
  'address', 'phone', 'email', 'website', 'mission_statement',
  'header_photo_url',
];

// Fields that are system-managed, derived, or intentionally excluded from scoring
const EXCLUDED_FIELDS = new Set([
  'id', 'created_at', 'updated_at', 'created_by', 'created_by_id',
  'slug', 'status', 'verified', 'claim_status',
  'school_tier', 'completeness_score',
  'admin_user_id', 'is_sample', 'source', 'data_source', 'government_id',
  'ai_enriched_fields', 'verified_fields', 'last_enriched', 'import_batch_id',
  // Excluded profile fields per spec
  'grade_system', 'grades_served', 'hero_image', 'tuition', 'currency',
  'tuition_min', 'tuition_max', 'acceptance_rate', 'international_student_pct',
  'campus_feel',
]);

const CRITICAL_SET = new Set(CRITICAL_FIELDS);
const HIGH_SET = new Set(HIGH_FIELDS);

const GRADE_FIELDS = new Set(['lowest_grade', 'highest_grade']);
const PLACEHOLDER_STRINGS = new Set(['', 'n/a', 'not available', 'unknown', 'tbd']);

function isFieldPopulated(value: any, fieldName: string): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') {
    return !PLACEHOLDER_STRINGS.has(value.trim().toLowerCase());
  }
  if (typeof value === 'number') {
    if (GRADE_FIELDS.has(fieldName)) return true;
    return value !== 0;
  }
  return true;
}

function weightFor(fieldName: string): number {
  if (CRITICAL_SET.has(fieldName)) return 3;
  if (HIGH_SET.has(fieldName)) return 2;
  return 1;
}

export function calculateScore(school: any): number {
  let earnedWeight = 0;
  let totalWeight = 0;

  // Score all schema fields that are not excluded
  const allScoredFields = new Set([
    ...CRITICAL_FIELDS,
    ...HIGH_FIELDS,
  ]);

  // Add any additional fields present on the object that aren't excluded and aren't already scored
  for (const key of Object.keys(school)) {
    if (!EXCLUDED_FIELDS.has(key) && !allScoredFields.has(key)) {
      allScoredFields.add(key);
    }
  }

  for (const fieldName of allScoredFields) {
    if (EXCLUDED_FIELDS.has(fieldName)) continue;
    const w = weightFor(fieldName);
    totalWeight += w;
    if (isFieldPopulated(school[fieldName], fieldName)) {
      earnedWeight += w;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((earnedWeight / totalWeight) * 100);
}

export async function calculateCompletenessScore(params: {
  schoolId?: string
  backfill?: boolean
  limit?: number
  skip?: number
  userRole?: string
}) {
  const { schoolId, backfill, limit: batchLimit, skip: batchSkip, userRole } = params;

  // Mode 1: single school by id (post-save hook)
  if (schoolId) {
    const schools = await School.filter({ id: schoolId });
    if (!schools || schools.length === 0) {
      throw Object.assign(new Error('School not found'), { statusCode: 404 });
    }
    const school = schools[0];
    const score = calculateScore(school);
    await School.update(school.id, { completeness_score: score });
    return { schoolId: school.id, completenessScore: score };
  }

  // Mode 2: batch backfill (admin only)
  if (backfill === true) {
    if (userRole !== 'admin') {
      throw Object.assign(new Error('Forbidden: Admin only'), { statusCode: 403 });
    }
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const errors: Array<{ schoolId: string; error: string }> = [];

    // --- Paginated single-batch mode (caller controls pagination) ---
    if (batchLimit != null) {
      const startSkip = batchSkip || 0;
      // Fetch all and slice to simulate skip/limit since the adapter doesn't support offset
      const allSchools = await School.filter({}, undefined, startSkip + batchLimit);
      const batch = (allSchools || []).slice(startSkip, startSkip + batchLimit);
      let processed = 0;

      for (const school of batch || []) {
        try {
          const score = calculateScore(school);
          await School.update(school.id, { completeness_score: score });
          processed++;
        } catch (err: any) {
          errors.push({ schoolId: school.id, error: err.message });
        }
        await delay(150);
      }

      const hasMore = (batch || []).length === batchLimit;
      return { processed, skipped: startSkip, hasMore, errors };
    }

    // --- Full backfill mode (original behavior: process all schools) ---
    const limit = 20;
    let skip = 0;
    let totalProcessed = 0;
    let totalUpdated = 0;

    while (true) {
      const allSchools = await School.filter({}, undefined, skip + limit);
      const batch = (allSchools || []).slice(skip, skip + limit);
      if (!batch || batch.length === 0) break;

      for (const school of batch) {
        totalProcessed++;
        try {
          const score = calculateScore(school);
          await School.update(school.id, { completeness_score: score });
          totalUpdated++;
        } catch (err: any) {
          errors.push({ schoolId: school.id, error: err.message });
        }
        await delay(150);
      }

      if (batch.length < limit) break;
      skip += limit;
    }

    return { totalProcessed, totalUpdated, errors };
  }

  throw Object.assign(new Error('Provide schoolId or backfill:true'), { statusCode: 400 });
}
