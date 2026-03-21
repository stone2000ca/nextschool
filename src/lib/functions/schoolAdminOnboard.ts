import { School, SchoolAdmin } from '@/lib/entities-server'
import { enrichSchool, applyEnrichment } from '@/lib/agents/schoolAgent'

interface OnboardParams {
  name: string
  websiteUrl?: string
  userId: string
}

export async function schoolAdminOnboard({ name, websiteUrl, userId }: OnboardParams) {
  // Create the school row via entity client (bypasses RLS, avoids typed table issues)
  const school = await School.create({
    name,
    status: 'draft',
    data_source: 'admin_intake',
    website_url: websiteUrl || null,
  })

  // Link the user as a school admin
  try {
    await SchoolAdmin.create({
      school_id: school.id,
      user_id: userId,
      role: 'owner',
      is_active: true,
    })
  } catch (adminError: any) {
    console.error('[schoolAdminOnboard] school_admins insert error:', adminError.message)
    // Non-fatal — school was created, admin link can be retried
  }

  // Fire enrichment asynchronously — frontend polls enrichment_status
  runEnrichment(school.id, websiteUrl).catch((err) => {
    console.error('[schoolAdminOnboard] enrichment background error:', err.message)
  })

  return { schoolId: school.id, name: school.name }
}

/**
 * Runs enrichSchool + auto-applies high-confidence results.
 * Updates enrichment_status on the school row so frontend can poll.
 */
async function runEnrichment(schoolId: string, websiteUrl?: string) {
  try {
    await School.update(schoolId, { enrichment_status: 'in_progress' })

    const plan = await enrichSchool(schoolId, { websiteUrl })

    // Auto-apply all candidates (admin can review via diff UI later)
    if (plan.candidates.length > 0) {
      await applyEnrichment(
        schoolId,
        plan.candidates.map((c) => ({ field: c.field, value: c.proposedValue })),
      )
    }

    await School.update(schoolId, { enrichment_status: 'complete' })
  } catch (err: any) {
    console.error('[runEnrichment] failed for school', schoolId, err.message)
    await School.update(schoolId, { enrichment_status: 'failed' }).catch(() => {})
  }
}
