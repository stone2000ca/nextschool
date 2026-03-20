/**
 * E51-S4A: Email queue logic for visit lifecycle emails
 *
 * Two entry points:
 *   - queueVisitEmails(visitRecord) — called when a visit is created, queues T-7/T-1/T+1/T+3
 *   - processEmailQueue() — called by cron/scheduler, sends due emails
 */

import { getAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/integrations'
import { buildDeepLink } from '@/components/utils/buildDeepLink'
import {
  buildVisitPrepT7,
  buildVisitReminderT1,
  buildVisitDebriefT1,
  buildVisitFollowupT3,
  type VisitEmailContext,
} from './visitEmailTemplates'

// ─── Types ──────────────────────────────────────────────────────────

type EmailType = 'visit_prep_t7' | 'visit_reminder_t1' | 'visit_debrief_t1' | 'visit_followup_t3'

interface QueueEntry {
  user_id: string
  visit_record_id: string
  email_type: EmailType
  scheduled_at: string
}

// ─── Queue visit emails ─────────────────────────────────────────────

/**
 * Queue all applicable emails for a visit record.
 * Skips T-7 if visit is <7 days away.
 * Skips T-7 and T-1 if visit is today or in the past.
 */
export async function queueVisitEmails(params: {
  visitRecordId: string
  userId: string
  visitDate: string   // ISO date string (YYYY-MM-DD)
}) {
  const { visitRecordId, userId, visitDate } = params
  const supabase = getAdminClient()

  const visit = new Date(visitDate + 'T00:00:00Z')
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const daysUntilVisit = Math.floor((visit.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24))

  const entries: QueueEntry[] = []

  // T-7: 7 days before visit, send at 9am UTC
  if (daysUntilVisit >= 7) {
    const t7 = new Date(visit)
    t7.setUTCDate(t7.getUTCDate() - 7)
    t7.setUTCHours(9, 0, 0, 0)
    entries.push({
      user_id: userId,
      visit_record_id: visitRecordId,
      email_type: 'visit_prep_t7',
      scheduled_at: t7.toISOString(),
    })
  }

  // T-1: 1 day before visit, send at 9am UTC
  if (daysUntilVisit >= 1) {
    const t1Before = new Date(visit)
    t1Before.setUTCDate(t1Before.getUTCDate() - 1)
    t1Before.setUTCHours(9, 0, 0, 0)
    entries.push({
      user_id: userId,
      visit_record_id: visitRecordId,
      email_type: 'visit_reminder_t1',
      scheduled_at: t1Before.toISOString(),
    })
  }

  // T+1: 1 day after visit, send at 10am UTC
  const t1After = new Date(visit)
  t1After.setUTCDate(t1After.getUTCDate() + 1)
  t1After.setUTCHours(10, 0, 0, 0)
  entries.push({
    user_id: userId,
    visit_record_id: visitRecordId,
    email_type: 'visit_debrief_t1',
    scheduled_at: t1After.toISOString(),
  })

  // T+3: 3 days after visit, send at 10am UTC
  const t3After = new Date(visit)
  t3After.setUTCDate(t3After.getUTCDate() + 3)
  t3After.setUTCHours(10, 0, 0, 0)
  entries.push({
    user_id: userId,
    visit_record_id: visitRecordId,
    email_type: 'visit_followup_t3',
    scheduled_at: t3After.toISOString(),
  })

  if (entries.length === 0) return { queued: 0 }

  const { error } = await (supabase.from('email_queue') as any).insert(entries)
  if (error) throw error

  return { queued: entries.length }
}

// ─── Process email queue ────────────────────────────────────────────

/**
 * Find all due pending emails and attempt to send them.
 * Called by cron or manual trigger via POST /api/email/process.
 */
export async function processEmailQueue() {
  const supabase = getAdminClient()
  const now = new Date().toISOString()

  // Fetch pending emails that are due
  const { data: dueEmails, error: fetchError } = await (supabase
    .from('email_queue') as any)
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(50) as { data: any[] | null; error: any }

  if (fetchError) throw fetchError
  if (!dueEmails || dueEmails.length === 0) return { processed: 0, sent: 0, skipped: 0, failed: 0 }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const emailRow of dueEmails) {
    try {
      const shouldSend = await shouldSendEmail(supabase, emailRow)
      if (!shouldSend) {
        await markCancelled(supabase, emailRow.id, 'Skipped: preference or condition not met')
        skipped++
        continue
      }

      await sendVisitEmail(supabase, emailRow)
      await markSent(supabase, emailRow.id)
      sent++
    } catch (err: any) {
      console.error(`[processEmailQueue] Failed to send email ${emailRow.id}:`, err.message)
      await markFailed(supabase, emailRow.id, err.message)
      failed++
    }
  }

  return { processed: dueEmails.length, sent, skipped, failed }
}

// ─── Internal helpers ───────────────────────────────────────────────

