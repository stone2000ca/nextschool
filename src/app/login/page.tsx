'use client'

import { Suspense } from 'react'
import Login from '@/page-components/Login'

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  )
}
