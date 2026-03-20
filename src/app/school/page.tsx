'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Legacy /school?id=xxx handler — redirects to /school/[slug] or /school/[id]
 */
export default function SchoolLegacyRedirect() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')

  useEffect(() => {
    if (id) {
      router.replace(`/school/${id}`)
    } else {
      router.replace('/schools')
    }
  }, [id, router])

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
    </div>
  )
}
