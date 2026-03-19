import { getAdminClient } from '@/lib/supabase/admin'

export async function adminStats() {
  const db = getAdminClient()

  const [schoolsRes, usersRes, conversationsRes, claimsRes] = await Promise.all([
    db.from('schools').select('id, status', { count: 'exact' }).neq('status', 'archived'),
    db.from('user_profiles').select('id, subscription_plan', { count: 'exact' }),
    db.from('conversations').select('id, updated_at').gte(
      'updated_at',
      new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    ),
    db.from('school_claims').select('id', { count: 'exact' }).eq('status', 'pending'),
  ])

  const totalSchools = schoolsRes.count ?? schoolsRes.data?.length ?? 0
  const totalUsers = usersRes.count ?? usersRes.data?.length ?? 0
  const activeConversationsToday = conversationsRes.data?.length ?? 0
  const pendingClaims = claimsRes.count ?? claimsRes.data?.length ?? 0

  const tierRevenue: Record<string, number> = { free: 0, basic: 99, premium: 249, pro: 499, enterprise: 999 }
  const monthlyRevenue = (usersRes.data || []).reduce((sum: number, user: any) => {
    return sum + (tierRevenue[user.subscription_plan] || 0)
  }, 0)

  return {
    totalSchools,
    totalUsers,
    activeConversationsToday,
    pendingClaims,
    monthlyRevenue,
  }
}
