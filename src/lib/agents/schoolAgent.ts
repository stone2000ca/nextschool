/**
 * School Agent — "account manager" backbone for school data enrichment
 * E54-S1: Infrastructure only, no UI
 *
 * enrichSchool(schoolId, options?)  — runs enrichment, returns candidate plan
 * applyEnrichment(schoolId, changes) — writes approved changes to school row
 */

import { School, EnrichmentDiff } from '@/lib/entities-server'
import { enrichSchoolFromWebLogic } from '@/lib/functions/enrichSchoolFromWeb'

// ─── Constants ──────────────────────────────────────────────────────

/** Fields that applyEnrichment must never write */
export const SYSTEM_FIELDS = new Set([
  'id', 'slug', 'created_at', 'updated_at', 'created_by', 'created_by_id',
  'status', 'verified', 'claim_status', 'verified_fields',
  'school_tier', 'completeness_score',
  'admin_user_id', 'is_sample', 'source', 'data_source', 'government_id',
  'import_batch_id', 'last_enriched', 'embedding',
])

/** Fields the enrichment pipeline is allowed to propose/write */
export const ENRICHABLE_FIELDS = new Set([
  'name', 'description', 'day_tuition', 'boarding_tuition', 'enrollment',
  'avg_class_size', 'student_teacher_ratio', 'curriculum', 'address', 'city',
  'province_state', 'country', 'phone', 'email', 'website', 'mission_statement',
  'teaching_philosophy', 'specializations', 'arts_programs', 'sports_programs',
  'clubs', 'languages', 'faith_based', 'gender_policy', 'school_type_label',
  'facilities', 'financial_aid_available', 'financial_aid_details',
  'day_admission_deadline', 'admission_requirements', 'entrance_requirements',
  'lowest_grade', 'highest_grade',
])

// ─── Types ──────────────────────────────────────────────────────────

export interface EnrichmentCandidate {
  field: string
  currentValue: string
  proposedValue: string
  confidence: number
  source: string
  sourceUrl: string
}

export interface EnrichmentPlan {
  schoolId: string
  schoolName: string
  batchId: string
  candidates: EnrichmentCandidate[]
}

export interface EnrichmentChange {
  field: string
  value: any
}

export interface ApplyResult {
  schoolId: string
  fieldsUpdated: string[]
  fieldsSkipped: string[]
}

// ─── enrichSchool ───────────────────────────────────────────────────

export interface EnrichSchoolOptions {
  websiteUrl?: string
}

/**
 * Run enrichment for a school. Calls the existing enrichSchoolFromWeb pipeline,
 * then reads back the EnrichmentDiff rows to build a structured plan.
 */
export async function enrichSchool(
  schoolId: string,
  options: EnrichSchoolOptions = {},
): Promise<EnrichmentPlan> {
  if (!schoolId) {
    throw Object.assign(new Error('schoolId is required'), { status: 400 })
  }

  // Run existing enrichment pipeline (creates EnrichmentDiff rows)
  const result = await enrichSchoolFromWebLogic({
    schoolId,
    websiteUrl: options.websiteUrl,
  })

  if (!result.success) {
    throw new Error(result.error || 'Enrichment failed')
  }

  // Read back the diffs for this batch
  const diffs = await EnrichmentDiff.filter(
    { batch_id: result.batchId },
    'created_at',
  )

  const candidates: EnrichmentCandidate[] = diffs.map((diff: any) => ({
    field: diff.field,
    currentValue: diff.current_value ?? '',
    proposedValue: diff.proposed_value ?? '',
    confidence: typeof diff.confidence === 'number' ? diff.confidence : 0,
    source: diff.source ?? '',
    sourceUrl: diff.source_url ?? '',
  }))

  return {
    schoolId,
    schoolName: result.schoolName ?? '',
    batchId: result.batchId!,
    candidates,
  }
}

// ─── applyEnrichment ────────────────────────────────────────────────

/**
 * Write approved enrichment changes to the school row.
 * - Only writes fields in ENRICHABLE_FIELDS
 * - Never writes SYSTEM_FIELDS or verified_fields
 * - Appends written field names to ai_enriched_fields
 */
export async function applyEnrichment(
  schoolId: string,
  changes: EnrichmentChange[],
): Promise<ApplyResult> {
  if (!schoolId) {
    throw Object.assign(new Error('schoolId is required'), { status: 400 })
  }
  if (!changes || changes.length === 0) {
    return { schoolId, fieldsUpdated: [], fieldsSkipped: [] }
  }

  // Read current school to get existing ai_enriched_fields
  const school = await School.get(schoolId)
  if (!school) {
    throw Object.assign(new Error('School not found'), { status: 404 })
  }

  const existingAiFields: string[] = Array.isArray(school.ai_enriched_fields)
    ? school.ai_enriched_fields
    : []

  const fieldsUpdated: string[] = []
  const fieldsSkipped: string[] = []
  const updatePayload: Record<string, any> = {}

  for (const change of changes) {
    // Guard: skip system fields and non-enrichable fields
    if (SYSTEM_FIELDS.has(change.field) || !ENRICHABLE_FIELDS.has(change.field)) {
      fieldsSkipped.push(change.field)
      continue
    }

    updatePayload[change.field] = change.value
    fieldsUpdated.push(change.field)
  }

  if (fieldsUpdated.length > 0) {
    // Merge new field names into ai_enriched_fields (deduplicated)
    const mergedAiFields = Array.from(
      new Set([...existingAiFields, ...fieldsUpdated]),
    )
    updatePayload.ai_enriched_fields = mergedAiFields

    await School.update(schoolId, updatePayload)
  }

  return { schoolId, fieldsUpdated, fieldsSkipped }
}
