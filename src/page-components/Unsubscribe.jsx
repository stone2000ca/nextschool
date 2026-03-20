'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BellOff, Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function Unsubscribe() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState(token ? 'loading' : 'no-token') // 'loading' | 'success' | 'error' | 'no-token'
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) return
    processUnsubscribe()
  }, [token])

  const processUnsubscribe = async () => {
    try {
      const res = await fetch('/api/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Unsubscribe failed')
      }
      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A1628] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {status === 'loading' && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-teal-400 animate-spin mx-auto" />
            <p className="text-white/60">Processing your request...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <CheckCircle className="w-16 h-16 text-teal-400 mx-auto" />
            <h1 className="text-2xl font-bold">You&apos;ve been unsubscribed</h1>
            <p className="text-white/60">
              You won&apos;t receive any more visit reminder or prep emails from NextSchool.
              You can always re-enable notifications in your settings.
            </p>
            <div className="flex flex-col gap-3 pt-4">
              <Button
                onClick={() => window.location.href = '/settings'}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Manage email preferences
              </Button>
              <Button
                onClick={() => window.location.href = '/dashboard'}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Go to dashboard
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <XCircle className="w-16 h-16 text-red-400 mx-auto" />
            <h1 className="text-2xl font-bold">Unsubscribe failed</h1>
            <p className="text-white/60">{errorMsg}</p>
            <p className="text-white/60 text-sm">
              You can manage your email preferences by logging in to your account.
            </p>
            <Button
              onClick={() => window.location.href = '/settings'}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Go to settings
            </Button>
          </div>
        )}

        {status === 'no-token' && (
          <div className="space-y-6">
            <BellOff className="w-16 h-16 text-white/40 mx-auto" />
            <h1 className="text-2xl font-bold">Unsubscribe from emails</h1>
            <p className="text-white/60">
              To unsubscribe, please use the link provided in your email, or log in to manage
              your notification preferences.
            </p>
            <Button
              onClick={() => window.location.href = '/settings'}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Manage email preferences
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
