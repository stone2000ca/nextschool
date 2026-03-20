'use client'

import React, { useState } from 'react'

const EVENT_TYPES = [
  { value: 'open_house', label: 'Open House' },
  { value: 'private_tour', label: 'Private Tour' },
  { value: 'info_night', label: 'Info Night' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'other', label: 'Other' },
]

export default function AddVisitModal({ open, onClose, onCreate }) {
  const [eventType, setEventType] = useState('open_house')
  const [visitDate, setVisitDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async () => {
    if (!visitDate) return
    setSubmitting(true)
    try {
      await onCreate({ event_type: eventType, visit_date: visitDate, status: 'upcoming' })
      setEventType('open_house')
      setVisitDate('')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d4c9a8',
    borderRadius: 6,
    padding: '9px 10px',
    background: '#fffef8',
    fontSize: 13,
    color: '#3d3020',
    fontFamily: 'inherit',
    outline: 'none',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fffdf5',
          borderRadius: 10,
          padding: '24px',
          width: 360,
          maxWidth: '90vw',
          boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2d1e0e', marginBottom: 18 }}>
          Add Visit
        </div>

        {/* Event type */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#5a4030', display: 'block', marginBottom: 5 }}>
            Event type
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#5a4030', display: 'block', marginBottom: 5 }}>
            Date
          </label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: 'none',
              border: '1px solid #d4c9a8',
              color: '#5a4030',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!visitDate || submitting}
            style={{
              padding: '8px 18px',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              cursor: !visitDate || submitting ? 'not-allowed' : 'pointer',
              background: !visitDate || submitting ? '#a89060' : '#0d9488',
              color: '#fff',
              border: 'none',
            }}
          >
            {submitting ? 'Adding...' : 'Add Visit'}
          </button>
        </div>
      </div>
    </div>
  )
}
