'use client'

import { useState, useMemo } from 'react'
import KeyFactCard, { getCardStatus } from './KeyFactCard'
import { updateSchool } from '@/lib/api/schools'

// ─── Card definitions ───────────────────────────────────────────────
const KEY_FACT_CARDS = [
  {
    id: 'identity_contact',
    number: 1,
    title: 'Identity & Contact',
    description: 'Name, location, and how families reach you.',
    highImpact: true,
    fields: [
      { name: 'name', label: 'School Name', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'address', label: 'Address', type: 'text' },
      { name: 'website', label: 'Website', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'province_state', label: 'Province/State', type: 'text' },
      { name: 'country', label: 'Country', type: 'text' },
    ],
  },
  {
    id: 'branding_media',
    number: 2,
    title: 'Branding & Media',
    description: 'Logo, photos, and virtual tours that showcase your school.',
    highImpact: true,
    fields: [
      { name: 'logo_url', label: 'Logo URL', type: 'image' },
      { name: 'header_photo_url', label: 'Header Photo URL', type: 'image' },
      { name: 'photo_gallery', label: 'Photo Gallery', type: 'tags' },
      { name: 'virtual_tour_url', label: 'Virtual Tour URL', type: 'text' },
    ],
  },
  {
    id: 'type_grades_structure',
    number: 3,
    title: 'Type, Grades & Structure',
    description: 'School type, grade range, and class structure.',
    highImpact: true,
    fields: [
      { name: 'school_type_label', label: 'School Type', type: 'select', options: ['Independent', 'Montessori', 'Waldorf', 'International', 'Religious', 'Arts-Focused', 'STEM-Focused', 'Military', 'Special Needs', 'Online'] },
      { name: 'lowest_grade', label: 'Lowest Grade', type: 'number' },
      { name: 'highest_grade', label: 'Highest Grade', type: 'number' },
      { name: 'gender_policy', label: 'Gender Policy', type: 'select', options: ['Co-ed', 'All-Boys', 'All-Girls', 'Co-ed with single-gender classes'] },
      { name: 'enrollment', label: 'Enrollment', type: 'number' },
      { name: 'avg_class_size', label: 'Avg Class Size', type: 'number' },
      { name: 'student_teacher_ratio', label: 'Student:Teacher Ratio', type: 'text' },
    ],
  },
  {
    id: 'tuition_financial',
    number: 4,
    title: 'Tuition & Financial Aid',
    description: 'Tuition fees, currency, and financial assistance options.',
    highImpact: true,
    fields: [
      { name: 'day_tuition', label: 'Day Tuition', type: 'number' },
      { name: 'boarding_tuition', label: 'Boarding Tuition', type: 'number' },
      { name: 'currency', label: 'Currency', type: 'select', options: ['CAD', 'USD', 'EUR', 'GBP'] },
      { name: 'financial_aid_available', label: 'Financial Aid Available', type: 'boolean' },
      { name: 'financial_aid_pct', label: 'Financial Aid %', type: 'number' },
    ],
  },
  {
    id: 'languages_curriculum',
    number: 5,
    title: 'Languages & Curriculum',
    description: 'Languages of instruction and curriculum frameworks.',
    highImpact: false,
    fields: [
      { name: 'languagesOfInstruction', label: 'Languages of Instruction', type: 'tags' },
      { name: 'curriculum', label: 'Curriculum', type: 'tags' },
      { name: 'specializations', label: 'Specializations', type: 'tags' },
    ],
  },
  {
    id: 'programs_support',
    number: 6,
    title: 'Programs & Learning Support',
    description: 'Extracurriculars, sports, arts, and special ed programs.',
    highImpact: true,
    fields: [
      { name: 'artsPrograms', label: 'Arts Programs', type: 'tags' },
      { name: 'sportsPrograms', label: 'Sports Programs', type: 'tags' },
      { name: 'clubs', label: 'Clubs & Activities', type: 'tags' },
      { name: 'specialEdPrograms', label: 'Special Ed Programs', type: 'tags' },
      { name: 'facilities', label: 'Facilities', type: 'tags' },
    ],
  },
  {
    id: 'mission_values',
    number: 7,
    title: 'Mission & Values',
    description: 'Mission statement, school description, and core values.',
    highImpact: false,
    fields: [
      { name: 'mission_statement', label: 'Mission Statement', type: 'textarea' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'teaching_philosophy', label: 'Teaching Philosophy', type: 'textarea' },
      { name: 'values', label: 'Values', type: 'tags' },
    ],
  },
  {
    id: 'campus_life',
    number: 8,
    title: 'Campus Life Snapshot',
    description: 'Campus feel, living arrangements, and school highlights.',
    highImpact: false,
    fields: [
      { name: 'campus_feel', label: 'Campus Feel', type: 'select', options: ['Warm and nurturing', 'Rigorous and structured', 'Progressive and creative', 'Traditional and formal'] },
      { name: 'living_arrangements', label: 'Living Arrangements', type: 'tags' },
      { name: 'before_after_care', label: 'Before/After Care', type: 'text' },
      { name: 'highlights', label: 'Highlights', type: 'tags' },
    ],
  },
  {
    id: 'admissions_snapshot',
    number: 9,
    title: 'Admissions Snapshot',
    description: 'Admission requirements, acceptance rate, and open houses.',
    highImpact: false,
    fields: [
      { name: 'admission_requirements', label: 'Admission Requirements', type: 'tags' },
      { name: 'acceptance_rate', label: 'Acceptance Rate (%)', type: 'number' },
      { name: 'interview_required', label: 'Interview Required', type: 'boolean' },
      { name: 'open_house_dates', label: 'Open House Dates', type: 'text' },
    ],
  },
]

