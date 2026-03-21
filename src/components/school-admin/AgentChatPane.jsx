'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ChatMessage from '@/components/school-admin/ChatMessage'
import PendingChangesBar from '@/components/school-admin/PendingChangesBar'
import ReviewChangesDialog from '@/components/school-admin/ReviewChangesDialog'
import useSchoolChat from '@/components/school-admin/useSchoolChat'

export default function AgentChatPane({ schoolId, schoolName, schoolData, activeSection, onSchoolUpdate }) {
  const {
    messages,
    pendingChanges,
    isSending,
    isApplying,
    applyError,
    sendMessage,
    applyChanges,
    discardChanges,
    setContext,
  } = useSchoolChat({ schoolId, schoolData, onSchoolUpdate })

  const [inputValue, setInputValue] = useState('')
  const [showReview, setShowReview] = useState(false)
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Sync active section context
  useEffect(() => {
    setContext(activeSection ? { activeSection: activeSection.title, sectionFields: activeSection.fields } : null)
  }, [activeSection, setContext])

  const handleSend = () => {
    if (!inputValue.trim() || isSending) return
    sendMessage(inputValue)
    setInputValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleReviewApply = (selectedChanges) => {
    applyChanges(selectedChanges)
    setShowReview(false)
  }

  const handleReviewDiscard = () => {
    discardChanges()
    setShowReview(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {schoolName || 'School'}
            </h2>
            <p className="text-xs text-muted-foreground">
              Your NextSchool account manager
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isSending && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending changes bar */}
      <PendingChangesBar
        count={pendingChanges.length}
        isApplying={isApplying}
        applyError={applyError}
        onReview={() => setShowReview(true)}
        onApplyAll={() => applyChanges(pendingChanges)}
        onDiscard={discardChanges}
      />

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your account manager..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1"
            disabled={isSending}
          />
          <Button
            size="icon"
            variant="default"
            className="bg-teal-600 hover:bg-teal-700 shrink-0"
            onClick={handleSend}
            disabled={isSending || !inputValue.trim()}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Review dialog */}
      {showReview && pendingChanges.length > 0 && (
        <ReviewChangesDialog
          changes={pendingChanges}
          isApplying={isApplying}
          onApply={handleReviewApply}
          onDiscard={handleReviewDiscard}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  )
}
