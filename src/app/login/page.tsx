'use client'

import { Suspense } from 'react'
import Login from '@/page-components/Login'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>}>
      <Login />
    </Suspense>
  )
}
