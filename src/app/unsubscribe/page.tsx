'use client'
import { Suspense } from 'react'
import Unsubscribe from '@/page-components/Unsubscribe'

// Wrap in Suspense because useSearchParams() requires it in Next.js App Router
export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A1628]" />}>
      <Unsubscribe />
    </Suspense>
  )
}
