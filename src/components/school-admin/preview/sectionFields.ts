/**
 * Section-to-field mapping for SchoolPreviewTab.
 * Used to compute per-section AI draft vs verified labels.
 */

export interface SectionDef {
  id: string
  label: string
  fields: string[]
}

export const PREVIEW_SECTIONS: SectionDef[] = [
  {
    id: 'hero',
    label: 'Hero',
    fields: ['name', 'address', 'city', 'province_state', 'country'],
  },
  {
    id: 'key-facts',
    label: 'Key Facts',
    fields: [
      'school_type_label', 'lowest_grade', 'highest_grade',
      'day_tuition', 'boarding_tuition', 'enrollment',
      'avg_class_size', 'student_teacher_ratio',
    ],
  },
  {
    id: 'mission',
    label: 'Mission & Values',
    fields: ['mission_statement', 'teaching_philosophy', 'description', 'faith_based'],
  },
  {
    id: 'programs',
    label: 'Programs & Support',
    fields: [
      'curriculum', 'specializations', 'arts_programs',
      'sports_programs', 'clubs', 'languages',
    ],
  },
  {
    id: 'campus',
    label: 'Campus Life',
    fields: ['facilities'],
  },
  {
    id: 'admissions',
    label: 'Admissions',
    fields: [
      'day_admission_deadline', 'admission_requirements',
      'entrance_requirements', 'financial_aid_available',
      'financial_aid_details',
    ],
  },
]

export type SectionStatus = 'ai-draft' | 'verified' | 'empty'

/**
 * Compute per-section label status.
 *
 * - 'ai-draft': at least one field in the section is in ai_enriched_fields
 *   AND that same field is NOT in verified_fields
 * - 'verified': all non-empty fields in the section are verified (or not AI-enriched)
 * - 'empty': no fields in the section have any data
 */
export function getSectionStatus(
  sectionFields: string[],
  school: Record<string, any>,
  aiEnrichedFields: string[],
  verifiedFields: string[],
): SectionStatus {
  const aiSet = new Set(aiEnrichedFields)
  const verifiedSet = new Set(verifiedFields)

  // Check if any field in section has a non-empty value
  const populatedFields = sectionFields.filter((f) => {
    const val = school[f]
    if (val === null || val === undefined || val === '') return false
    if (Array.isArray(val) && val.length === 0) return false
    return true
  })

  if (populatedFields.length === 0) return 'empty'

  // Check if any populated field is AI-enriched but NOT verified
  const hasUnverifiedAi = populatedFields.some(
    (f) => aiSet.has(f) && !verifiedSet.has(f),
  )

  return hasUnverifiedAi ? 'ai-draft' : 'verified'
}

/**
 * Compute statuses for all preview sections at once.
 */
export function getAllSectionStatuses(
  school: Record<string, any>,
  aiEnrichedFields: string[],
  verifiedFields: string[],
): Record<string, SectionStatus> {
  const result: Record<string, SectionStatus> = {}
  for (const section of PREVIEW_SECTIONS) {
    result[section.id] = getSectionStatus(
      section.fields,
      school,
      aiEnrichedFields,
      verifiedFields,
    )
  }
  return result
}
