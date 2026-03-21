import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────

// Mock entities-server (School + EnrichmentDiff)
const mockSchoolGet = vi.fn()
const mockSchoolUpdate = vi.fn()
const mockSchoolFilter = vi.fn()
const mockEnrichmentDiffFilter = vi.fn()

vi.mock('@/lib/entities-server', () => ({
  School: {
    get: (...args: any[]) => mockSchoolGet(...args),
    update: (...args: any[]) => mockSchoolUpdate(...args),
    filter: (...args: any[]) => mockSchoolFilter(...args),
  },
  EnrichmentDiff: {
    filter: (...args: any[]) => mockEnrichmentDiffFilter(...args),
  },
}))

// Mock enrichSchoolFromWeb
const mockEnrichLogic = vi.fn()
vi.mock('@/lib/functions/enrichSchoolFromWeb', () => ({
  enrichSchoolFromWebLogic: (...args: any[]) => mockEnrichLogic(...args),
}))

import {
  enrichSchool,
  applyEnrichment,
  SYSTEM_FIELDS,
  ENRICHABLE_FIELDS,
} from '../schoolAgent'

// ─── Helpers ────────────────────────────────────────────────────────

function makeSchool(overrides: Record<string, any> = {}) {
  return {
    id: 'school-1',
    name: 'Test School',
    slug: 'test-school',
    description: null,
    city: null,
    province_state: null,
    curriculum: null,
    school_type_label: null,
    ai_enriched_fields: [],
    verified_fields: ['name'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDiffs(fields: { field: string; proposed: string; confidence: number }[]) {
  return fields.map((f, i) => ({
    id: `diff-${i}`,
    school_id: 'school-1',
    field: f.field,
    current_value: '',
    proposed_value: f.proposed,
    confidence: f.confidence,
    source: 'school website',
    source_url: 'https://example.com',
    status: 'pending',
    batch_id: 'school-1_123',
  }))
}

// ─── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('enrichSchool', () => {
  it('returns enrichment plan even for school with only name', async () => {
    const school = makeSchool({ description: null, city: null })
    mockSchoolFilter.mockResolvedValue([school])

    mockEnrichLogic.mockResolvedValue({
      success: true,
      batchId: 'school-1_123',
      diffsCreated: 3,
      schoolName: 'Test School',
    })

    mockEnrichmentDiffFilter.mockResolvedValue(
      makeDiffs([
        { field: 'description', proposed: 'A great school', confidence: 0.9 },
        { field: 'city', proposed: 'Toronto', confidence: 0.9 },
        { field: 'curriculum', proposed: 'IB', confidence: 0.6 },
      ]),
    )

    const plan = await enrichSchool('school-1')

    expect(plan.schoolId).toBe('school-1')
    expect(plan.schoolName).toBe('Test School')
    expect(plan.batchId).toBe('school-1_123')
    expect(plan.candidates).toHaveLength(3)
    expect(plan.candidates[0]).toEqual({
      field: 'description',
      currentValue: '',
      proposedValue: 'A great school',
      confidence: 0.9,
      source: 'school website',
      sourceUrl: 'https://example.com',
    })
  })

  it('throws when schoolId is missing', async () => {
    await expect(enrichSchool('')).rejects.toThrow('schoolId is required')
  })

  it('throws when enrichment fails', async () => {
    mockEnrichLogic.mockResolvedValue({
      success: false,
      error: 'No website URL',
    })

    await expect(enrichSchool('school-1')).rejects.toThrow('No website URL')
  })

  it('only includes candidates where enrichment produced values', async () => {
    mockEnrichLogic.mockResolvedValue({
      success: true,
      batchId: 'school-1_456',
      diffsCreated: 1,
      schoolName: 'Test School',
    })

    // Enrichment only found one field worth proposing
    mockEnrichmentDiffFilter.mockResolvedValue(
      makeDiffs([{ field: 'city', proposed: 'Vancouver', confidence: 0.9 }]),
    )

    const plan = await enrichSchool('school-1')
    expect(plan.candidates).toHaveLength(1)
    expect(plan.candidates[0].field).toBe('city')
  })

  it('passes websiteUrl option through to enrichment logic', async () => {
    mockEnrichLogic.mockResolvedValue({
      success: true,
      batchId: 'school-1_789',
      diffsCreated: 0,
      schoolName: 'Test School',
    })
    mockEnrichmentDiffFilter.mockResolvedValue([])

    await enrichSchool('school-1', { websiteUrl: 'https://custom.url' })

    expect(mockEnrichLogic).toHaveBeenCalledWith({
      schoolId: 'school-1',
      websiteUrl: 'https://custom.url',
    })
  })
})

describe('applyEnrichment', () => {
  it('writes only allowed fields and adds to ai_enriched_fields', async () => {
    const school = makeSchool({ ai_enriched_fields: ['city'] })
    mockSchoolGet.mockResolvedValue(school)
    mockSchoolUpdate.mockResolvedValue({ ...school, description: 'Updated' })

    const result = await applyEnrichment('school-1', [
      { field: 'description', value: 'A great school' },
      { field: 'curriculum', value: 'IB' },
    ])

    expect(result.fieldsUpdated).toEqual(['description', 'curriculum'])
    expect(result.fieldsSkipped).toEqual([])

    // Verify the update call
    const updateCall = mockSchoolUpdate.mock.calls[0]
    expect(updateCall[0]).toBe('school-1')
    expect(updateCall[1].description).toBe('A great school')
    expect(updateCall[1].curriculum).toBe('IB')
    // ai_enriched_fields should merge with existing
    expect(updateCall[1].ai_enriched_fields).toEqual(
      expect.arrayContaining(['city', 'description', 'curriculum']),
    )
  })

  it('does not alter verified_fields', async () => {
    const school = makeSchool({ verified_fields: ['name', 'city'] })
    mockSchoolGet.mockResolvedValue(school)
    mockSchoolUpdate.mockResolvedValue(school)

    await applyEnrichment('school-1', [
      { field: 'description', value: 'Updated' },
    ])

    const updatePayload = mockSchoolUpdate.mock.calls[0][1]
    expect(updatePayload).not.toHaveProperty('verified_fields')
  })

  it('skips system fields (slug, created_at, id, etc.)', async () => {
    const school = makeSchool()
    mockSchoolGet.mockResolvedValue(school)
    mockSchoolUpdate.mockResolvedValue(school)

    const result = await applyEnrichment('school-1', [
      { field: 'slug', value: 'hacked-slug' },
      { field: 'created_at', value: '2020-01-01' },
      { field: 'id', value: 'hacked-id' },
      { field: 'verified_fields', value: ['hacked'] },
      { field: 'description', value: 'Legit update' },
    ])

    expect(result.fieldsSkipped).toEqual(
      expect.arrayContaining(['slug', 'created_at', 'id', 'verified_fields']),
    )
    expect(result.fieldsUpdated).toEqual(['description'])

    const updatePayload = mockSchoolUpdate.mock.calls[0][1]
    expect(updatePayload).not.toHaveProperty('slug')
    expect(updatePayload).not.toHaveProperty('created_at')
    expect(updatePayload).not.toHaveProperty('id')
    expect(updatePayload.description).toBe('Legit update')
  })

  it('skips fields not in ENRICHABLE_FIELDS', async () => {
    const school = makeSchool()
    mockSchoolGet.mockResolvedValue(school)
    mockSchoolUpdate.mockResolvedValue(school)

    const result = await applyEnrichment('school-1', [
      { field: 'totally_made_up_field', value: 'garbage' },
      { field: 'city', value: 'Toronto' },
    ])

    expect(result.fieldsSkipped).toContain('totally_made_up_field')
    expect(result.fieldsUpdated).toEqual(['city'])
  })

  it('returns empty result when no changes provided', async () => {
    const result = await applyEnrichment('school-1', [])
    expect(result.fieldsUpdated).toEqual([])
    expect(result.fieldsSkipped).toEqual([])
    expect(mockSchoolGet).not.toHaveBeenCalled()
  })

  it('throws when schoolId is missing', async () => {
    await expect(
      applyEnrichment('', [{ field: 'name', value: 'x' }]),
    ).rejects.toThrow('schoolId is required')
  })

  it('throws when school not found', async () => {
    mockSchoolGet.mockResolvedValue(null)
    await expect(
      applyEnrichment('nonexistent', [{ field: 'name', value: 'x' }]),
    ).rejects.toThrow('School not found')
  })

  it('deduplicates ai_enriched_fields when field was already enriched', async () => {
    const school = makeSchool({ ai_enriched_fields: ['description', 'city'] })
    mockSchoolGet.mockResolvedValue(school)
    mockSchoolUpdate.mockResolvedValue(school)

    await applyEnrichment('school-1', [
      { field: 'description', value: 'New desc' },
      { field: 'curriculum', value: 'AP' },
    ])

    const aiFields = mockSchoolUpdate.mock.calls[0][1].ai_enriched_fields
    // No duplicate 'description'
    expect(aiFields.filter((f: string) => f === 'description')).toHaveLength(1)
    expect(aiFields).toEqual(
      expect.arrayContaining(['description', 'city', 'curriculum']),
    )
  })
})

describe('integration: enrichSchool + applyEnrichment', () => {
  it('new school → enrichSchool → applyEnrichment → non-empty values for key fields', async () => {
    // Simulate a school with only a name
    const school = makeSchool({
      name: 'Maple Academy',
      description: null,
      city: null,
      school_type_label: null,
      curriculum: null,
      ai_enriched_fields: [],
    })

    mockSchoolGet.mockResolvedValue(school)
    mockSchoolFilter.mockResolvedValue([school])

    // enrichSchoolFromWebLogic produces diffs for identity/branding/type/curriculum
    mockEnrichLogic.mockResolvedValue({
      success: true,
      batchId: 'school-1_integration',
      diffsCreated: 4,
      schoolName: 'Maple Academy',
    })

    mockEnrichmentDiffFilter.mockResolvedValue(
      makeDiffs([
        { field: 'description', proposed: 'A leading independent school in Ontario', confidence: 0.9 },
        { field: 'city', proposed: 'Ottawa', confidence: 0.9 },
        { field: 'school_type_label', proposed: 'Independent', confidence: 0.6 },
        { field: 'curriculum', proposed: 'Ontario Curriculum', confidence: 0.9 },
      ]),
    )

    // Step 1: Get enrichment plan
    const plan = await enrichSchool('school-1')

    expect(plan.candidates.length).toBeGreaterThanOrEqual(4)
    expect(plan.candidates.map((c) => c.field)).toEqual(
      expect.arrayContaining(['description', 'city', 'school_type_label', 'curriculum']),
    )

    // Step 2: Apply all candidates
    mockSchoolUpdate.mockResolvedValue({ ...school, description: 'updated' })

    const changes = plan.candidates.map((c) => ({
      field: c.field,
      value: c.proposedValue,
    }))

    const applyResult = await applyEnrichment('school-1', changes)

    expect(applyResult.fieldsUpdated).toEqual(
      expect.arrayContaining(['description', 'city', 'school_type_label', 'curriculum']),
    )
    expect(applyResult.fieldsSkipped).toEqual([])

    // Verify School.update was called with the right payload
    const payload = mockSchoolUpdate.mock.calls[0][1]
    expect(payload.description).toBe('A leading independent school in Ontario')
    expect(payload.city).toBe('Ottawa')
    expect(payload.school_type_label).toBe('Independent')
    expect(payload.curriculum).toBe('Ontario Curriculum')
    expect(payload.ai_enriched_fields).toEqual(
      expect.arrayContaining(['description', 'city', 'school_type_label', 'curriculum']),
    )
    // verified_fields never touched
    expect(payload).not.toHaveProperty('verified_fields')
  })
})

describe('constants', () => {
  it('SYSTEM_FIELDS includes critical protected fields', () => {
    for (const field of ['id', 'slug', 'created_at', 'updated_at', 'verified_fields']) {
      expect(SYSTEM_FIELDS.has(field)).toBe(true)
    }
  })

  it('ENRICHABLE_FIELDS does not overlap with SYSTEM_FIELDS', () => {
    for (const field of ENRICHABLE_FIELDS) {
      expect(SYSTEM_FIELDS.has(field)).toBe(false)
    }
  })
})
