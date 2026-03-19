import { getAdminClient } from '@/lib/supabase/admin'

export async function adminClaims() {
  const db = getAdminClient()

  // Fetch pending claims
  const { data: claims, error } = await (db.from('school_claims') as any)
    .select('*')
    .in('status', ['pending', 'pending_review'])
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!claims || claims.length === 0) return []

  // Collect unique school IDs and user IDs for batch lookup
  const schoolIds = [...new Set(claims.map((c: any) => c.school_id).filter(Boolean))]
  const userIds = [...new Set(claims.map((c: any) => c.claimed_by).filter(Boolean))]

  // Batch fetch schools and users
  const [schoolsRes, usersRes] = await Promise.all([
    schoolIds.length > 0
      ? (db.from('schools') as any).select('id, name, city, region').in('id', schoolIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? (db.from('users') as any).select('id, email').in('id', userIds)
      : Promise.resolve({ data: [] }),
  ])

  const schoolMap = new Map((schoolsRes.data || []).map((s: any) => [s.id, s]))
  const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]))

  // Enrich claims
  return claims.map((claim: any) => {
        const school = schoolMap.get(claim.school_id) as any
        const user = userMap.get(claim.claimed_by) as any
    return {
      ...claim,
      _schoolName: school?.name || 'Unknown School',
      _schoolCity: school?.city || '',
      _schoolRegion: school?.region || '',
      _userEmail: user?.email || claim.claimant_email || 'Unknown',
    }
  })
}
