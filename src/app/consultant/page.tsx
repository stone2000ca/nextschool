'use client'
import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import Consultant from '@/page-components/Consultant'

export default function ConsultantPage() {
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
    router.replace('/login?returnTo=/consultant')
    return null
  }

  return <Suspense><Consultant /></Suspense>
}
