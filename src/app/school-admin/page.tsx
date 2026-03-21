'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { fetchSchoolAdmins } from '@/lib/api/entities-api'

export default function SchoolAdminPage() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoadingAuth) return
    if (!isAuthenticated || !user) {
      router.replace('/login?returnTo=/school-admin')
      return
    }

    async function resolve() {
      try {
        const records = await fetchSchoolAdmins({ user_id: user!.id, is_active: true })
        if (records && records.length > 0) {
          router.replace(`/schooladmin/${records[0].school_id}`)
        } else {
          router.replace('/portal')
        }
      } catch (err) {
        console.error('Failed to resolve school admin record', err)
        setError('Something went wrong. Please try again.')
      }
    }

    resolve()
  }, [isLoadingAuth, isAuthenticated, user, router])

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => router.replace('/portal')}
          className="text-teal-600 underline"
        >
          Go to Portal
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
      <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      <p className="text-slate-500 text-sm">Finding your school dashboard...</p>
    </div>
  )
}
