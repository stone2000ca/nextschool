'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * useVisitRecords — CRUD + auto-transition for visit records.
 *
 * @param {{ schoolId?: string }} props
 * @returns {{ visits, allVisits, isLoading, error, createVisit, updateVisit, refreshVisits, loadAllVisits, checkAndTransitionVisits }}
 */
export function useVisitRecords({ schoolId } = {}) {
  const [visits, setVisits] = useState([])
  const [allVisits, setAllVisits] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const hasTransitioned = useRef(false)

  // Fetch visits for a specific school
  const refreshVisits = useCallback(async () => {
    if (!schoolId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/visit?schoolId=${encodeURIComponent(schoolId)}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setVisits(data)
    } catch (err) {
      console.error('[useVisitRecords] refreshVisits failed:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [schoolId])

  // Fetch all visits cross-school (also runs server-side auto-transition)
  const loadAllVisits = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/visits')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAllVisits(data)
    } catch (err) {
      console.error('[useVisitRecords] loadAllVisits failed:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Client-side transition check: calls /api/visits which auto-transitions,
  // then refreshes the school-scoped list
  const checkAndTransitionVisits = useCallback(async () => {
    try {
      const res = await fetch('/api/visits')
      if (!res.ok) throw new Error(await res.text())
      // After transition, refresh the school-scoped list
      if (schoolId) await refreshVisits()
    } catch (err) {
      console.error('[useVisitRecords] checkAndTransitionVisits failed:', err)
    }
  }, [schoolId, refreshVisits])

  // Create a visit record
  const createVisit = useCallback(async (data) => {
    setError(null)
    try {
      const res = await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await res.text())
      const record = await res.json()
      // Optimistic: prepend to local list
      setVisits((prev) => [record, ...prev])
      return record
    } catch (err) {
      console.error('[useVisitRecords] createVisit failed:', err)
      setError(err.message)
      throw err
    }
  }, [])

  // Update a visit record
  const updateVisit = useCallback(async (id, data) => {
    setError(null)
    try {
      const res = await fetch(`/api/visit/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      // Optimistic: replace in local list
      setVisits((prev) => prev.map((v) => (v.id === id ? updated : v)))
      return updated
    } catch (err) {
      console.error('[useVisitRecords] updateVisit failed:', err)
      setError(err.message)
      throw err
    }
  }, [])

  // On mount / schoolId change: auto-transition then fetch
  useEffect(() => {
    if (!schoolId) return
    hasTransitioned.current = false
  }, [schoolId])

  useEffect(() => {
    if (!schoolId || hasTransitioned.current) return
    hasTransitioned.current = true
    checkAndTransitionVisits()
  }, [schoolId, checkAndTransitionVisits])

  return {
    visits,
    allVisits,
    isLoading,
    error,
    createVisit,
    updateVisit,
    refreshVisits,
    loadAllVisits,
    checkAndTransitionVisits,
  }
}
