'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { invokeFunction } from '@/lib/functions'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 90_000

export default function SchoolAdminOnboard() {
  const router = useRouter()
  const [schoolName, setSchoolName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [brochureFile, setBrochureFile] = useState(null)
  const [phase, setPhase] = useState('form') // 'form' | 'progress' | 'error'
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const pollTimerRef = useRef(null)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  function pollEnrichmentStatus(schoolId) {
    const startedAt = Date.now()

    function tick() {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        // Timeout — let user continue anyway
        setErrorMessage(
          "Enrichment is taking longer than expected. You can continue and we'll finish in the background."
        )
        setPhase('error')
        return
      }

      fetch(`/api/schools/${schoolId}/enrichment-status`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) {
            // Network/auth error — retry
            pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
            return
          }

          const status = data.enrichmentStatus
          if (status === 'complete') {
            router.push('/school-admin')
          } else if (status === 'failed') {
            setErrorMessage(
              "I couldn't find enough info yet. You can still continue and fill details later."
            )
            setPhase('error')
          } else {
            // Still in progress (or null if enrichment hasn't started writing yet)
            pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
          }
        })
        .catch(() => {
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
        })
    }

    // Start first poll after a short delay to give enrichment time to begin
    pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!schoolName.trim()) return

    setSubmitting(true)
    try {
      const result = await invokeFunction('schoolAdminOnboard', {
        name: schoolName.trim(),
        websiteUrl: websiteUrl.trim() || undefined,
      })

      setPhase('progress')
      pollEnrichmentStatus(result.schoolId)
    } catch (err) {
      console.error('Onboard error:', err)
      setErrorMessage(
        "I couldn't find enough info yet. You can still continue and fill details later."
      )
      setPhase('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'progress') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            I&apos;m building a draft profile for {schoolName}...
          </h2>
          <p className="text-slate-500 text-sm">
            This usually takes under a minute
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <p className="text-slate-700 mb-4">{errorMessage}</p>
          <Button onClick={() => router.push('/school-admin')}>
            Continue to dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Add your school to NextSchool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="schoolName">School name *</Label>
              <Input
                id="schoolName"
                placeholder="e.g. Maple Ridge Academy"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                type="url"
                placeholder="https://www.yourschool.ca"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brochure">School brochure (PDF)</Label>
              <Input
                id="brochure"
                type="file"
                accept=".pdf"
                onChange={(e) => setBrochureFile(e.target.files?.[0] || null)}
                disabled
              />
              <p className="text-xs text-slate-400">
                Brochure upload coming soon
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !schoolName.trim()}
            >
              {submitting ? 'Creating...' : 'Continue'}
            </Button>

            <p className="text-xs text-center text-slate-400">
              We&apos;ll use your school name to start building a profile.
              You can add more details later.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
