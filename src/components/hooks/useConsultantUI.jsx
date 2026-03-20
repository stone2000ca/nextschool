import { useState, useEffect, useRef } from 'react';
import { STATES } from '@/lib/stateMachineConfig';
import { mapStateToView } from '@/components/hooks/useConversationState';

export function useConsultantUI({
  currentConversation, selectedSchool, schools,
  currentView, setCurrentView,
  isRestoringSessionRef, currentState,
  briefStatus, isTyping, messages,
  leftPanelMode,
}) {
  // Panel states
  const [activePanel, setActivePanel] = useState(null);
  const [showShortlistPanel, setShowShortlistPanel] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [tourRequestSchool, setTourRequestSchool] = useState(null);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [pendingNewConversation, setPendingNewConversation] = useState(false);
  const [limitReachedOpen, setLimitReachedOpen] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Mobile / scroll
  const [mobileView, setMobileView] = useState('chat');
  const chatScrollRef = useRef(null);
  const [savedScrollPosition] = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);

  // Transition / loading
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const briefConfirmTimeRef = useRef(null);
  const prevIsIntakePhaseRef = useRef(true);
  const skipViewOverrideRef = useRef(false);
  const [lastTypingTime, setLastTypingTime] = useState(Date.now());

  // DOM refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ─── View sync: selectedSchool is SINGLE SOURCE OF TRUTH for detail view ───
  useEffect(() => {
    if (skipViewOverrideRef.current) return;
    if (selectedSchool) {
      if (currentView !== 'detail') {
        console.log('[DETAIL VIEW] Setting view to detail for:', selectedSchool.name);
        setCurrentView('detail');
      }
      if (skipViewOverrideRef.current) skipViewOverrideRef.current = false;
      return;
    }
    const conversationState = currentConversation?.conversation_context?.state || STATES.WELCOME;
    setCurrentView(mapStateToView(conversationState));
  }, [currentConversation?.conversation_context?.state, selectedSchool, currentView]);

  // ─── isIntakePhase derived state ───
  const isIntakePhase = !isRestoringSessionRef.current && (
    schools.length === 0 &&
    currentView !== 'schools' &&
    currentView !== 'detail' &&
    leftPanelMode !== 'comparison' &&
    currentView !== 'comparison-table' &&
    ![STATES.RESULTS, STATES.DEEP_DIVE].includes(currentState)
  );
  const showSchoolGrid = schools.length > 0;

  // ─── Loading overlay driven by briefStatus ───
  useEffect(() => {
    if (briefStatus === 'confirmed') {
      setShowLoadingOverlay(true);
    } else if (showLoadingOverlay) {
      setShowLoadingOverlay(false);
    }
  }, [briefStatus]);

  useEffect(() => {
    if (showLoadingOverlay && !briefConfirmTimeRef.current) {
      briefConfirmTimeRef.current = Date.now();
    }
  }, [showLoadingOverlay]);

  // ─── BRIEF->RESULTS transition animation ───
  useEffect(() => {
    const wasIntake = prevIsIntakePhaseRef.current;
    prevIsIntakePhaseRef.current = isIntakePhase;
    if (wasIntake && !isIntakePhase) {
      setIsTransitioning(true);
      setTimeout(() => setIsTransitioning(false), 600);
    }
  }, [isIntakePhase]);

  // Save/restore scroll position during transition
  useEffect(() => {
    if (!isIntakePhase && chatScrollRef.current) {
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = savedScrollPosition;
        }
      }, 450);
    }
  }, [isIntakePhase]);

  // ─── Scroll detection for new message indicator ───
  useEffect(() => {
    if (chatScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      if (!isAtBottom) {
        setIsScrolledUp(true);
        setShowNewMessageIndicator(true);
      } else {
        setIsScrolledUp(false);
        setShowNewMessageIndicator(false);
      }
    }
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input after AI response
  useEffect(() => {
    if (!isTyping && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isTyping]);

  const handleScrollDownClick = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMessageIndicator(false);
  };

  return {
    // Panel states
    activePanel, setActivePanel,
    showShortlistPanel, setShowShortlistPanel,
    showNotesPanel, setShowNotesPanel,
    sidebarCollapsed, setSidebarCollapsed,
    tourRequestSchool, setTourRequestSchool,
    // Dialog states
    deleteDialogOpen, setDeleteDialogOpen,
    conversationToDelete, setConversationToDelete,
    archiveConfirmOpen, setArchiveConfirmOpen,
    pendingNewConversation, setPendingNewConversation,
    limitReachedOpen, setLimitReachedOpen,
    showLoginGate, setShowLoginGate,
    showUpgradeModal, setShowUpgradeModal,
    // Mobile / scroll
    mobileView, setMobileView,
    chatScrollRef, savedScrollPosition,
    isScrolledUp, showNewMessageIndicator,
    // Transition
    isTransitioning, setIsTransitioning,
    showLoadingOverlay, setShowLoadingOverlay,
    lastTypingTime, setLastTypingTime,
    // Refs
    messagesEndRef, inputRef, skipViewOverrideRef,
    // Derived
    isIntakePhase, showSchoolGrid,
    // Callbacks
    handleScrollDownClick,
  };
}
