import { School, SchoolAdmin } from '@/lib/entities-server'

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

  // TODO: Call schoolAgent.enrichSchool({ schoolId: school.id }) here
  // when Sprint 1 is ready. The enrichment agent will populate the
  // draft profile from the school website and other public sources.

  return { schoolId: school.id, name: school.name }
}
