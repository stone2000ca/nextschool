'use client'

import { useState, useCallback, useRef } from 'react'
import { updateSchool } from '@/lib/api/schools'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    "Hi! I'm your NextSchool account manager. I can help you update your school profile — just tell me what you'd like to change. For example, try \"Update day tuition to 32,000\" or \"Rephrase our mission to be shorter\".",
}

export default function useSchoolChat({ schoolId, schoolData, onSchoolUpdate }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [pendingChanges, setPendingChanges] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState(null)
  const contextRef = useRef(null)

  /** Update the active section context (called when left pane section changes) */
  const setContext = useCallback((ctx) => {
    contextRef.current = ctx
  }, [])

  /** Send a user message to the agent */
  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || isSending) return

      const userMsg = { role: 'user', content: text }
      setMessages((prev) => [...prev, userMsg])
      setIsSending(true)
      setApplyError(null)

      try {
        // Build conversation history (exclude welcome message for cleaner context)
        const history = messages
          .filter((m) => m !== WELCOME_MESSAGE)
          .map((m) => ({ role: m.role, content: m.content }))

        const res = await fetch(`/api/schools/${schoolId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            conversationHistory: history,
            context: contextRef.current || undefined,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Request failed (${res.status})`)
        }

        const { data } = await res.json()

        const assistantMsg = { role: 'assistant', content: data.reply }
        setMessages((prev) => [...prev, assistantMsg])

        // If agent proposed changes, add them to pending
        if (data.changes && data.changes.length > 0) {
          setPendingChanges((prev) => {
            // Merge: newer changes for the same field replace older ones
            const map = new Map(prev.map((c) => [c.field, c]))
            for (const change of data.changes) {
              map.set(change.field, change)
            }
            return Array.from(map.values())
          })
        }
      } catch (err) {
        const errorMsg = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setIsSending(false)
      }
    },
    [schoolId, messages, isSending]
  )

  /** Apply selected pending changes to the school profile */
  const applyChanges = useCallback(
    async (selectedChanges) => {
      if (!selectedChanges || selectedChanges.length === 0) return

      setIsApplying(true)
      setApplyError(null)

      try {
        // Build update payload
        const payload = {}
        const fieldNames = []

        for (const change of selectedChanges) {
          payload[change.field] = change.newValue
          fieldNames.push(change.field)
        }

        // Merge into ai_enriched_fields
        const existingAiFields = Array.isArray(schoolData?.ai_enriched_fields)
          ? schoolData.ai_enriched_fields
          : Array.isArray(schoolData?.aiEnrichedFields)
            ? schoolData.aiEnrichedFields
            : []
        payload.ai_enriched_fields = Array.from(
          new Set([...existingAiFields, ...fieldNames])
        )

        await updateSchool(schoolId, payload)

        // Remove applied changes from pending
        const appliedFields = new Set(fieldNames)
        setPendingChanges((prev) =>
          prev.filter((c) => !appliedFields.has(c.field))
        )

        // Notify parent of updated school data
        if (onSchoolUpdate) {
          const updatedSchool = { ...schoolData }
          for (const change of selectedChanges) {
            updatedSchool[change.field] = change.newValue
          }
          updatedSchool.ai_enriched_fields = payload.ai_enriched_fields
          onSchoolUpdate(updatedSchool)
        }

        // Confirmation message
        const confirmMsg = {
          role: 'assistant',
          content: `Done! I've applied ${selectedChanges.length} change${selectedChanges.length > 1 ? 's' : ''} to your profile. The updated fields are marked as AI-enriched — you can verify them in the Key Facts tab.`,
        }
        setMessages((prev) => [...prev, confirmMsg])
      } catch (err) {
        setApplyError(err.message || 'Failed to apply changes')
      } finally {
        setIsApplying(false)
      }
    },
    [schoolId, schoolData, onSchoolUpdate]
  )

  /** Discard all pending changes */
  const discardChanges = useCallback(() => {
    setPendingChanges([])
    setApplyError(null)
    const discardMsg = {
      role: 'assistant',
      content: 'Changes discarded. Let me know if you need anything else!',
    }
    setMessages((prev) => [...prev, discardMsg])
  }, [])

  /** Remove specific changes from pending */
  const removeChange = useCallback((field) => {
    setPendingChanges((prev) => prev.filter((c) => c.field !== field))
  }, [])

  return {
    messages,
    pendingChanges,
    isSending,
    isApplying,
    applyError,
    sendMessage,
    applyChanges,
    discardChanges,
    removeChange,
    setContext,
  }
}
