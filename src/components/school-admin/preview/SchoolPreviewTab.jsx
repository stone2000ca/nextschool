'use client'

import { useMemo } from 'react'
import {
  MapPin, GraduationCap, DollarSign, Users, ExternalLink,
  Sparkles, BookOpen, Music, Trophy, Globe, ShieldCheck, Heart,
  Building2, Calendar, FileText, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  PREVIEW_SECTIONS,
  getAllSectionStatuses,
} from './sectionFields'

// ─── Helpers ────────────────────────────────────────────────────────

function gradeLabel(grade) {
  if (grade === null || grade === undefined) return '?'
  if (grade === -2) return 'PK'
  if (grade === -1) return 'JK'
  if (grade === 0) return 'K'
  return String(grade)
}

function formatCurrency(amount, currency = 'CAD') {
  const sym = { CAD: 'CA$', USD: '$', EUR: '€', GBP: '£' }[currency] || '$'
  if (!amount) return null
  return `${sym}${Number(amount).toLocaleString()}`
}

function joinList(arr) {
  if (!arr || arr.length === 0) return ''
  return arr.join(', ')
}

// ─── AI Draft Pill ──────────────────────────────────────────────────

function AiDraftPill() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <Sparkles className="h-3 w-3" />
      AI draft — Not yet confirmed
    </span>
  )
}

// ─── Edit with AI Pill ──────────────────────────────────────────────

function EditWithAiPill({ section, fields, onEditWithAi }) {
  return (
    <button
      onClick={() => onEditWithAi?.({ section, fields })}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
        bg-teal-50 text-teal-700 border border-teal-200
        hover:bg-teal-100 hover:border-teal-300 transition-colors cursor-pointer"
    >
      <Sparkles className="h-3 w-3" />
      Edit with AI
    </button>
  )
}

// ─── Section Wrapper ────────────────────────────────────────────────

function PreviewSection({ id, title, icon: Icon, status, sectionDef, onEditWithAi, children }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-slate-500" />}
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {status === 'ai-draft' && <AiDraftPill />}
        </div>
        {sectionDef && (
          <EditWithAiPill
            section={sectionDef.id}
            fields={sectionDef.fields}
            onEditWithAi={onEditWithAi}
          />
        )}
      </div>
      {children}
    </section>
  )
}

// ─── Chip List ──────────────────────────────────────────────────────

function ChipList({ items, icon: Icon }) {
  if (!items || items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-slate-100 text-slate-700"
        >
          {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
          {item}
        </span>
      ))}
    </div>
  )
}

// ─── Key Fact Item ──────────────────────────────────────────────────

