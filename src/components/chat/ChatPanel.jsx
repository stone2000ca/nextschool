import { useState, useRef, useEffect, forwardRef } from 'react';
import { Lock } from 'lucide-react';
import { School } from '@/lib/entities';
import { STATES, BRIEF_STATUS } from '@/lib/stateMachineConfig';
import { Button } from "@/components/ui/button";
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import TypingIndicator from '@/components/chat/TypingIndicator';
import DeepDiveLoader from '@/components/chat/DeepDiveLoader';
import DeepDiveConfirmation from '@/components/dialogs/DeepDiveConfirmation';
import Link from 'next/link';
import { CONSULTANT_AVATARS } from '@/lib/brand-assets';

/**
 * Shared chat panel used in both intake (centered modal) and results (sidebar) phases.
 * Renders: consultant header, message list, response chips, chat input.
 * Parent provides the outer container.
 */
const ChatPanel = forwardRef(function ChatPanel({
  // Data
  messages = [],
  schools = [],
  selectedConsultant,
  currentState,
  briefStatus,
  isTyping,
  tokenBalance,
  isPremium,
  loadingStage,
  loadingStages,
  feedbackPromptShown,
  // Callbacks
  onSendMessage,
  onViewSchoolDetail,
  onConfirmDeepDive,
  onCancelDeepDive,
  onUpgrade,
  // Optional props
  confirmingSchool = null,
  familyProfile = null,
  showNewMessageIndicator = false,
  onScrollDownClick = null,
  onTogglePanel = null,
  onSetExpandedSchool = null,
  deepDiveSchoolName = null,
  // Slots
  heroContent = null,
  // Variant: 'intake' (light feedback) or 'sidebar' (dark feedback)
  variant = 'sidebar',
}, inputRef) {

  const messagesEndRef = useRef(null);
  const prevMessageCountRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    // Bug 1 fix: When first greeting arrives (0 → 1 messages), use a longer delay
    // so the hero card has time to render before we scroll past it
    const isInitialGreeting = prevMessageCountRef.current === 0 && messages.length === 1;
    const delay = isInitialGreeting ? 350 : 50;
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, delay);
    prevMessageCountRef.current = messages.length;
    return () => clearTimeout(timer);
  }, [messages]);

  // Bug 4 fix: Auto-scroll when confirmingSchool prompt chip appears
  useEffect(() => {
    if (confirmingSchool) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [confirmingSchool]);

  const accentColor = selectedConsultant === 'Jackie' ? '#C27B8A' : '#6B9DAD';
  const accentClass = selectedConsultant === 'Jackie' ? 'text-[#C27B8A]' : 'text-[#6B9DAD]';
  const accentBgClass = selectedConsultant === 'Jackie' ? 'bg-[#C27B8A]' : 'bg-[#6B9DAD]';

  // Shared school profile lookup callback
  const handleViewSchoolProfile = async (slug) => {
    let school = schools?.find(s =>
      s.slug === slug ||
      s.name.toLowerCase() === slug.toLowerCase() ||
      s.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === slug
    );

    if (school) {
      onViewSchoolDetail(school);
    } else {
      try {
        let results = await School.filter({ slug });
        if (!results || results.length === 0) {
          results = await School.filter({ name: { $regex: slug.replace(/-/g, ' '), $options: 'i' } });
        }
        if (results && results.length > 0) {
          onViewSchoolDetail(results[0]);
        }
      } catch (error) {
        console.error('Error finding school:', error);
      }
    }
  };

  // Response chips logic
  const shouldShowChips = (() => {
    // Never show chips if brief is already confirmed (DOUBLE-BRIEF FIX)
    if (briefStatus === BRIEF_STATUS.CONFIRMED) return false;
    // E47: DISCOVERY response chips removed — only BRIEF confirmation chips remain
    return (currentState === STATES.BRIEF && [BRIEF_STATUS.PENDING_REVIEW, BRIEF_STATUS.EDITING].includes(briefStatus));
  })();

  const isBriefChipState = currentState === STATES.BRIEF &&
    [BRIEF_STATUS.PENDING_REVIEW, BRIEF_STATUS.EDITING].includes(briefStatus);

  // Chip text varies slightly between intake and sidebar
  const briefConfirmText = variant === 'intake'
    ? "That looks right - show me schools"
    : "That's right, let's see the schools";
  const briefAdjustText = variant === 'intake'
    ? "I would like to adjust"
    : "I'd like to adjust something";
  const briefConfirmPayload = "__CONFIRM_BRIEF__";
  const briefConfirmDisplay = variant === 'intake'
    ? "That looks right - show me schools"
    : "That's right, let's see the schools";

  return (
    <>
      {/* Consultant Header */}
      <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between bg-[#2A2A3D]">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <img
            src={CONSULTANT_AVATARS[selectedConsultant] || CONSULTANT_AVATARS.Jackie}
            alt={selectedConsultant}
            className="h-8 sm:h-10 w-8 sm:w-10 rounded-full object-cover flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h2 className={`font-bold text-base sm:text-lg truncate ${accentClass}`}>
              {selectedConsultant}
            </h2>
            {isTyping ? (
              <p className="text-xs text-[#E8E8ED]/60">{selectedConsultant} is thinking...</p>
            ) : (
              <p className="text-xs text-[#E8E8ED]/60">Education Consultant</p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#1E1E2E] min-h-0 pb-32">
        {/* Optional hero content (welcome explainer in intake phase) */}
        {heroContent}

        {/* Feedback Prompt */}
        {feedbackPromptShown && schools.length > 0 && !isTyping && (
          variant === 'intake' ? (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm text-teal-900">
                  I hope that was helpful! If you have a minute, I'd love to hear how this went for you.
                </p>
              </div>
              <Link href="/feedback" className="flex-shrink-0">
                <Button size="sm" variant="outline" className="border-teal-600 text-teal-600 hover:bg-teal-50">
                  Share Feedback
                </Button>
              </Link>
            </div>
          ) : (
            <div className="bg-teal-900/30 border border-teal-500/30 rounded-lg p-3 mb-2">
              <p className="text-sm text-[#E8E8ED] mb-2">
                I hope that was helpful! If you have a minute, I'd love to hear how this went for you.
              </p>
              <Link href="/feedback" className="block">
                <Button size="sm" variant="outline" className="w-full border-teal-500 text-teal-400 hover:bg-teal-900/50">
                  Share Feedback
                </Button>
              </Link>
            </div>
          )
        )}

        {messages.filter(msg => msg?.content && msg.content.trim() !== '').map((msg, index) => {
          // F14 FIX: skip blank/empty message bubbles
          const isLastAssistant =
            msg.role === 'assistant' &&
            index === messages.map(m => m.role).lastIndexOf('assistant');

          return (
            <div key={index}>
              <MessageBubble
                message={msg}
                isUser={msg.role === 'user'}
                schools={schools}
                consultantName={selectedConsultant}
                onViewSchoolProfile={handleViewSchoolProfile}
              />
              {msg.retryAction === 'GUIDED_INTRO_RETRY' && msg.role === 'assistant' && !isTyping && (
                <button
                  onClick={() => onSendMessage?.('__GUIDED_INTRO_COMPLETE__', null, null)}
                  className="mt-2 ml-11 text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
                  style={{ background: '#18968a', color: '#fff', border: 'none' }}
                >
                  Try Again
                </button>
              )}
              {msg.deepDiveAnalysis && msg.role === 'assistant' && !isTyping && onTogglePanel && onSetExpandedSchool && (
                <button
                  onClick={() => {
                    onTogglePanel('shortlist');
                    onSetExpandedSchool(msg.deepDiveAnalysis.schoolId);
                  }}
                  className="mt-1 ml-11 text-xs font-medium px-3 py-1 rounded-full transition-colors"
                  style={{ background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)', color: '#2dd4bf' }}
                >
                  View full analysis →
                </button>
              )}
            </div>
          );
        })}

        {/* DeepDive confirmation (results panel only) */}
        {confirmingSchool && (
          <DeepDiveConfirmation
            school={confirmingSchool}
            childName={familyProfile?.childName}
            consultantName={selectedConsultant}
            onAnalyze={() => onConfirmDeepDive(confirmingSchool)}
            onCancel={onCancelDeepDive}
            isLoading={isTyping}
          />
        )}

        {isTyping && (
          deepDiveSchoolName
            ? <DeepDiveLoader schoolName={deepDiveSchoolName} consultantName={selectedConsultant} />
            : <TypingIndicator message={loadingStages[loadingStage]} consultantName={selectedConsultant} />
        )}

        <div ref={messagesEndRef} />

        {/* New Message Indicator (results panel only) */}
        {showNewMessageIndicator && !isTyping && onScrollDownClick && (
          <div className="flex justify-center sticky bottom-0 z-30 pt-2">
            <Button
              onClick={onScrollDownClick}
              className="bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-full shadow-lg"
            >
              New message ↓
            </Button>
          </div>
        )}
      </div>

      {/* Response Chips */}
      {shouldShowChips && (
        <div className="p-3 sm:p-4 border-t border-white/10 bg-[#2A2A3D] flex flex-col sm:flex-row flex-wrap gap-2 justify-center">
          {isBriefChipState && (
            <>
              <Button
                variant="outline"
                onClick={() => onSendMessage(briefConfirmPayload, null, briefConfirmDisplay)}
                disabled={isTyping}
                className="text-sm px-4 py-2 rounded-full border-2 font-medium bg-teal-600 border-teal-600 text-white hover:bg-teal-700 hover:border-teal-700"
              >
                {briefConfirmText}
              </Button>
              <Button
                variant="outline"
                onClick={() => onSendMessage(briefAdjustText)}
                disabled={isTyping}
                className="text-sm px-4 py-2 rounded-full bg-teal-600 border-teal-600 text-white hover:bg-teal-700 hover:border-teal-700"
              >
                {briefAdjustText}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Chat Input */}
      <div className={variant === 'sidebar' ? "sticky bottom-0 z-40 bg-[#2A2A3D] border-t border-white/10" : ""}>
        <ChatInput
          ref={inputRef}
          onSend={onSendMessage}
          disabled={isTyping}
          tokenBalance={tokenBalance}
          isPremium={isPremium}
        />
      </div>
    </>
  );
});

export default ChatPanel;