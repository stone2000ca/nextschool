'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import Navbar from '@/components/navigation/Navbar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function Settings() {
  const router = useRouter()
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth()
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isLoadingAuth) return
    if (!isAuthenticated) {
      navigateToLogin('/settings')
      return
    }
    fetchPreferences()
  }, [isLoadingAuth, isAuthenticated])

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/email/preferences')
      if (!res.ok) throw new Error('Failed to load preferences')
      const data = await res.json()
      setEmailEnabled(data.email_notifications_enabled)
    } catch (err) {
      console.error('[Settings] Failed to load email preferences:', err)
      toast.error('Failed to load email preferences')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (checked) => {
    const previous = emailEnabled
    setEmailEnabled(checked)
    setSaving(true)

    try {
      const res = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_notifications_enabled: checked }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(checked ? 'Email notifications enabled' : 'Email notifications disabled')
    } catch (err) {
      setEmailEnabled(previous)
      toast.error('Failed to update email preferences')
    } finally {
      setSaving(false)
    }
  }

  if (isLoadingAuth || loading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || !user) return null

  return (
    <div className="min-h-screen bg-[#0A1628] text-white flex flex-col">
      <Navbar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>

          {/* Email Notifications Section */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-5 h-5 text-teal-400" />
              <h2 className="text-lg font-semibold">Email Notifications</h2>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium">Visit reminders & prep emails</p>
                <p className="text-sm text-white/60 mt-1">
                  Receive helpful reminders before school visits and follow-up emails
                  to capture your thoughts afterward.
                </p>
              </div>
              <Switch
                checked={emailEnabled}
                onCheckedChange={handleToggle}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
