'use client'

import { Suspense } from 'react'
import Signup from '@/page-components/Signup'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>}>
      <Signup />
    </Suspense>
  )
}
