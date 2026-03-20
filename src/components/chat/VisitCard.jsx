'use client'

import React, { useState, useRef } from 'react'

// ─── Inline Icons ────────────────────────────────────────────────────────────

const ChevronDownIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS = {
  open_house: 'Open House',
  private_tour: 'Private Tour',
  info_night: 'Info Night',
  virtual: 'Virtual',
  other: 'Other',
}

const IMPRESSION_OPTIONS = [
  { value: 'loved_it', label: 'Loved it' },
  { value: 'mixed_feelings', label: 'Mixed feelings' },
  { value: 'not_for_us', label: 'Not for us' },
]

const VISIT_AGAIN_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
]

const BORDER_COLORS = {
  upcoming: '#0d9488',        // teal
  debrief_pending: '#d97706', // amber
  completed: '#64748b',       // slate
}

// ─── Pill selector ───────────────────────────────────────────────────────────

function PillGroup({ options, value, onChange, activeColor }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 14px',
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: selected ? `2px solid ${activeColor}` : '2px solid #d4c9a8',
              background: selected ? activeColor : '#fffdf5',
              color: selected ? '#fff' : '#5a4030',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── VisitCard ───────────────────────────────────────────────────────────────

export default function VisitCard({ visit, onUpdate }) {
  const { id, status, event_type, visit_date, prep_notes, impression, standout_moments, concerns, would_visit_again } = visit

  const [expanded, setExpanded] = useState(false)
  const [localPrepNotes, setLocalPrepNotes] = useState(prep_notes || '')
  const [localStandout, setLocalStandout] = useState(standout_moments || '')
  const [localConcerns, setLocalConcerns] = useState(concerns || '')
  const [localImpression, setLocalImpression] = useState(impression || '')
  const [localVisitAgain, setLocalVisitAgain] = useState(would_visit_again || '')
  const [saving, setSaving] = useState(false)

  const borderColor = BORDER_COLORS[status] || '#64748b'
  const eventLabel = EVENT_TYPE_LABELS[event_type] || event_type || 'Visit'
  const dateStr = visit_date
    ? new Date(visit_date).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'No date set'

  // Autosave free text on blur
  const handleBlurSave = (field, value) => {
    if (value !== visit[field]) {
      onUpdate(id, { [field]: value })
    }
  }

  // Save impressions → transition to completed
  const handleSaveImpressions = async () => {
    setSaving(true)
    try {
      await onUpdate(id, {
        impression: localImpression,
        standout_moments: localStandout,
        concerns: localConcerns,
        would_visit_again: localVisitAgain,
        status: 'completed',
      })
    } finally {
      setSaving(false)
    }
  }

  const textareaStyle = {
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    border: '1px solid #d4c9a8',
    borderRadius: 6,
    padding: '8px 10px',
    background: '#fffef8',
    fontSize: 12.5,
    color: '#3d3020',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    outline: 'none',
    minHeight: 60,
  }

  // ── Upcoming ────────────────────────────────────────────────────────────────
  if (status === 'upcoming') {
    return (
      <div style={{
        borderLeft: `4px solid ${borderColor}`,
        background: '#fffdf5',
        borderRadius: 6,
        padding: '14px 16px',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0d9488' }}>{eventLabel}</span>
            <span style={{ fontSize: 11, color: '#a89060' }}>{dateStr}</span>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: '#f0fdfa', color: '#0d9488', border: '1px solid #ccfbf1',
          }}>
            Upcoming
          </span>
        </div>

        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#5a4030', marginBottom: 4 }}>Prep notes</div>
          <textarea
            value={localPrepNotes}
            onChange={(e) => setLocalPrepNotes(e.target.value)}
            onBlur={() => handleBlurSave('prep_notes', localPrepNotes)}
            placeholder="Questions to ask, things to look for..."
            rows={2}
            style={textareaStyle}
          />
        </div>

        <div style={{ fontSize: 11, color: '#a89060', fontStyle: 'italic' }}>
          This card will update after your visit
        </div>
      </div>
    )
  }

  // ── Debrief Pending ─────────────────────────────────────────────────────────
  if (status === 'debrief_pending') {
    return (
      <div style={{
        borderLeft: `4px solid ${borderColor}`,
        background: '#fffdf5',
        borderRadius: 6,
        padding: '14px 16px',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>{eventLabel}</span>
            <span style={{ fontSize: 11, color: '#a89060' }}>{dateStr}</span>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a',
          }}>
            Needs debrief
          </span>
        </div>

        {/* Impression pills */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#5a4030', marginBottom: 6 }}>How did it go?</div>
          <PillGroup
            options={IMPRESSION_OPTIONS}
            value={localImpression}
            onChange={setLocalImpression}
            activeColor="#d97706"
          />
        </div>

        {/* Would visit again */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#5a4030', marginBottom: 6 }}>Would you visit again?</div>
          <PillGroup
            options={VISIT_AGAIN_OPTIONS}
            value={localVisitAgain}
            onChange={setLocalVisitAgain}
            activeColor="#d97706"
          />
        </div>

        {/* Standout moments */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#5a4030', marginBottom: 4 }}>What stood out?</div>
          <textarea
            value={localStandout}
            onChange={(e) => setLocalStandout(e.target.value)}
            onBlur={() => handleBlurSave('standout_moments', localStandout)}
            placeholder="Best moments, things that impressed you..."
            rows={2}
            style={textareaStyle}
          />
        </div>

        {/* Concerns */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#5a4030', marginBottom: 4 }}>Any concerns?</div>
          <textarea
            value={localConcerns}
            onChange={(e) => setLocalConcerns(e.target.value)}
            onBlur={() => handleBlurSave('concerns', localConcerns)}
            placeholder="Things that gave you pause..."
            rows={2}
            style={textareaStyle}
          />
        </div>

        {/* Save impressions button */}
        <button
          onClick={handleSaveImpressions}
          disabled={saving}
          style={{
            width: '100%',
            padding: '9px 0',
            background: saving ? '#a89060' : '#d97706',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save impressions'}
        </button>
      </div>
    )
  }

  // ── Completed ───────────────────────────────────────────────────────────────
  const impressionLabel = IMPRESSION_OPTIONS.find(o => o.value === impression)?.label || impression || ''
  const visitAgainLabel = VISIT_AGAIN_OPTIONS.find(o => o.value === would_visit_again)?.label || ''
  const oneLiner = [eventLabel, dateStr, impressionLabel].filter(Boolean).join(' · ')

  return (
    <div style={{
      borderLeft: `4px solid ${borderColor}`,
      background: '#fffdf5',
      borderRadius: 6,
      padding: expanded ? '14px 16px' : '10px 16px',
      marginBottom: 10,
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, color: '#5a4030' }}>{oneLiner}</span>
        <span style={{ color: '#a89060', flexShrink: 0 }}><ChevronDownIcon open={expanded} /></span>
      </button>

      {expanded && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#5a4030', lineHeight: 1.6 }}>
          {impressionLabel && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Impression:</span> {impressionLabel}
            </div>
          )}
          {visitAgainLabel && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Visit again:</span> {visitAgainLabel}
            </div>
          )}
          {standout_moments && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Standout:</span> {standout_moments}
            </div>
          )}
          {concerns && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Concerns:</span> {concerns}
            </div>
          )}
          {prep_notes && (
            <div>
              <span style={{ fontWeight: 600 }}>Prep notes:</span> {prep_notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
