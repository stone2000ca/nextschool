import { School } from '@/lib/entities-server'

// =============================================================================
// Field weight tiers — per PM spec 2026-03-05
// CRITICAL (3x), HIGH (2x), STANDARD (1x)
// System/derived fields are excluded from scoring entirely.
// =============================================================================

const CRITICAL_FIELDS = [
  'name', 'description', 'dayTuition', 'lowestGrade', 'highestGrade',
  'provinceState', 'country', 'genderPolicy', 'schoolTypeLabel', 'city', 'lat', 'lng',
];

const HIGH_FIELDS = [
  'enrollment', 'avgClassSize', 'studentTeacherRatio', 'curriculum',
  'address', 'phone', 'email', 'website', 'missionStatement',
  'headerPhotoUrl',
];

// Fields that are system-managed, derived, or intentionally excluded from scoring
const EXCLUDED_FIELDS = new Set([
  'id', 'createdAt', 'updated_date', 'created_by', 'createdById',
  'slug', 'status', 'verified', 'claimStatus',
  'schoolTier', 'completenessScore',
  'adminUserId', 'is_sample', 'source', 'dataSource', 'governmentId',
  'aiEnrichedFields', 'verifiedFields', 'lastEnriched', 'importBatchId',
  // Excluded profile fields per spec
  'gradeSystem', 'gradesServed', 'heroImage', 'tuition', 'currency',
  'tuitionMin', 'tuitionMax', 'acceptanceRate', 'internationalStudentPct',
  'campusFeel',
]);

const CRITICAL_SET = new Set(CRITICAL_FIELDS);
const HIGH_SET = new Set(HIGH_FIELDS);

const GRADE_FIELDS = new Set(['lowestGrade', 'highestGrade']);
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
    await School.update(school.id, { completenessScore: score });
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
          await School.update(school.id, { completenessScore: score });
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
          await School.update(school.id, { completenessScore: score });
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