// ─── Main tab component ─────────────────────────────────────────────
export default function KeyFactsTab({ school, onSchoolUpdate }) {
  const [confirmingCard, setConfirmingCard] = useState(null)
  const [localSchool, setLocalSchool] = useState(school)

  // Compute confirmed count
  const confirmedCount = useMemo(() => {
    return KEY_FACT_CARDS.filter(card => {
      const status = getCardStatus(
        card.fields.map(f => f.name),
        localSchool,
        localSchool?.ai_enriched_fields || localSchool?.aiEnrichedFields,
        localSchool?.verified_fields || localSchool?.verifiedFields,
      )
      return status === 'confirmed'
    }).length
  }, [localSchool])

  const aiEnrichedFields = localSchool?.ai_enriched_fields || localSchool?.aiEnrichedFields || []
  const verifiedFields = localSchool?.verified_fields || localSchool?.verifiedFields || {}

  // Merge verified_fields — supports both object {field: true} and array formats
  function mergeVerified(existing, newFields) {
    const obj = typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {}
    if (Array.isArray(existing)) {
      existing.forEach(f => { obj[f] = true })
    }
    newFields.forEach(f => { obj[f] = true })
    return obj
  }

  const handleConfirmAll = async (cardId, fieldNames) => {
    setConfirmingCard(cardId)
    try {
      const updatedVerified = mergeVerified(verifiedFields, fieldNames)
      await updateSchool(localSchool.id, { verified_fields: updatedVerified })
      const updated = { ...localSchool, verified_fields: updatedVerified }
      setLocalSchool(updated)
      onSchoolUpdate?.(updated)
    } catch (err) {
      console.error('Failed to confirm fields:', err)
    } finally {
      setConfirmingCard(null)
    }
  }

  const handleSaveEdits = async (cardId, editedValues) => {
    const card = KEY_FACT_CARDS.find(c => c.id === cardId)
    if (!card) return

    try {
      const fieldNames = card.fields.map(f => f.name)
      const updatedVerified = mergeVerified(verifiedFields, fieldNames)
      const payload = { ...editedValues, verified_fields: updatedVerified }
      await updateSchool(localSchool.id, payload)
      const updated = { ...localSchool, ...editedValues, verified_fields: updatedVerified }
      setLocalSchool(updated)
      onSchoolUpdate?.(updated)
    } catch (err) {
      console.error('Failed to save edits:', err)
    }
  }

  const progressPct = Math.round((confirmedCount / KEY_FACT_CARDS.length) * 100)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header + progress */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Key Facts</h2>
        <p className="text-sm text-slate-500 mt-1">
          Review and confirm AI-enriched school data across 9 key areas.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">
            {confirmedCount} of {KEY_FACT_CARDS.length} key fact groups confirmed
          </span>
          <span className="text-sm font-bold text-teal-700">{progressPct}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-teal-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {KEY_FACT_CARDS.map(card => (
          <KeyFactCard
            key={card.id}
            card={card}
            schoolData={localSchool}
            aiEnrichedFields={aiEnrichedFields}
            verifiedFields={verifiedFields}
            onConfirmAll={handleConfirmAll}
            onSaveEdits={handleSaveEdits}
            isConfirming={confirmingCard === card.id}
          />
        ))}
      </div>
    </div>
  )
}
