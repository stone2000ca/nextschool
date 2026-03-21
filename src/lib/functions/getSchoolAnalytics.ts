/**
 * getSchoolAnalytics — fetches analytics aggregates for a school
 * Queries: chat_shortlists, school_journeys, visit_records
 * No migrations required — uses existing tables only
 */
import { getAdminClient } from '@/lib/supabase/admin'

interface ShortlistTimePoint {
  month: string   // e.g. "2026-01"
  count: number
}

interface JourneyStatusBreakdown {
  status: string
  count: number
}

interface VisitSentiment {
  impression: string
  count: number
}

export interface SchoolAnalytics {
  shortlistCount: number
  shortlistTimeSeries: ShortlistTimePoint[]
  journeyStatusBreakdown: JourneyStatusBreakdown[]
  avgMatchScore: number | null
  visitCount: number
  visitSentiment: VisitSentiment[]
}

export async function getSchoolAnalytics(schoolId: string): Promise<SchoolAnalytics> {
  const admin = getAdminClient()

  const [shortlistResult, journeyResult, visitResult] = await Promise.all([
    // Shortlists for this school
    (admin.from('chat_shortlists') as any)
      .select('id, added_at, created_at')
      .eq('school_id', schoolId),

    // School journeys for this school
    (admin.from('school_journeys') as any)
      .select('id, status, match_score')
      .eq('school_id', schoolId),

    // Visit records for this school
    (admin.from('visit_records') as any)
      .select('id, impression')
      .eq('school_id', schoolId),
  ])

  // --- Shortlist count + time series ---
  const shortlists = shortlistResult.data || []
  const shortlistCount = shortlists.length

  const monthCounts: Record<string, number> = {}
  for (const row of shortlists) {
    const dateStr = row.added_at || row.created_at
    if (!dateStr) continue
    const month = dateStr.slice(0, 7) // "2026-01"
    monthCounts[month] = (monthCounts[month] || 0) + 1
  }
  const shortlistTimeSeries = Object.entries(monthCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6) // last 6 months
    .map(([month, count]) => ({ month, count }))

  // --- Journey status breakdown ---
  const journeys = journeyResult.data || []
  const statusCounts: Record<string, number> = {}
  let matchScoreSum = 0
  let matchScoreCount = 0

  for (const row of journeys) {
    const status = row.status || 'unknown'
    statusCounts[status] = (statusCounts[status] || 0) + 1
    if (row.match_score != null) {
      matchScoreSum += Number(row.match_score)
      matchScoreCount++
    }
  }

  const journeyStatusBreakdown = Object.entries(statusCounts)
    .map(([status, count]) => ({ status, count }))
  const avgMatchScore = matchScoreCount > 0
    ? Math.round((matchScoreSum / matchScoreCount) * 10) / 10
    : null

  // --- Visit count + sentiment ---
  const visits = visitResult.data || []
  const visitCount = visits.length
  const sentimentCounts: Record<string, number> = {}

  for (const row of visits) {
    const impression = row.impression || 'unknown'
    sentimentCounts[impression] = (sentimentCounts[impression] || 0) + 1
  }

  const visitSentiment = Object.entries(sentimentCounts)
    .map(([impression, count]) => ({ impression, count }))

  return {
    shortlistCount,
    shortlistTimeSeries,
    journeyStatusBreakdown,
    avgMatchScore,
    visitCount,
    visitSentiment,
  }
}
