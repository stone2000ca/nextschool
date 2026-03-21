'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Bot, ClipboardCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DuoLeftPane from '@/components/school-admin/DuoLeftPane'
import DuoRightPane from '@/components/school-admin/DuoRightPane'
import KeyFactsList from '@/components/school-admin/KeyFactsList'

const MOBILE_SEGMENTS = ['preview', 'facts', 'chat']

export default function SchoolAdminDuo() {
  const params = useParams()
  const router = useRouter()
  const schoolId = params?.id

  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mobileSegment, setMobileSegment] = useState('preview')

  useEffect(() => {
    if (!schoolId) return
    const supabase = createClient()
    supabase
      .from('schools')
      .select('id, name')
      .eq('id', schoolId)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError('School not found')
        else setSchool(data)
        setLoading(false)
      })
  }, [schoolId])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !school) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{error || 'School not found'}</p>
          <button
            onClick={() => router.push('/schooladmin')}
            className="text-sm text-teal-600 hover:underline"
          >
            &larr; Back to schools
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.push('/schooladmin')}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground truncate">{school.name}</h1>
      </header>

      {/* Mobile segmented control */}
      <div className="md:hidden border-b border-border px-4 py-2 shrink-0">
        <div className="flex rounded-lg bg-muted p-1">
          {MOBILE_SEGMENTS.map((seg) => (
            <button
              key={seg}
              onClick={() => setMobileSegment(seg)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mobileSegment === seg
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {seg === 'preview' ? 'Preview' : seg === 'facts' ? 'Facts' : 'Chat'}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: duo pane */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="w-[65%] border-r border-border">
          <DuoLeftPane />
        </div>
        <div className="w-[35%]">
          <DuoRightPane schoolName={school.name} />
        </div>
      </div>

      {/* Mobile: single pane */}
      <div className="flex-1 min-h-0 md:hidden overflow-y-auto">
        {mobileSegment === 'preview' && (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Profile preview coming soon.
          </div>
        )}
        {mobileSegment === 'facts' && <KeyFactsList />}
        {mobileSegment === 'chat' && (
          <div className="h-full">
            <DuoRightPane schoolName={school.name} />
          </div>
        )}
      </div>
    </div>
  )
}
