'use client'

import { AuthProvider } from '@/lib/AuthContext'
import { Toaster } from 'sonner'
import '@/app/globals.css'
import { ICON_TEAL } from '@/lib/brand-assets'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>NextSchool — Find the Right School</title>
        <meta name="description" content="AI-powered school discovery for Canadian families" />
        <link rel="icon" type="image/svg+xml" href={ICON_TEAL} />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
