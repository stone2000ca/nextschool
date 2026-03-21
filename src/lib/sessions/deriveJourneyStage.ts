import type { ChatSessionRecord } from '@/lib/api/types'

// ─── Types ──────────────────────────────────────────────────────────

export type JourneyStage =
  | 'DEBRIEF_PENDING'
  | 'VISIT_UPCOMING'
  | 'DECIDING'
  | 'RESEARCHING'
  | 'SHORTLISTING'
  | 'RESULTS_READY'
  | 'BRIEF_INCOMPLETE'

export type Urgency = 'HIGH' | 'NORMAL'

export interface JourneyStageResult {
  stage: JourneyStage
  statusLine: string
  ctaLabel: string
  ctaRoute: string
  urgency: Urgency
}

export interface VisitRecord {
  id: string
  sessionId: string
  schoolName: string
  scheduledDate: string | null
  attended: boolean
  debriefSubmitted: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────

function parseMatchedSchools(session: ChatSessionRecord): string[] {
  if (!session.matched_schools) return []
  try {
    const parsed = JSON.parse(session.matched_schools)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function nearestDate(visits: VisitRecord[]): VisitRecord | undefined {
  return visits
    .filter((v) => v.scheduledDate)
    .sort((a, b) => {
      const da = new Date(a.scheduledDate!).getTime()
      const db = new Date(b.scheduledDate!).getTime()
      return da - db
    })[0]
}

function formatDate(iso: string | null): string {
  if (!iso) return 'TBD'
  const d = new Date(iso)
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

// ─── Classifier ─────────────────────────────────────────────────────

/**
 * Pure function that derives the current journey stage for a dashboard session.
 * Evaluates stages in priority order — first match wins.
 *
 * @param session          - The chat session record
 * @param visits           - All visit records associated with this session
 * @param hasDeepDive      - Whether a deep-dive analysis exists for any shortlisted school
 * @returns JourneyStageResult with stage, statusLine, ctaLabel, ctaRoute, urgency
 */
export function deriveJourneyStage(
  session: ChatSessionRecord,
  visits: VisitRecord[],
  hasDeepDive: boolean = false
): JourneyStageResult {
  const matchedSchools = parseMatchedSchools(session)
  const shortlistedCount = session.shortlisted_count ?? 0

  const debriefPending = visits.filter((v) => !v.debriefSubmitted && v.attended)
  const upcoming = visits.filter((v) => !v.attended && !v.debriefSubmitted)
  const completed = visits.filter((v) => v.debriefSubmitted)

  // 1. DEBRIEF_PENDING — attended but not yet debriefed
  if (debriefPending.length > 0) {
    const nearest = nearestDate(debriefPending) ?? debriefPending[0]
    return {
      stage: 'DEBRIEF_PENDING',
      statusLine: `Debrief pending for ${nearest.schoolName}`,
      ctaLabel: 'Add Your Impressions',
      ctaRoute: `/consultant?debrief=${nearest.id}`,
      urgency: 'HIGH',
    }
  }

  // 2. VISIT_UPCOMING — scheduled visit in the future
  if (upcoming.length > 0) {
    const nearest = nearestDate(upcoming) ?? upcoming[0]
    return {
      stage: 'VISIT_UPCOMING',
      statusLine: `Visit to ${nearest.schoolName} on ${formatDate(nearest.scheduledDate)}`,
      ctaLabel: 'Prep for Your Visit',
      ctaRoute: `/consultant?prep=${nearest.id}`,
      urgency: 'HIGH',
    }
  }

  // 3. DECIDING — all visits completed and meaningful shortlist
  if (completed.length > 0 && shortlistedCount >= 3) {
    return {
      stage: 'DECIDING',
      statusLine: `${shortlistedCount} schools shortlisted — ready to decide`,
      ctaLabel: 'Compare Top Schools',
      ctaRoute: `/consultant?sessionId=${session.id}`,
      urgency: 'NORMAL',
    }
  }

  // 4. RESEARCHING — shortlisted schools with deep-dive analysis opened
  if (matchedSchools.length > 0 && shortlistedCount >= 1 && hasDeepDive) {
    return {
      stage: 'RESEARCHING',
      statusLine: `${shortlistedCount} shortlisted — explore more options`,
      ctaLabel: 'Continue Research',
      ctaRoute: `/consultant?sessionId=${session.id}`,
      urgency: 'NORMAL',
    }
  }

  // 5. SHORTLISTING — has matches and at least one shortlisted school
  if (matchedSchools.length > 0 && shortlistedCount >= 1) {
    return {
      stage: 'SHORTLISTING',
      statusLine: `${shortlistedCount} shortlisted — keep building your list`,
      ctaLabel: 'Keep Shortlisting',
      ctaRoute: `/consultant?sessionId=${session.id}`,
      urgency: 'NORMAL',
    }
  }

  // 6. RESULTS_READY — has matches but nothing shortlisted yet
  if (matchedSchools.length > 0 && shortlistedCount === 0) {
    return {
      stage: 'RESULTS_READY',
      statusLine: `${matchedSchools.length} school matches ready`,
      ctaLabel: 'Explore Your Matches',
      ctaRoute: `/consultant?sessionId=${session.id}`,
      urgency: 'NORMAL',
    }
  }

  // 7. BRIEF_INCOMPLETE — fallback: no matches yet
  return {
    stage: 'BRIEF_INCOMPLETE',
    statusLine: session.child_name
      ? `Continue setting up ${session.child_name}'s profile`
      : 'Complete your school brief to get started',
    ctaLabel: 'Finish Your Brief',
    ctaRoute: `/consultant?sessionId=${session.id}`,
    urgency: 'NORMAL',
  }
}
