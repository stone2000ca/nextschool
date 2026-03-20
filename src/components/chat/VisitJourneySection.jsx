'use client'

import React, { useState } from 'react'
import { useVisitRecords } from '@/components/hooks/useVisitRecords'
import VisitCard from './VisitCard'
import AddVisitModal from './AddVisitModal'

export default function VisitJourneySection({ schoolId }) {
  const { visits, isLoading, createVisit, updateVisit } = useVisitRecords({ schoolId })
  const [modalOpen, setModalOpen] = useState(false)

  if (!schoolId) return null

  // Sort: upcoming & debrief_pending first (by date asc), then completed (by date desc)
  const statusOrder = { upcoming: 0, debrief_pending: 1, completed: 2 }
  const sorted = [...visits].sort((a, b) => {
    const sa = statusOrder[a.status] ?? 2
    const sb = statusOrder[b.status] ?? 2
    if (sa !== sb) return sa - sb
    return new Date(a.visit_date || 0) - new Date(b.visit_date || 0)
  })

  const handleCreate = async (data) => {
    await createVisit({ ...data, school_id: schoolId })
  }

  const handleUpdate = async (id, data) => {
    await updateVisit(id, data)
  }

  return (
    <div style={{ padding: '0 20px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#3d3020' }}>Visit Journey</span>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#0d9488',
            background: 'none',
            border: '1px solid #0d9488',
            borderRadius: 6,
            padding: '4px 12px',
            cursor: 'pointer',
          }}
        >
          + Add Visit
        </button>
      </div>

      {/* Content */}
      {isLoading && visits.length === 0 ? (
        <div style={{ fontSize: 12, color: '#a89060', fontStyle: 'italic' }}>Loading visits...</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 12.5, color: '#a89060', marginBottom: 10 }}>
            You haven&apos;t planned any visits yet
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: '#0d9488',
              border: 'none',
              borderRadius: 7,
              padding: '8px 18px',
              cursor: 'pointer',
            }}
          >
            + Add Visit
          </button>
        </div>
      ) : (
        sorted.map((visit) => (
          <VisitCard key={visit.id} visit={visit} onUpdate={handleUpdate} />
        ))
      )}

      <AddVisitModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreate} />
    </div>
  )
}
