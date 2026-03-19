'use client'
import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import SchoolAdmin from '@/page-components/SchoolAdmin'

export default function SchoolAdminPage() {
  const { isAuthenticated, isLoadingAuth } = useAuth()
  const router = useRouter()

  if (isLoadingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    router.replace('/login?returnTo=/school-admin')
    return null
  }

  return <Suspense><SchoolAdmin /></Suspense>
}
