import { getAdminClient } from '@/lib/supabase/admin'

interface OnboardParams {
  name: string
  websiteUrl?: string
  userId: string
}

export async function schoolAdminOnboard({ name, websiteUrl, userId }: OnboardParams) {
  const supabase = getAdminClient()

  // Create the school row
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .insert({
      name,
      status: 'draft',
      data_source: 'admin_intake',
      website_url: websiteUrl || null,
    })
    .select('id, name')
    .single()

  if (schoolError) {
    console.error('[schoolAdminOnboard] school insert error:', schoolError)
    throw new Error('Failed to create school')
  }

  // Link the user as a school admin
  const { error: adminError } = await supabase
    .from('school_admins')
    .insert({
      school_id: school.id,
      user_id: userId,
      role: 'owner',
      is_active: true,
    })

  if (adminError) {
    console.error('[schoolAdminOnboard] school_admins insert error:', adminError)
    // Non-fatal — school was created, admin link can be retried
  }

  // TODO: Call schoolAgent.enrichSchool({ schoolId: school.id }) here
  // when Sprint 1 is ready. The enrichment agent will populate the
  // draft profile from the school website and other public sources.

  return { schoolId: school.id, name: school.name }
}
