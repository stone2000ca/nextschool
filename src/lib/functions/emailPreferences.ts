/**
 * E51-S4B: Email preferences & unsubscribe
 * Backend logic for managing email notification preferences and tokenized unsubscribe.
 */
import { getAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// Helper: the admin client typed as `any` since the new columns
// (email_notifications_enabled, unsubscribe_tokens) are not yet
// in the generated Supabase types.
const db = () => getAdminClient() as any

// ─── Get email preferences for a user ────────────────────────────────

export async function getEmailPreferences({ user_id }: { user_id: string }) {
  const { data, error } = await db()
    .from('user_profiles')
    .select('email_notifications_enabled')
    .eq('id', user_id)
    .single()

  if (error || !data) throw new Error(`Failed to get email preferences: ${error?.message || 'not found'}`)
  return { email_notifications_enabled: data.email_notifications_enabled ?? true }
}

// ─── Update email preferences for a user ─────────────────────────────

export async function updateEmailPreferences({
  user_id,
  email_notifications_enabled,
}: {
  user_id: string
  email_notifications_enabled: boolean
}) {
  const { data, error } = await db()
    .from('user_profiles')
    .update({
      email_notifications_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user_id)
    .select('email_notifications_enabled')
    .single()

  if (error) throw new Error(`Failed to update email preferences: ${error.message}`)
  return { email_notifications_enabled: data.email_notifications_enabled }
}

// ─── Generate an unsubscribe token for a user ────────────────────────

export async function generateUnsubscribeToken({ user_id }: { user_id: string }): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

  const { error } = await db().from('unsubscribe_tokens').insert({
    token,
    user_id,
    expires_at,
  })

  if (error) throw new Error(`Failed to generate unsubscribe token: ${error.message}`)
  return token
}

// ─── Process unsubscribe via token (unauthenticated) ─────────────────

export async function processUnsubscribe({ token }: { token: string }) {
  // Look up the token
  const { data: tokenRow, error: lookupError } = await db()
    .from('unsubscribe_tokens')
    .select('*')
    .eq('token', token)
    .is('used_at', null)
    .single()

  if (lookupError || !tokenRow) {
    return { success: false, error: 'Invalid or expired unsubscribe link.' }
  }

  // Check expiry
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { success: false, error: 'This unsubscribe link has expired.' }
  }

  // Disable email notifications
  const { error: updateError } = await db()
    .from('user_profiles')
    .update({
      email_notifications_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tokenRow.user_id)

  if (updateError) {
    throw new Error(`Failed to unsubscribe: ${updateError.message}`)
  }

  // Mark token as used
  await db()
    .from('unsubscribe_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  return { success: true }
}