function KeyFact({ label, value, icon: Icon }) {
  if (!value) return null
  return (
    <div className="flex flex-col items-center text-center p-3 bg-slate-50 rounded-lg">
      {Icon && <Icon className="h-5 w-5 text-teal-600 mb-1" />}
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════

/**
 * SchoolPreviewTab — read-only parent-facing preview of a school profile.
 *
 * Props:
 *   school          — full school row from DB
 *   onEditWithAi    — callback({ section, fields }) when "Edit with AI" is clicked
 *                     (wiring to chat pane deferred to Sprint 6)
 */
export default function SchoolPreviewTab({ school, onEditWithAi }) {
  const aiEnrichedFields = Array.isArray(school.ai_enriched_fields)
    ? school.ai_enriched_fields
    : []
  const verifiedFields = Array.isArray(school.verified_fields)
    ? school.verified_fields
    : []

  const statuses = useMemo(
    () => getAllSectionStatuses(school, aiEnrichedFields, verifiedFields),
    [school, aiEnrichedFields, verifiedFields],
  )

  const sectionMap = useMemo(() => {
    const map = {}
    for (const s of PREVIEW_SECTIONS) map[s.id] = s
    return map
  }, [])

  // Grade range
  const gradeRange =
    school.grades_served ||
    (school.lowest_grade != null && school.highest_grade != null
      ? `${gradeLabel(school.lowest_grade)} – ${gradeLabel(school.highest_grade)}`
      : null)

  const currency = school.currency || 'CAD'
  const publicUrl = `/school/${school.slug || school.id}`

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* ── Top bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Profile Preview</h2>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5"
        >
          <Button variant="outline" size="sm" className="gap-1.5">
            <ExternalLink className="h-4 w-4" />
            View as parent
          </Button>
        </a>
      </div>

      {/* ── 1. Hero ────────────────────────────────────────────── */}
      <PreviewSection
        id="hero"
        title="Hero"
        icon={Building2}
        status={statuses.hero}
        sectionDef={sectionMap.hero}
        onEditWithAi={onEditWithAi}
      >
        <div className="relative rounded-lg overflow-hidden bg-slate-200 h-48">
          {school.header_photo_url ? (
            <img
              src={school.header_photo_url}
              alt={`${school.name} campus`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              No header photo
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <div className="flex items-center gap-3">
              {school.logo_url && (
                <img
                  src={school.logo_url}
                  alt={`${school.name} logo`}
                  className="h-10 w-10 rounded-lg bg-white p-1 object-contain"
                />
              )}
              <div>
                <h4 className="text-xl font-bold">{school.name}</h4>
                {(school.city || school.province_state) && (
                  <p className="text-sm text-white/80 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {[school.address, school.city, school.province_state]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </PreviewSection>

      {/* ── 2. Key Facts Strip ─────────────────────────────────── */}
      <PreviewSection
        id="key-facts"
        title="Key Facts"
        icon={GraduationCap}
        status={statuses['key-facts']}
        sectionDef={sectionMap['key-facts']}
        onEditWithAi={onEditWithAi}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KeyFact
            label="School Type"
            value={school.school_type_label || school.school_type}
            icon={Building2}
          />
          <KeyFact
            label="Grades"
            value={gradeRange}
            icon={GraduationCap}
          />
          <KeyFact
            label="Day Tuition"
            value={formatCurrency(school.day_tuition, currency)}
            icon={DollarSign}
          />
          <KeyFact
            label="Boarding Tuition"
            value={formatCurrency(school.boarding_tuition, currency)}
            icon={DollarSign}
          />
          <KeyFact
            label="Enrollment"
            value={school.enrollment ? `${school.enrollment} students` : null}
            icon={Users}
          />
          <KeyFact
            label="Avg Class Size"
            value={school.avg_class_size ? `${school.avg_class_size} students` : null}
            icon={Users}
          />
          <KeyFact
            label="Student-Teacher Ratio"
            value={school.student_teacher_ratio}
            icon={Users}
          />
        </div>
      </PreviewSection>

      {/* ── 3. Mission & Values ────────────────────────────────── */}
      <PreviewSection
        id="mission"
        title="Mission & Values"
        icon={Heart}
        status={statuses.mission}
        sectionDef={sectionMap.mission}
        onEditWithAi={onEditWithAi}
      >
        {school.mission_statement ? (
          <blockquote className="border-l-4 border-teal-500 pl-4 my-2 text-slate-700 italic">
            {school.mission_statement}
          </blockquote>
        ) : (
          <p className="text-sm text-slate-400 italic">No mission statement provided</p>
        )}

        {school.description && (
          <p className="text-slate-700 leading-relaxed mt-3">{school.description}</p>
        )}

        {school.teaching_philosophy && (
          <div className="mt-3">
            <span className="text-sm font-medium text-slate-500">Teaching Philosophy</span>
            <p className="text-slate-700 mt-0.5">{school.teaching_philosophy}</p>
          </div>
        )}

        {school.faith_based && (
          <div className="mt-3">
            <span className="text-sm font-medium text-slate-500">Faith Tradition</span>
            <p className="text-slate-700 mt-0.5">{school.faith_based}</p>
          </div>
        )}

        {!school.mission_statement && !school.description && !school.teaching_philosophy && !school.faith_based && (
          <p className="text-sm text-slate-400 italic">No mission or values information yet</p>
        )}
      </PreviewSection>

      {/* ── 4. Programs & Support ──────────────────────────────── */}
      <PreviewSection
        id="programs"
        title="Programs & Support"
        icon={BookOpen}
        status={statuses.programs}
        sectionDef={sectionMap.programs}
        onEditWithAi={onEditWithAi}
      >
        <div className="space-y-4">
          {school.curriculum && (
            <div>
              <span className="text-sm font-medium text-slate-500">Curriculum</span>
              <p className="text-slate-700 mt-0.5">
                {Array.isArray(school.curriculum)
                  ? school.curriculum.join(', ')
                  : school.curriculum}
              </p>
            </div>
          )}

          {school.specializations?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-slate-500 block mb-1">Specializations</span>
              <ChipList items={school.specializations} icon={Sparkles} />
            </div>
          )}

          {school.arts_programs?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-slate-500 block mb-1">Arts Programs</span>
              <ChipList items={school.arts_programs} icon={Music} />
            </div>
          )}

          {school.sports_programs?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-slate-500 block mb-1">Sports Programs</span>
              <ChipList items={school.sports_programs} icon={Trophy} />
            </div>
          )}

          {school.clubs?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-slate-500 block mb-1">Clubs</span>
              <ChipList items={school.clubs} />
            </div>
          )}

          {school.languages?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-slate-500 block mb-1">Languages</span>
              <ChipList items={school.languages} icon={Globe} />
            </div>
          )}

          {!school.curriculum && !school.specializations?.length && !school.arts_programs?.length &&
           !school.sports_programs?.length && !school.clubs?.length && !school.languages?.length && (
            <p className="text-sm text-slate-400 italic">No programs information yet</p>
          )}
        </div>
      </PreviewSection>

      {/* ── 5. Campus Life ─────────────────────────────────────── */}
      <PreviewSection
        id="campus"
        title="Campus Life"
        icon={Building2}
        status={statuses.campus}
        sectionDef={sectionMap.campus}
        onEditWithAi={onEditWithAi}
      >
        {school.facilities?.length > 0 ? (
          <div>
            <span className="text-sm font-medium text-slate-500 block mb-1">Facilities</span>
            <ChipList items={school.facilities} icon={ShieldCheck} />
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No campus information yet</p>
        )}
      </PreviewSection>

      {/* ── 6. Admissions ──────────────────────────────────────── */}
      <PreviewSection
        id="admissions"
        title="Admissions"
        icon={FileText}
        status={statuses.admissions}
        sectionDef={sectionMap.admissions}
        onEditWithAi={onEditWithAi}
      >
        <div className="space-y-3">
          {school.day_admission_deadline && (
            <div>
              <span className="text-sm font-medium text-slate-500">Application Deadline</span>
              <p className="text-slate-700 mt-0.5">{school.day_admission_deadline}</p>
            </div>
          )}

          {(school.admission_requirements?.length > 0 || school.entrance_requirements?.length > 0) && (
            <div>
              <span className="text-sm font-medium text-slate-500 block mb-1">Requirements</span>
              <ChipList
                items={school.admission_requirements || school.entrance_requirements}
                icon={ChevronRight}
              />
            </div>
          )}

          {school.financial_aid_available && (
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">Financial aid available</span>
            </div>
          )}

          {school.financial_aid_details && (
            <div>
              <span className="text-sm font-medium text-slate-500">Financial Aid Details</span>
              <p className="text-slate-700 mt-0.5">{school.financial_aid_details}</p>
            </div>
          )}

          {!school.day_admission_deadline && !school.admission_requirements?.length &&
           !school.entrance_requirements?.length && !school.financial_aid_available && (
            <p className="text-sm text-slate-400 italic">No admissions information yet</p>
          )}
        </div>
      </PreviewSection>
    </div>
  )
}
