'use client'

import { AuthProvider } from '@/lib/AuthContext'
import { Toaster } from 'sonner'
import '@/app/globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>NextSchool — Find the Right School</title>
        <meta name="description" content="AI-powered school discovery for Canadian families" />
        <link rel="icon" href="/favicon.ico" />
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
