/**
 * E51-S4A: Visit email HTML templates
 *
 * 4 templates for visit lifecycle emails:
 *   - T-7: Prep reminder (7 days before visit)
 *   - T-1: Day-before reminder
 *   - T+1: Debrief nudge with one-tap reaction buttons
 *   - T+3: Follow-up if no debrief submitted
 */

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://app.nextschool.ca'

// ─── Shared chrome ──────────────────────────────────────────────────

const header = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #0D9488 0%, #0F766E 100%); padding: 32px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">NextSchool</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Your Trusted School Search Partner</p>
  </div>
  <div style="padding: 32px;">
`

const footer = `
  </div>
  <div style="background: #F8FAFC; padding: 24px; border-top: 1px solid #E2E8F0; text-align: center;">
    <p style="color: #64748B; font-size: 12px; margin: 0 0 8px 0;">
      Questions? Contact us at <a href="mailto:support@nextschool.ca" style="color: #0D9488;">support@nextschool.ca</a>
    </p>
    <p style="color: #94A3B8; font-size: 11px; margin: 0;">
      &copy; 2026 NextSchool. All rights reserved.
    </p>
  </div>
</div>
`

const ctaButton = (href: string, label: string) => `
<div style="text-align: center; margin: 32px 0;">
  <a href="${href}"
     style="display: inline-block; background: #0D9488; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
    ${label}
  </a>
</div>
`

// ─── Template context ───────────────────────────────────────────────

export interface VisitEmailContext {
  userName: string
  schoolName: string
  schoolSlug?: string
  eventType: string
  visitDate: string          // formatted date string e.g. "March 25, 2026"
  visitId: string
  /** For T+1 only: tokenized debrief URLs for each reaction */
  reactionUrls?: {
    loved_it: string
    mixed: string
    not_for_us: string
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    open_house: 'open house',
    private_tour: 'private tour',
    info_night: 'info night',
    virtual: 'virtual visit',
    other: 'visit',
  }
  return labels[eventType] || 'visit'
}

function consultantLink(ctx: VisitEmailContext): string {
  const params = new URLSearchParams()
  if (ctx.schoolSlug) params.set('school', ctx.schoolSlug)
  params.set('tab', 'notepad')
  params.set('visitId', ctx.visitId)
  const query = params.toString()
  return `${APP_URL}/consultant${query ? `?${query}` : ''}`
}

// ─── T-7: Prep reminder ────────────────────────────────────────────

export function buildVisitPrepT7(ctx: VisitEmailContext): { subject: string; body: string } {
  const event = eventLabel(ctx.eventType)
  return {
    subject: `Your ${event} at ${ctx.schoolName} is in one week`,
    body: `${header}
      <h2 style="color: #1E293B; margin: 0 0 16px 0; font-size: 24px;">Your Visit Is Coming Up!</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Hi ${ctx.userName},
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
        Your <strong>${event}</strong> at <strong>${ctx.schoolName}</strong> is scheduled for <strong>${ctx.visitDate}</strong> &mdash; that's one week from now!
      </p>
      <div style="background: #F0FDFA; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="color: #0F766E; font-weight: 600; margin: 0 0 12px 0;">Prep tips:</p>
        <ul style="color: #475569; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>Review the school's profile and programs</li>
          <li>Jot down questions you'd like to ask</li>
          <li>Add any prep notes to your visit card</li>
        </ul>
      </div>
      ${ctaButton(consultantLink(ctx), 'Review Your Visit')}
    ${footer}`,
  }
}

// ─── T-1: Day-before reminder ───────────────────────────────────────

export function buildVisitReminderT1(ctx: VisitEmailContext): { subject: string; body: string } {
  const event = eventLabel(ctx.eventType)
  return {
    subject: `Tomorrow: ${event} at ${ctx.schoolName}`,
    body: `${header}
      <h2 style="color: #1E293B; margin: 0 0 16px 0; font-size: 24px;">Your Visit Is Tomorrow!</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Hi ${ctx.userName},
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
        Just a reminder &mdash; your <strong>${event}</strong> at <strong>${ctx.schoolName}</strong> is tomorrow, <strong>${ctx.visitDate}</strong>.
      </p>
      <div style="background: #F0F9FF; border-left: 4px solid #0D9488; padding: 16px; margin: 24px 0;">
        <p style="color: #0F766E; font-weight: 600; margin: 0 0 8px 0;">Quick checklist</p>
        <ul style="color: #475569; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>Confirm the time and address</li>
          <li>Review your prep notes</li>
          <li>Bring any questions you've saved</li>
        </ul>
      </div>
      ${ctaButton(consultantLink(ctx), 'View Visit Details')}
      <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 16px 0 0 0;">
        After your visit, we'll send you a quick debrief to capture your impressions while they're fresh.
      </p>
    ${footer}`,
  }
}

// ─── T+1: Debrief nudge with reaction buttons ──────────────────────

export function buildVisitDebriefT1(ctx: VisitEmailContext): { subject: string; body: string } {
  if (!ctx.reactionUrls) {
    throw new Error('reactionUrls required for T+1 debrief email')
  }

  const event = eventLabel(ctx.eventType)
  const reactionButton = (url: string, emoji: string, label: string, bg: string) => `
    <a href="${url}"
       style="display: inline-block; background: ${bg}; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 0 8px 8px 0;">
      ${emoji} ${label}
    </a>
  `

  return {
    subject: `How was your ${event} at ${ctx.schoolName}?`,
    body: `${header}
      <h2 style="color: #1E293B; margin: 0 0 16px 0; font-size: 24px;">How Did It Go?</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Hi ${ctx.userName},
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
        You visited <strong>${ctx.schoolName}</strong> yesterday. Tap a reaction to kick off your debrief &mdash; it only takes a second:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        ${reactionButton(ctx.reactionUrls.loved_it, '❤️', 'Loved it', '#16A34A')}
        ${reactionButton(ctx.reactionUrls.mixed, '🤔', 'Mixed', '#D97706')}
        ${reactionButton(ctx.reactionUrls.not_for_us, '👎', 'Not for us', '#DC2626')}
      </div>
      <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
        One tap saves your first impression. You can add details later.
      </p>
    ${footer}`,
  }
}

// ─── T+3: Follow-up if no debrief ──────────────────────────────────

export function buildVisitFollowupT3(ctx: VisitEmailContext): { subject: string; body: string } {
  const event = eventLabel(ctx.eventType)
  return {
    subject: `Don't forget to debrief your ${event} at ${ctx.schoolName}`,
    body: `${header}
      <h2 style="color: #1E293B; margin: 0 0 16px 0; font-size: 24px;">Quick Debrief Reminder</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        Hi ${ctx.userName},
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
        You visited <strong>${ctx.schoolName}</strong> a few days ago but haven't recorded your impressions yet. A quick debrief helps you remember the details when comparing schools later.
      </p>
      <div style="background: #FFF7ED; border-left: 4px solid #F59E0B; padding: 16px; margin: 24px 0;">
        <p style="color: #92400E; font-weight: 600; margin: 0 0 8px 0;">Why debrief?</p>
        <ul style="color: #78350F; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
          <li>Capture impressions before they fade</li>
          <li>Track standout moments and concerns</li>
          <li>Build a comparison record across schools</li>
        </ul>
      </div>
      ${ctaButton(consultantLink(ctx), 'Start Your Debrief')}
      <p style="color: #64748B; font-size: 14px; line-height: 1.6; margin: 16px 0 0 0;">
        It takes less than 2 minutes and helps our AI consultant give you better recommendations.
      </p>
    ${footer}`,
  }
}
