'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AgentChatPane from '@/components/school-admin/AgentChatPane'

export default function DuoRightPane({ schoolName }) {
  const params = useParams()
  const schoolId = params?.id

  const [schoolData, setSchoolData] = useState(null)

  // Fetch full school data for the chat agent
  useEffect(() => {
    if (!schoolId) return
    const supabase = createClient()
    supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single()
      .then(({ data }) => {
        if (data) setSchoolData(data)
      })
  }, [schoolId])

  const handleSchoolUpdate = (updated) => {
    setSchoolData(updated)
  }

  if (!schoolId) return null

  return (
    <AgentChatPane
      schoolId={schoolId}
      schoolName={schoolName}
      schoolData={schoolData}
      activeSection={null}
      onSchoolUpdate={handleSchoolUpdate}
    />
  )
}
