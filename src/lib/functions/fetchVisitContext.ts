// E51-S3B: Fetch visit data for AI context injection
// Sources: visit_records table + school_journeys JSONB in family_journeys
// Returns a formatted context block string (or null if no visit data)

import { VisitRecord, FamilyJourney, School } from '@/lib/entities-server'

interface VisitContextEntry {
  schoolName: string
  schoolId: string
  visitDate?: string
  eventType?: string
  impression?: string
  standoutMoments?: string
  concerns?: string
  wouldVisitAgain?: string
  visitVerdict?: string
  postVisitFitLabel?: string
  revisedStrengths?: string[]
  revisedConcerns?: string[]
  parentNotes?: string
}

export async function fetchVisitContext(userId: string, journeyId?: string): Promise<string | null> {
  if (!userId) return null

  const entries: VisitContextEntry[] = []
  const seenSchoolIds = new Set<string>()

  try {
    // Source 1: visit_records table (structured visit events)
    const visitRecords = await VisitRecord.filter({ user_id: userId })
    const completedVisits = Array.isArray(visitRecords)
      ? visitRecords.filter((v: any) => v.status === 'completed' || v.impression)
      : []

    // Collect school IDs we need names for
    const schoolIdsToResolve = new Set<string>()
    for (const v of completedVisits) {
      if (v.school_id) schoolIdsToResolve.add(v.school_id)
    }

    // Batch-fetch school names
    const schoolNameMap: Record<string, string> = {}
    for (const sid of schoolIdsToResolve) {
      try {
        const schools = await School.filter({ id: sid })
        if (schools?.[0]?.name) schoolNameMap[sid] = schools[0].name
      } catch { /* skip */ }
    }

    for (const v of completedVisits) {
      seenSchoolIds.add(v.school_id)
      entries.push({
        schoolName: schoolNameMap[v.school_id] || 'Unknown School',
        schoolId: v.school_id,
        visitDate: v.visit_date || undefined,
        eventType: v.event_type || undefined,
        impression: v.impression || undefined,
        standoutMoments: v.standout_moments || undefined,
        concerns: v.concerns || undefined,
        wouldVisitAgain: v.would_visit_again || undefined,
      })
    }

    // Source 2: family_journeys.school_journeys JSONB (post-debrief data)
    if (journeyId) {
      try {
        const journeys = await FamilyJourney.filter({ id: journeyId })
        const journey = journeys?.[0]
        const schoolJourneys = Array.isArray(journey?.school_journeys) ? journey.school_journeys : []

        for (const sj of schoolJourneys) {
          if (!sj.schoolId) continue
          const hasVisitData = sj.status === 'VISITED' || sj.visitVerdict || sj.postVisitFitLabel || sj.parentNotes || sj.revisedStrengths?.length > 0 || sj.revisedConcerns?.length > 0
          if (!hasVisitData) continue

          if (seenSchoolIds.has(sj.schoolId)) {
            // Merge debrief data into existing entry from visit_records
            const existing = entries.find(e => e.schoolId === sj.schoolId)
            if (existing) {
              if (sj.visitVerdict) existing.visitVerdict = sj.visitVerdict
              if (sj.postVisitFitLabel) existing.postVisitFitLabel = sj.postVisitFitLabel
              if (sj.revisedStrengths?.length > 0) existing.revisedStrengths = sj.revisedStrengths
              if (sj.revisedConcerns?.length > 0) existing.revisedConcerns = sj.revisedConcerns
              if (sj.parentNotes || sj.notes) existing.parentNotes = sj.parentNotes || sj.notes
            }
          } else {
            // New entry from JSONB only
            entries.push({
              schoolName: sj.schoolName || 'Unknown School',
              schoolId: sj.schoolId,
              visitDate: sj.visitedAt || undefined,
              visitVerdict: sj.visitVerdict || undefined,
              postVisitFitLabel: sj.postVisitFitLabel || undefined,
              revisedStrengths: sj.revisedStrengths || undefined,
              revisedConcerns: sj.revisedConcerns || undefined,
              parentNotes: sj.parentNotes || sj.notes || undefined,
            })
          }
        }
      } catch (e: any) {
        console.warn('[E51-S3B] Failed to fetch school_journeys JSONB:', e?.message)
      }
    }
  } catch (e: any) {
    console.warn('[E51-S3B] fetchVisitContext failed:', e?.message)
    return null
  }

  if (entries.length === 0) return null

  // Format into a concise context block
  const lines = entries.map(e => {
    const parts: string[] = []
    const dateStr = e.visitDate ? ` (${e.visitDate})` : ''
    const typeStr = e.eventType ? `, ${e.eventType.replace(/_/g, ' ')}` : ''
    parts.push(`${e.schoolName}${dateStr}${typeStr}`)

    if (e.impression) parts.push(`Impression: ${e.impression.replace(/_/g, ' ')}`)
    if (e.visitVerdict) parts.push(`Verdict: ${e.visitVerdict}`)
    if (e.postVisitFitLabel) parts.push(`Post-visit fit: ${e.postVisitFitLabel}`)
    if (e.standoutMoments) parts.push(`Standout: "${truncate(e.standoutMoments, 80)}"`)
    if (e.concerns) parts.push(`Concerns: "${truncate(e.concerns, 80)}"`)
    if (e.wouldVisitAgain) parts.push(`Would visit again: ${e.wouldVisitAgain}`)
    if (e.revisedStrengths?.length) parts.push(`Strengths: ${e.revisedStrengths.join(', ')}`)
    if (e.revisedConcerns?.length) parts.push(`Concerns noted: ${e.revisedConcerns.join(', ')}`)
    if (e.parentNotes) parts.push(`Notes: "${truncate(e.parentNotes, 80)}"`)

    return `- ${parts.join('. ')}`
  })

  let block = `VISIT EXPERIENCE:\n${lines.join('\n')}`
  // Cap to prevent token bloat
  if (block.length > 600) block = block.substring(0, 597) + '...'

  return block
}

function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str
  return str.substring(0, max - 3) + '...'
}
