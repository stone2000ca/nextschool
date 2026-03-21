/// <reference types="vitest" />
import { getSectionStatus, getAllSectionStatuses, PREVIEW_SECTIONS } from '../sectionFields'

describe('getSectionStatus', () => {
  const missionFields = ['mission_statement', 'teaching_philosophy', 'description', 'faith_based']

  it('returns "empty" when no fields have data', () => {
    const school = { mission_statement: null, teaching_philosophy: '', description: undefined }
    expect(getSectionStatus(missionFields, school, [], [])).toBe('empty')
  })

  it('returns "empty" when array fields are empty arrays', () => {
    const fields = ['arts_programs', 'sports_programs']
    const school = { arts_programs: [], sports_programs: [] }
    expect(getSectionStatus(fields, school, [], [])).toBe('empty')
  })

  it('returns "verified" when fields have data but are not AI-enriched', () => {
    const school = { mission_statement: 'We educate leaders', description: 'A great school' }
    expect(getSectionStatus(missionFields, school, [], [])).toBe('verified')
  })

  it('returns "verified" when AI-enriched fields are also verified', () => {
    const school = { mission_statement: 'We educate leaders' }
    const aiFields = ['mission_statement']
    const verifiedFields = ['mission_statement']
    expect(getSectionStatus(missionFields, school, aiFields, verifiedFields)).toBe('verified')
  })

  it('returns "ai-draft" when a field is AI-enriched but NOT verified', () => {
    const school = { mission_statement: 'We educate leaders', description: 'AI generated desc' }
    const aiFields = ['description']
    const verifiedFields = []
    expect(getSectionStatus(missionFields, school, aiFields, verifiedFields)).toBe('ai-draft')
  })

  it('returns "ai-draft" when at least one field is unverified AI, even if others are verified', () => {
    const school = {
      mission_statement: 'Manual entry',
      teaching_philosophy: 'AI content',
      description: 'Verified AI content',
    }
    const aiFields = ['teaching_philosophy', 'description']
    const verifiedFields = ['description']
    expect(getSectionStatus(missionFields, school, aiFields, verifiedFields)).toBe('ai-draft')
  })

  it('ignores AI-enriched fields that have no data in the school row', () => {
    const school = { mission_statement: 'Manual entry' }
    const aiFields = ['description'] // AI enriched but value is undefined
    const verifiedFields = []
    expect(getSectionStatus(missionFields, school, aiFields, verifiedFields)).toBe('verified')
  })

  it('returns "verified" when all populated AI-enriched fields are verified', () => {
    const school = {
      mission_statement: 'AI mission',
      teaching_philosophy: 'AI philosophy',
    }
    const aiFields = ['mission_statement', 'teaching_philosophy']
    const verifiedFields = ['mission_statement', 'teaching_philosophy']
    expect(getSectionStatus(missionFields, school, aiFields, verifiedFields)).toBe('verified')
  })
})

describe('getAllSectionStatuses', () => {
  it('returns statuses for all defined sections', () => {
    const school = { name: 'Test School', city: 'Toronto' }
    const result = getAllSectionStatuses(school, [], [])
    expect(Object.keys(result)).toHaveLength(PREVIEW_SECTIONS.length)
    for (const section of PREVIEW_SECTIONS) {
      expect(result[section.id]).toBeDefined()
    }
  })

  it('marks hero as verified when name has data and no AI enrichment', () => {
    const school = { name: 'Test School', city: 'Toronto' }
    const result = getAllSectionStatuses(school, [], [])
    expect(result.hero).toBe('verified')
  })

  it('marks hero as ai-draft when name is AI-enriched and not verified', () => {
    const school = { name: 'AI School Name', city: 'Toronto' }
    const result = getAllSectionStatuses(school, ['name'], [])
    expect(result.hero).toBe('ai-draft')
  })

  it('marks programs as empty when no program fields have data', () => {
    const school = { name: 'Test School' }
    const result = getAllSectionStatuses(school, [], [])
    expect(result.programs).toBe('empty')
  })

  it('handles mixed statuses across sections', () => {
    const school = {
      name: 'Test School',
      city: 'Toronto',
      curriculum: 'IB',
      facilities: ['gym', 'pool'],
      mission_statement: null,
    }
    const aiFields = ['curriculum']
    const verifiedFields = []
    const result = getAllSectionStatuses(school, aiFields, verifiedFields)
    expect(result.hero).toBe('verified')       // name/city present, not AI
    expect(result.programs).toBe('ai-draft')   // curriculum is AI, not verified
    expect(result.campus).toBe('verified')      // facilities present, not AI
    expect(result.mission).toBe('empty')        // no data
  })
})