async function shouldSendEmail(supabase: any, emailRow: any): Promise<boolean> {
  // Check user email preference
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email_notifications_enabled')
    .eq('id', emailRow.user_id)
    .single()

  if (profile && profile.email_notifications_enabled === false) {
    return false
  }

  // For T+3 follow-up: cancel if debrief already submitted
  if (emailRow.email_type === 'visit_followup_t3') {
    const { data: visit } = await supabase
      .from('visit_records')
      .select('status, impression')
      .eq('id', emailRow.visit_record_id)
      .single()

    if (visit && (visit.status === 'completed' || visit.impression)) {
      return false
    }
  }

  return true
}

async function sendVisitEmail(supabase: any, emailRow: any): Promise<void> {
  // Fetch visit record with school info
  const { data: visit, error: visitError } = await supabase
    .from('visit_records')
    .select('*')
    .eq('id', emailRow.visit_record_id)
    .single()

  if (visitError || !visit) throw new Error('Visit record not found')

  // Fetch school
  const { data: school } = await supabase
    .from('schools')
    .select('id, name, slug')
    .eq('id', visit.school_id)
    .single()

  // Fetch user
  const { data: user } = await supabase
    .from('user_profiles')
    .select('email, full_name')
    .eq('id', emailRow.user_id)
    .single()

  if (!user?.email) throw new Error('User email not found')

  const formattedDate = visit.visit_date
    ? new Date(visit.visit_date + 'T00:00:00Z').toLocaleDateString('en-CA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : 'TBD'

  const ctx: VisitEmailContext = {
    userName: user.full_name || 'there',
    schoolName: school?.name || 'the school',
    schoolSlug: school?.slug,
    eventType: visit.event_type,
    visitDate: formattedDate,
    visitId: visit.id,
  }

  let template: { subject: string; body: string }

  switch (emailRow.email_type as EmailType) {
    case 'visit_prep_t7':
      template = buildVisitPrepT7(ctx)
      break

    case 'visit_reminder_t1':
      template = buildVisitReminderT1(ctx)
      break

    case 'visit_debrief_t1':
      // Create debrief tokens for one-tap reactions
      ctx.reactionUrls = await createReactionUrls(supabase, emailRow, visit, school)
      template = buildVisitDebriefT1(ctx)
      break

    case 'visit_followup_t3':
      template = buildVisitFollowupT3(ctx)
      break

    default:
      throw new Error(`Unknown email type: ${emailRow.email_type}`)
  }

  await sendEmail({
    from_name: 'NextSchool',
    to: user.email,
    subject: template.subject,
    body: template.body,
  })
}

/**
 * Create 3 debrief tokens (one per reaction) and return tokenized URLs
 * for the T+1 email reaction buttons.
 */
async function createReactionUrls(
  supabase: any,
  emailRow: any,
  visit: any,
  school: any,
): Promise<{ loved_it: string; mixed: string; not_for_us: string }> {
  const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://app.nextschool.ca'
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const reactions = ['loved_it', 'mixed', 'not_for_us'] as const
  const urls: Record<string, string> = {}

  for (const reaction of reactions) {
    const token = crypto.randomUUID()

    await supabase.from('debrief_tokens').insert({
      token,
      user_id: emailRow.user_id,
      school_id: visit.school_id,
      school_slug: school?.slug || null,
      visit_id: visit.id,
      reaction,
      expires_at: expiresAt,
    })

    // Build a URL that the frontend debrief landing page can consume
    const deepLink = buildDeepLink(
      {
        school: school?.slug,
        tab: 'notepad',
        section: 'debrief',
        visitId: visit.id,
      },
      APP_URL,
    )

    urls[reaction] = `${APP_URL}/api/visit/debrief?token=${encodeURIComponent(token)}&reaction=${reaction}&redirect=${encodeURIComponent(deepLink)}`
  }

  return urls as { loved_it: string; mixed: string; not_for_us: string }
}

// ─── Status updates ─────────────────────────────────────────────────

async function markSent(supabase: any, id: string) {
  await (supabase.from('email_queue') as any)
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
}

async function markCancelled(supabase: any, id: string, reason?: string) {
  await (supabase.from('email_queue') as any)
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), error_message: reason })
    .eq('id', id)
}

async function markFailed(supabase: any, id: string, errorMessage: string) {
  await (supabase.from('email_queue') as any)
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', id)
}

// ─── Cancellation helper ────────────────────────────────────────────

/**
 * Cancel pending T+3 follow-up when a debrief is submitted.
 * Called from debrief completion flow.
 */
export async function cancelFollowupIfDebriefed(visitRecordId: string) {
  const supabase = getAdminClient()

  const { error } = await (supabase.from('email_queue') as any)
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      error_message: 'Debrief submitted before T+3',
    })
    .eq('visit_record_id', visitRecordId)
    .eq('email_type', 'visit_followup_t3')
    .eq('status', 'pending')

  if (error) {
    console.error('[cancelFollowupIfDebriefed] Error:', error)
  }
}
