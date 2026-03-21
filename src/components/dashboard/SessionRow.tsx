'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Edit2, Share2, Archive } from 'lucide-react'
import type { ChatSessionRecord } from '@/lib/api/types'
import type { JourneyStageResult, JourneyStage } from '@/lib/sessions/deriveJourneyStage'

// ─── Badge label mapping ────────────────────────────────────────────
const STAGE_LABELS: Record<JourneyStage, string> = {
  DEBRIEF_PENDING: '📋 Debrief Waiting',
  VISIT_UPCOMING: '🗓 Visit Soon',
  DECIDING: '⚖️ Ready to Decide',
  RESEARCHING: '🔍 Researching',
  SHORTLISTING: '🔖 Shortlisting',
  RESULTS_READY: '✨ Results Ready',
  BRIEF_INCOMPLETE: '📝 Brief Incomplete',
}

// ─── Grade display helper ───────────────────────────────────────────
function gradeLabel(grade: number | null | undefined): string {
  if (grade == null) return ''
  if (grade === 0) return 'JK/SK'
  return `Grade ${grade}`
}

// ─── Props ──────────────────────────────────────────────────────────
interface SessionRowProps {
  session: ChatSessionRecord
  journeyStage: JourneyStageResult
  isPaid: boolean
  onArchive: () => void
  onEditRequest: (session: ChatSessionRecord) => void
}

export default function SessionRow({
  session,
  journeyStage,
  isPaid,
  onArchive,
  onEditRequest,
}: SessionRowProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close overflow menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const initial = (session.child_name ?? '?')[0].toUpperCase()
  const grade = gradeLabel(session.child_grade)
  const isHigh = journeyStage.urgency === 'HIGH'
  const badgeLabel = STAGE_LABELS[journeyStage.stage]

  return (
    <div
      className="group flex items-center gap-4 px-5 py-4 w-full rounded-lg
                 bg-[#22222E] hover:bg-[#2C2C3A] transition-colors
                 border-l-2 border-transparent hover:border-teal-400"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-teal-600 text-white font-semibold text-sm">
        {initial}
      </div>

      {/* Info block */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-medium truncate">{session.child_name ?? 'Unnamed'}</span>
          {grade && (
            <>
              <span className="text-white/30">·</span>
              <span className="text-white/50 text-sm">{grade}</span>
            </>
          )}
        </div>
        <p className="text-white/50 text-sm truncate mt-0.5">{journeyStage.statusLine}</p>
      </div>

      {/* Stage badge */}
      <span
        className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isHigh
            ? 'bg-amber-500/20 text-amber-300'
            : 'bg-white/10 text-white/50'
        }`}
      >
        {badgeLabel}
      </span>

      {/* CTA button */}
      <button
        onClick={() => router.push(journeyStage.ctaRoute)}
        className="flex-shrink-0 px-4 py-1.5 rounded-md bg-teal-600 hover:bg-teal-500
                   text-white text-sm font-medium transition-colors"
      >
        {journeyStage.ctaLabel}
      </button>

      {/* Overflow menu */}
      <div ref={menuRef} className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="More actions"
        >
          <MoreVertical size={16} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 rounded-md bg-[#2C2C3A] border border-white/10 shadow-lg z-50 py-1">
            <button
              onClick={() => { setMenuOpen(false); onEditRequest(session) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Edit2 size={14} />
              Edit Profile
            </button>
            <button
              onClick={() => { setMenuOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Share2 size={14} />
              Share
            </button>
            <button
              onClick={() => { setMenuOpen(false); onArchive() }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Archive size={14} />
              Archive
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
