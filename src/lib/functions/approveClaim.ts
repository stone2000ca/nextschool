import { SchoolClaim, SchoolAdmin, School } from '@/lib/entities-server'

export async function approveClaim(params: {
  claimId: string
  schoolId: string
  userId: string
}) {
  const { claimId, schoolId, userId } = params

  if (!claimId || !schoolId) {
    throw Object.assign(new Error('claimId and schoolId are required'), { statusCode: 400 })
  }

  // Update claim status to verified
  await SchoolClaim.update(claimId, {
    status: 'verified',
    verified_at: new Date().toISOString(),
  })

  // Update school to claimed
  await School.update(schoolId, {
    verified: true,
    claim_status: 'claimed',
    membership_tier: 'basic',
  })

  // Create SchoolAdmin record linking user to school
  if (userId) {
    await SchoolAdmin.create({
      user_id: userId,
      school_id: schoolId,
      role: 'owner',
      is_active: true,
    })
  }

  return { success: true }
}
