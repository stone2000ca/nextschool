/**
 * E51-S4B: Email footer component for outgoing emails.
 * Renders an HTML string with "Manage email preferences" link.
 *
 * - Authenticated context (user_id known): links to /settings
 * - Unauthenticated context (unsubscribe token): links to /unsubscribe?token=...
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '') || 'https://nextschool.ca'

export function renderEmailFooter({
  unsubscribeToken,
}: {
  unsubscribeToken?: string
}): string {
  const preferencesUrl = unsubscribeToken
    ? `${BASE_URL}/unsubscribe?token=${unsubscribeToken}`
    : `${BASE_URL}/settings`

  const linkText = unsubscribeToken
    ? 'Unsubscribe from these emails'
    : 'Manage email preferences'

  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">
        You're receiving this email because you have an account on NextSchool.
        <br />
        <a href="${preferencesUrl}" style="color: #14b8a6; text-decoration: underline;">
          ${linkText}
        </a>
      </p>
    </div>
  `.trim()
}
