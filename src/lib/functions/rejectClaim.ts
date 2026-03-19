import { getAdminClient } from '@/lib/supabase/admin'

export async function rejectClaim({ claimId }: { claimId: string }) {
  if (!claimId) throw new Error('claimId is required')

  const db = getAdminClient()
  const { error } = await (db.from('school_claims') as any)
    .update({ status: 'rejected' })
    .eq('id', claimId)

  if (error) throw error
  return { success: true }
}
