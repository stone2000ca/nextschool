import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useAuth } from '@/lib/AuthContext';
import { School, SchoolJourney, FamilyJourney, ResearchNote, SchoolInquiry } from '@/lib/entities';
import { updateConversation } from '@/lib/api/conversations';
import { invokeFunction } from '@/lib/functions';
import { STATES } from '@/lib/stateMachineConfig';
import { restoreGuestSession } from '@/components/chat/SessionRestorer';
import { handleNarrateComparison as narrateComparison } from '@/components/chat/handleNarrateComparison';

import { toast } from "sonner";
import IconRail from '@/components/navigation/IconRail';
import FamilyBrief from '@/components/chat/FamilyBrief';
import ConsultantSelection from '@/components/chat/ConsultantSelection';
import GuidedIntro from '@/components/chat/GuidedIntro';
import { LayoutGroup } from 'framer-motion';
import SchoolGrid from '@/components/schools/SchoolGrid';
import SchoolDetailPanel from '@/components/schools/SchoolDetailPanel';
import ShortlistPanel from '@/components/chat/ShortlistPanel';
import AddSchoolPanel from '@/components/chat/AddSchoolPanel';
import TimelinePanel from '@/components/chat/TimelinePanel';
import NotesPanel from '@/components/chat/NotesPanel';
import ComparisonView from '@/components/schools/ComparisonView';
import { buildTiers } from '../components/utils/tierEngine';
import { useUserLocation } from '../components/hooks/useUserLocation';
import { useShortlist } from '../components/hooks/useShortlist';
import { useDataLoader } from '../components/hooks/useDataLoader';
import { restoreSessionFromParam, restoreMostRecentConversation } from '@/components/chat/SessionRestorer';
import ConsultantDialogs from '@/components/chat/ConsultantDialogs';
import ChatPanel from '@/components/chat/ChatPanel';
import ProgressBar from '@/components/ui/progress-bar';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/navigation/Navbar';
import TourRequestModal from '../components/schools/TourRequestModal';
import { useSchoolFiltering } from '@/components/hooks/useSchoolFiltering';
import { useMessageHandler } from '@/components/hooks/useMessageHandler';
import { useArtifacts } from '@/components/hooks/useArtifacts';
import { useConversationState, mapStateToView } from '@/components/hooks/useConversationState';
import { useSchoolResults } from '@/components/hooks/useSchoolResults';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import ResearchNotepad from '@/components/ui/ResearchNotepad';
import { getSchoolsWithDeepDive } from '../components/utils/deepDiveUtils';

const PLAN_NAMES = { FREE: 'free', BASIC: 'basic', PREMIUM: 'premium', PRO: 'pro', ENTERPRISE: 'enterprise' };

const DEFAULT_GREETING = "Hi! I'm your NextSchool education consultant. I help families across Canada, the US, and Europe find the perfect private school. Tell me about your child — what grade are they in, and what matters most to you in a school?";

export default function Consultant() {
  // ─── Hooks setup ───────────────────────────────────────────────
  const trackEvent = (typeof window !== 'undefined' && window.trackEvent) ? window.trackEvent : (name, data) => {};
  const { user: authUser, isAuthenticated: authIsAuthenticated, updateMe: authUpdateMe } = useAuth();

   const searchParams = useSearchParams();
   const router = useRouter();
   const sessionIdParam = searchParams.get('sessionId');
   const sessionParamProcessedRef = useRef(false);

  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const skipViewOverrideRef = useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [selectedConsultant, setSelectedConsultant] = useState(null);
  const [showGuidedIntro, setShowGuidedIntro] = useState(false);
  const [familyBrief, setFamilyBrief] = useState(null);
  // Ref ensures handleGuidedIntroComplete's setTimeout closure
  // always reads the latest familyBrief, even before React re-renders.
  const familyBriefRef = useRef(null);
  const [feedbackPromptShown, setFeedbackPromptShown] = useState(false);

  // ─── School results state (Phase 3c hook) ──────────────────────
  const {
    schools, setSchools,
    previousSearchResults, setPreviousSearchResults,
    selectedSchool, setSelectedSchool,
    extraSchools, setExtraSchools,
    extraSchoolsPage, setExtraSchoolsPage,
    extraSchoolsHasMore, setExtraSchoolsHasMore,
    extraSchoolsLoading,
    extraSchoolsError,
    loadMoreSchools: _loadMoreSchools,
    priorityOverrides, setPriorityOverrides,
    handlePriorityToggle,
    confirmingSchool, setConfirmingSchool,
    schoolsAnimKey, setSchoolsAnimKey,
    leftPanelMode, setLeftPanelMode,
    resetSchoolState,
  } = useSchoolResults();

  // ─── Conversation state (Phase 3b hook) ──────────────────────
  const {
    currentConversation, setCurrentConversation,
    conversations,
    briefStatus, setBriefStatus,
    onboardingPhase, setOnboardingPhase,
    currentView, setCurrentView,
    sessionId,
    sessionRestored, setSessionRestored,
    restoringSession, setRestoringSession,
    debugInfo, setDebugInfo,
    pendingMessage, setPendingMessage,
    isRestoringSessionRef,
    isLoading: conversationLoading,
    loadConversations,
    createConversation: createConversationRecord,
    switchConversation,
    deleteConversation: archiveConversation,
  } = useConversationState({
    userId: authUser?.id,
    isAuthenticated: authIsAuthenticated,
    user: authUser,
    selectedSchool,
    setSchools,
    initialPendingMessage: searchParams.get('q') || null,
  });


  // Chat states
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(100);
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Panel states
  const [showShortlistPanel, setShowShortlistPanel] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [tourRequestSchool, setTourRequestSchool] = useState(null);

  // Distance feature
  const userLocation = useUserLocation();

  // Delete conversation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  
  // Archive confirmation for profile limit
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [pendingNewConversation, setPendingNewConversation] = useState(false);
  
  // Mobile toggle
  const [mobileView, setMobileView] = useState('chat');
  
  // Scroll position preservation
  const chatScrollRef = useRef(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);
  
  // New message indicator
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  
  // Limit reached dialog
  const [limitReachedOpen, setLimitReachedOpen] = useState(false);
  
  // Login gate
  const [showLoginGate, setShowLoginGate] = useState(false);
  
  // Panel states (continued)
  const [lastTypingTime, setLastTypingTime] = useState(Date.now());
  // T046: Right-side rail panel state
  const [activePanel, setActivePanel] = useState(null); // 'brief' | 'shortlist' | null

  // BRIEF→RESULTS transition animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevIsIntakePhaseRef = useRef(true);

  // Contact Log data
  const [contactLog, setContactLog] = useState([]);

  // Research Notes
  const [researchNotes, setResearchNotes] = useState('');

  // E39-S8: Memoized set of schools with deep dive analysis
  const schoolsWithDeepDive = useMemo(() => getSchoolsWithDeepDive(messages), [messages]);

  // Phase 3a: Artifact state from conversation_artifacts table (replaces S4a-S4d rehydration)
  const {
    deepDiveAnalysis, setDeepDiveAnalysis,
    visitPrepKit, setVisitPrepKit,
    actionPlan, setActionPlan,
    fitReEvaluation, setFitReEvaluation,
    comparisonData, setComparisonData,
    comparisonMatrix, setComparisonMatrix,
    hydrationSource, setHydrationSource,
    isLoading: artifactsLoading,
    refreshArtifacts,
    clearAll: clearAllArtifacts,
  } = useArtifacts(currentConversation?.id, selectedSchool?.id);

  // Journey Steps: fetch when selected school changes
  const [schoolJourney, setSchoolJourney] = useState(null);
  useEffect(() => {
    if (!selectedSchool?.id || !isAuthenticated || !user?.id) {
      setSchoolJourney(null);
      return;
    }
    (async () => {
      try {
        const journeys = await FamilyJourney.filter({ user_id: user.id, is_archived: false });
        if (!journeys.length) { setSchoolJourney(null); return; }
        const journey = journeys.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        const schoolJourneys = await SchoolJourney.filter({ family_journey_id: journey.id, school_id: selectedSchool.id });
        const sj = schoolJourneys[0] || null;
        setSchoolJourney(sj);
      } catch { setSchoolJourney(null); }
    })();
  }, [selectedSchool?.id, isAuthenticated, user?.id]);

  const journeySteps = useMemo(() => {
    if (!selectedSchool?.id) return null;
    const steps = [
      { label: 'Match Found', done: true },
      { label: 'Deep Dive', done: !!deepDiveAnalysis },
      { label: 'Book Tour', done: false },
      { label: 'Debrief Tour', done: false },
      { label: 'Apply', done: false },
    ];
    let activeFound = false;
    return steps.map(s => {
      if (s.done) return { label: s.label, status: 'completed' };
      if (!activeFound) { activeFound = true; return { label: s.label, status: 'active' }; }
      return { label: s.label, status: 'pending' };
    });
  }, [selectedSchool?.id, deepDiveAnalysis, schoolJourney]);

  // Research Notes: fetch when selected school changes
  useEffect(() => {
    if (!selectedSchool?.id || !isAuthenticated || !user?.id) {
      setResearchNotes('');
      return;
    }
    ResearchNote.filter({ user_id: user.id, school_id: selectedSchool.id }).then(results => {
      setResearchNotes(results[0]?.notes || '');
    }).catch(() => setResearchNotes(''));
  }, [selectedSchool?.id, isAuthenticated, user?.id]);

  const handleSaveNotes = async () => {
    if (!selectedSchool?.id || !user?.id) return;
    const existing = await ResearchNote.filter({ user_id: user.id, school_id: selectedSchool.id });
    if (existing.length > 0) {
      await ResearchNote.update(existing[0].id, { notes: researchNotes, updated_at: new Date().toISOString() });
    } else {
      await ResearchNote.create({ user_id: user.id, school_id: selectedSchool.id, notes: researchNotes, updated_at: new Date().toISOString() });
    }
  };

  // Contact Log: fetch inquiries when selected school changes
  useEffect(() => {
    if (!selectedSchool?.id || !isAuthenticated) {
      setContactLog([]);
      return;
    }
    SchoolInquiry.filter({ school_id: selectedSchool.id }).then(inquiries => {
      setContactLog(inquiries.map(inq => ({
        type: inq.inquiry_type === 'tour_request' ? 'Tour Request' : 'General Inquiry',
        date: new Date(inq.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: inq.tour_status || inq.status || 'pending',
        note: inq.special_requests || '',
      })));
    }).catch(() => setContactLog([]));
  }, [selectedSchool?.id, isAuthenticated]);

  // E30-012: Prevent double-processing the same deep dive school
  const deepDiveAutoAddedRef = useRef(new Set());
  // E32-003: Prevent double-processing the same UI action
  const processedActionsRef = useRef(new Set());

  // Progressive loading states
  const [loadingStage, setLoadingStage] = useState(0);
  const loadingStages = [
    "Analyzing request...",
    "Searching schools...",
    "Preparing recommendations..."
  ];
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ─── Derived state ──────────────────────────────────────────────
  const currentState = currentConversation?.conversation_context?.state || STATES.WELCOME;

  // Data loader hook — must come before useShortlist so familyProfile is available
  const {
    familyProfile, setFamilyProfile,
    artifactCache, setArtifactCache,
    schoolAnalyses, setSchoolAnalyses,
    visitedSchoolIds, setVisitedSchoolIds,
    activeJourney, setActiveJourney,
    extractedEntitiesData, setExtractedEntitiesData,
    restoredSessionData, setRestoredSessionData,
    loadFamilyProfile,
    loadPreviousArtifacts,
  } = useDataLoader({
    user, currentConversation, isAuthenticated,
  });

  // Shortlist hook — must come after useDataLoader so familyProfile is defined
  const {
    shortlistData, setShortlistData,
    removedSchoolIds, setRemovedSchoolIds,
    expandedCardCount, setExpandedCardCount,
    autoExpandSchoolId, setAutoExpandSchoolId,
    pendingDeepDiveSchoolIds, setPendingDeepDiveSchoolIds,
    hasAutoPopulatedShortlist,
    loadShortlist,
    handleToggleShortlist,
    injectShortlistNudge,
    handleDossierExpandChange,
    handleDeepDiveFromDossier,
  } = useShortlist({
    user, setUser, isAuthenticated, schools, currentState,
    selectedConsultant, familyProfile, setMessages, trackEvent, setShowLoginGate,
    onConfirmDeepDive: (school) => handleConfirmDeepDive(school),
    currentConversation,
    activeJourney,
    extraSchools,
  });

  // ─── Side effects ───────────────────────────────────────────────

  // BUG-DD-001 FIX: selectedSchool is the SINGLE SOURCE OF TRUTH for detail view
  useEffect(() => {
    if (skipViewOverrideRef.current) return;
    // CRITICAL: If a school is selected, ALWAYS maintain detail view - no exceptions
    if (selectedSchool) {
      if (currentView !== 'detail') {
        console.log('[DETAIL VIEW] Setting view to detail for:', selectedSchool.name);
        setCurrentView('detail');
      }
      if (skipViewOverrideRef.current) skipViewOverrideRef.current = false;
      return;
    }
    
    // Only sync view from state if NO school is selected
    const conversationState = currentConversation?.conversation_context?.state || STATES.WELCOME;
    setCurrentView(mapStateToView(conversationState));
  }, [currentConversation?.conversation_context?.state, selectedSchool, currentView]);
  
  const isIntakePhase = !isRestoringSessionRef.current && (
                        schools.length === 0 && 
                        currentView !== 'schools' && 
                        currentView !== 'detail' && 
                        leftPanelMode !== 'comparison' &&
                        currentView !== 'comparison-table' &&
                        ![STATES.RESULTS, STATES.DEEP_DIVE].includes(currentState)
                      );

  // Override: show split layout if schools exist (from session restore)
  const showSchoolGrid = schools.length > 0;

  // Track when brief was confirmed for minimum 5-second display
  const briefConfirmTimeRef = useRef(null);

  // E37: Show loading overlay when brief confirmed and consultant is typing
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);

  // P0 hotfix: Drive overlay via state, not derived from isTyping
  useEffect(() => {
    if (briefStatus === 'confirmed') {
      setShowLoadingOverlay(true);
    } else if (showLoadingOverlay) {
      setShowLoadingOverlay(false);
    }
  }, [briefStatus]);

  // Enforce minimum 5-second display for loading overlay
  useEffect(() => {
    if (showLoadingOverlay && !briefConfirmTimeRef.current) {
      briefConfirmTimeRef.current = Date.now();
    }
  }, [showLoadingOverlay]);


  // School filtering/sorting via extracted hook
  const {
    filteredSchools,
    showDistances,
    applyDistances,
    resetSort,
    filterOverrides,
    setFilterOverrides,
    resetFilterOverrides,
  } = useSchoolFiltering(schools, currentConversation?.conversation_context);

  // BRIEF→RESULTS transition animation
  useEffect(() => {
    const wasIntake = prevIsIntakePhaseRef.current;
    prevIsIntakePhaseRef.current = isIntakePhase;
    if (wasIntake && !isIntakePhase) {
      // Just switched from intake → results: trigger animation
      setIsTransitioning(true);
      setTimeout(() => setIsTransitioning(false), 600);
    }
  }, [isIntakePhase]);

  // TASK B: Save/restore scroll position during transition
  useEffect(() => {
    if (!isIntakePhase && chatScrollRef.current) {
      // Entering results phase - restore scroll
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = savedScrollPosition;
        }
      }, 450); // After transition completes
    }
  }, [isIntakePhase]);

  // Dev mode bypass for login gate
  const isDevMode = new URLSearchParams(window.location.search).get('dev') === 'true';
  // E18c-001: Debug panel
  const isDebugMode = new URLSearchParams(window.location.search).get('debug') === 'true';

  useEffect(() => {
    // Set meta tags for SEO
    document.title = 'Meet Your Education Consultant | NextSchool';
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'Chat with Jackie or Liam, your AI education consultants. Get personalized private school recommendations in minutes.';

    // Structured data for Service
    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'School Search Consulting',
      description: 'AI-powered personalized private school recommendations',
      provider: {
        '@type': 'Organization',
        name: 'NextSchool',
        url: 'https://nextschool.ca'
      },
      areaServed: ['CA', 'US', 'EU'],
      serviceType: 'Educational Consulting'
    };

    let schemaScript = document.querySelector('script[data-schema="consultant"]');
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.type = 'application/ld+json';
      schemaScript.setAttribute('data-schema', 'consultant');
      document.head.appendChild(schemaScript);
    }
    schemaScript.innerHTML = JSON.stringify(schemaData);

    checkAuth();

    // E16a-019: Check localStorage for upcoming event reminders within 48hrs
    try {
      const stored = localStorage.getItem('ns_event_reminders');
      if (stored) {
        const reminders = JSON.parse(stored);
        const now = new Date();
        const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        
        // Filter for reminders within 48hrs from now
        const upcoming = reminders.filter(reminder => {
          const eventDate = new Date(reminder.eventDate);
          return eventDate > now && eventDate <= fortyEightHoursFromNow;
        });

        // Auto-clean expired reminders (eventDate < now)
        const valid = reminders.filter(r => new Date(r.eventDate) >= now);
        if (valid.length !== reminders.length) {
          localStorage.setItem('ns_event_reminders', JSON.stringify(valid));
        }

        // Show toast for each upcoming reminder
        upcoming.forEach(reminder => {
          const eventDate = new Date(reminder.eventDate);
          const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          const timeText = daysUntil === 0 ? 'tomorrow' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
          toast.info(`Reminder: ${reminder.schoolName} — ${reminder.eventTitle} is ${timeText}!`);
        });
      }
    } catch (err) {
      console.error('[E16a-019] Failed to check reminders:', err);
    }

    // Track session start
    invokeFunction('trackSessionEvent', {
      eventType: 'session_start',
      sessionId
    }).catch(err => console.error('Failed to track session:', err));
  }, [sessionId]);

  // WC5: Session loading from URL param
  useEffect(() => {
    if (sessionIdParam && !sessionParamProcessedRef.current && isAuthenticated && user) {
      restoreSessionFromParam(sessionIdParam, null, isAuthenticated, user, setSelectedConsultant, setRestoredSessionData, setMessages, setFamilyProfile, setSchools, setCurrentView, setOnboardingPhase, setCurrentConversation, setSessionRestored, setRestoringSession, loadShortlist, isRestoringSessionRef, sessionParamProcessedRef, setDebugInfo, setDeepDiveAnalysis, setSelectedSchool, setVisitPrepKit, setActionPlan, skipViewOverrideRef, setSchoolAnalyses);
    }
  }, [sessionIdParam, isAuthenticated, user?.id]);

  // Auto-restore most recent conversation on F5 / new load without sessionIdParam
  const latestSessionRestoredRef = useRef(false);
  useEffect(() => {
    if (
      !sessionIdParam &&
      isAuthenticated &&
      user?.id &&
      !currentConversation?.id &&
      !latestSessionRestoredRef.current
    ) {
      latestSessionRestoredRef.current = true;
      restoreMostRecentConversation(
        null, user, setMessages, setSelectedConsultant, setCurrentConversation,
        setFamilyProfile, setSchools, setCurrentView, setOnboardingPhase,
        setDeepDiveAnalysis, setSelectedSchool, isRestoringSessionRef, skipViewOverrideRef,
        setSchoolAnalyses
      );
    }
  }, [sessionIdParam, isAuthenticated, user?.id, currentConversation?.id]);

  // Restore guest session when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && user && !sessionIdParam) {
      handleRestoreGuestSession();
    }
  }, [isAuthenticated, user?.id, sessionIdParam]);


  const handleRestoreGuestSession = () => {
    restoreGuestSession(isAuthenticated, user, currentConversation, setMessages, setSelectedConsultant, setCurrentConversation, null);
  };

  // Progress through loading stages
  useEffect(() => {
    if (isTyping) {
      setLoadingStage(0);
      const timer1 = setTimeout(() => setLoadingStage(1), 2000);
      const timer2 = setTimeout(() => setLoadingStage(2), 4000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isTyping]);

  // Auto-focus input after AI response
  useEffect(() => {
    if (!isTyping && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isTyping]);

  const getPlanLimits = (plan) => {
    if (plan === PLAN_NAMES.FREE) return { total: 100, dailyReplenishment: 3 };
    return { total: 1000, dailyReplenishment: 33 };
  };

  const getConversationLimits = (plan) => {
    if (plan === PLAN_NAMES.FREE) return 1;
    return 10;
  };

  const checkAuth = async () => {
    try {
      const authenticated = authIsAuthenticated;
      setIsAuthenticated(authenticated);

      if (authenticated) {
        const userData = authUser;
        setUser(userData);
        
        // Check daily token replenishment
        const plan = userData.subscription_plan || userData.tier || 'free';
        const limits = getPlanLimits(plan);
        if (plan !== PLAN_NAMES.FREE) {
          setTokenBalance(999999);
          setIsPremium(true);
        } else {
        const today = new Date().toISOString().split('T')[0];
        const renewalDate = userData.renewal_date ? userData.renewal_date.split('T')[0] : null;

        let newBalance = userData.token_balance !== undefined ? userData.token_balance : limits.total;
        let needsUpdate = false;
        
        // Replenish tokens if it's a new day
        if (!renewalDate || today > renewalDate) {
          newBalance = Math.min(newBalance + limits.dailyReplenishment, limits.total);
          needsUpdate = true;
          
          // Update user with new balance and renewal date
          await authUpdateMe({
            token_balance: newBalance,
            renewal_date: new Date().toISOString()
          });
        }
        
        setTokenBalance(newBalance);
        setIsPremium(false);
        }
        await loadConversations(userData.id);
        await loadShortlist();
      } else {
        // Unauthenticated users must not access the consultant — redirect to login
        // (Dev mode bypass: allow ?dev=true for local development)
        if (!isDevMode) {
          window.location.href = '/login?returnTo=/consultant';
          return;
        }
        // Dev mode: allow guest usage with localStorage balance
        const guestBalance = parseInt(localStorage.getItem('guestTokenBalance') || '100');
        setTokenBalance(guestBalance);
        const greeting = {
          role: 'assistant',
          content: DEFAULT_GREETING,
          timestamp: new Date().toISOString()
        };
        setMessages([greeting]);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Callbacks ──────────────────────────────────────────────────

  const createNewConversation = async () => {
    // If not authenticated, return to consultant selection
    if (!isAuthenticated) {
      setSelectedConsultant(null);
      return;
    }

    // Check conversation limit
    const activeCount = conversations.filter(c => c.is_active).length;
    const plan = user?.subscription_plan || 'free';
    const limit = getConversationLimits(plan);

    if (activeCount >= limit) {
      // Show archive confirmation instead of limit reached modal
      setPendingNewConversation(true);
      setArchiveConfirmOpen(true);
      return;
    }

    // Proceed with creating new conversation
    await proceedWithNewConversation();
  };

  const proceedWithNewConversation = async () => {
    try {
      const created = await createConversationRecord({ consultant: selectedConsultant });
      if (created) {
        await selectConversation(created);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleArchiveOldestConversation = async () => {
    try {
      // Find oldest active conversation
      const oldestConvo = conversations
        .filter(c => c.is_active)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

      if (oldestConvo) {
        await archiveConversation(oldestConvo);
      }

      // Now create the new conversation
      await proceedWithNewConversation();
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    } finally {
      setArchiveConfirmOpen(false);
      setPendingNewConversation(false);
    }
  };

  const resetChatState = () => {
    setMessages([]);
    setCurrentConversation({ conversation_context: {} });
    setBriefStatus(null);
    setOnboardingPhase(null);
    setActiveJourney(null);
    resetSchoolState();
    clearAllArtifacts();
    setFamilyProfile(null);
    setExtractedEntitiesData(null);
    setSchoolAnalyses({});
    setArtifactCache({});
    setShortlistData([]);
    setRemovedSchoolIds([]);
    setPendingDeepDiveSchoolIds(new Set());
    setVisitedSchoolIds([]);
    setResearchNotes('');
    setSchoolJourney(null);
    setContactLog([]);
    setShowLoadingOverlay(false);
    setCurrentView('chat');
  };

  const handleSelectConsultant = (consultantName) => {
    setSelectedConsultant(consultantName);
    // Track consultant selection
    invokeFunction('trackSessionEvent', {
      eventType: 'consultant_selected',
      consultantName: consultantName,
      sessionId
    }).catch(err => console.error('Failed to track:', err));

    // E40-S4: Complete state reset for fresh conversation
    resetChatState();

    // E47: Show guided intro sequence before chat
    setShowGuidedIntro(true);
  };

  // E47: Called when GuidedIntro completes — skip DISCOVERY+BRIEF, go straight to RESULTS
  const handleGuidedIntroComplete = (brief) => {
    // BUG-E46: Parse budget range string (e.g. "$15K–$25K") to numeric midpoint
    // so orchestrate.ts Number() call doesn't produce NaN
    if (brief.budget && typeof brief.budget === 'string') {
      const nums = brief.budget.match(/\d+/g);
      if (nums && nums.length >= 2) {
        brief.budget = ((Number(nums[0]) + Number(nums[1])) / 2) * 1000;
      } else if (nums && nums.length === 1) {
        brief.budget = Number(nums[0]) * 1000;
      }
      // "Not sure yet" or other non-numeric strings → leave as falsy
      if (isNaN(brief.budget)) brief.budget = '';
    }

    // E48-FIX: Write to ref synchronously so the handleSendMessage closure
    // (which may fire before React re-renders) reads the correct value.
    familyBriefRef.current = brief;
    setFamilyBrief(brief);
    setShowGuidedIntro(false);

    // E47: Send synthetic message to trigger orchestrator → RESULTS immediately
    // The orchestrator handles the warm greeting + school matching in one shot.
    setTimeout(() => {
      handleSendMessage('__GUIDED_INTRO_COMPLETE__', null, null);
    }, 50);
  };

  const selectConversation = async (convo) => {
    // Delegate conversation state management to hook
    // (reads conversation_state table with JSONB fallback — Phase 3b)
    await switchConversation(convo);

    // Reset non-conversation state
    setShortlistData([]);
    setRemovedSchoolIds([]);

    // Set messages from this conversation
    const msgs = convo.messages || [];
    if (msgs.length === 0) {
      const greeting = {
        role: 'assistant',
        content: DEFAULT_GREETING,
        timestamp: new Date().toISOString()
      };
      setMessages([greeting]);
      // Clear conversation context for new conversations to prevent memory leaks
      setCurrentConversation({ ...convo, conversation_context: {} });
    } else {
      setMessages(msgs);
    }

    setSchools(convo.conversation_context?.schools || []);
    // BUG-DD-001 FIX: Only clear selectedSchool if NOT in DEEP_DIVE state
    if (convo.conversation_context?.state !== STATES.DEEP_DIVE) {
      setSelectedSchool(null);
    }
  };

  const handleBackToResults = async () => {
    setSelectedSchool(null);
    setCurrentView('schools');
    if (currentConversation) {
      const updatedContext = {
        ...currentConversation.conversation_context,
        state: STATES.RESULTS,
        selectedSchoolId: null,
      };
      setCurrentConversation(prevConvo => ({
        ...prevConvo,
        conversation_context: updatedContext,
      }));
      if (currentConversation.id) {
        await updateConversation(currentConversation.id, {
          conversation_context: updatedContext,
        });
      }
    }
  };

  const handleComparisonBack = () => {
    if (previousSearchResults.length > 0) {
      setSchools(previousSearchResults);
    }
    setComparisonData(null);
    if (!selectedSchool) {
      setCurrentView('schools');
    }
  };

  // E31-003: Load More Schools — wrapper passes cross-hook deps to useSchoolResults
  const conversationContext = currentConversation?.conversation_context;
  const loadMoreSchools = useCallback(
    () => _loadMoreSchools({ conversationContext, familyProfile, userLocation, shortlistData, user }),
    [_loadMoreSchools, conversationContext, familyProfile, userLocation, shortlistData, user],
  );

  const { handleSendMessage } = useMessageHandler({
    messages,
    setMessages,
    selectedConsultant,
    sessionId,
    isAuthenticated,
    setShowLoginGate,
    currentConversation,
    familyProfile,
    briefStatus,
    setBriefStatus,
    extractedEntitiesData,
    setExtractedEntitiesData,
    isPremium,
    tokenBalance,
    setTokenBalance,
    user,
    setUser,
    shortlistData,
    schools,
    setSchools,
    selectedSchool,
    setSelectedSchool,
    setCurrentView,
    onboardingPhase,
    restoredSessionData,
    setCurrentConversation,
    setIsTyping,
    setLastTypingTime,
    setFamilyProfile,
    setSchoolsAnimKey,
    setDeepDiveAnalysis,
    setVisitPrepKit,
    setActionPlan,
    setFitReEvaluation,
    artifactCache,
    resetSort,
    loadShortlist,
    loadConversations,
    userLocation,
    setFeedbackPromptShown,
    feedbackPromptShown,
    isDevMode,
    setShowUpgradeModal,
    trackEvent,
    mapStateToView,
    hasAutoPopulatedShortlist,
    activeJourney,
    setActiveJourney,
    // E41: Action dispatch deps for S6/S7/S10 inline dispatch in useMessageHandler
    setFilterOverrides,
    resetFilterOverrides,
    loadMoreSchools,
    setActivePanel,
    applyDistances,
    // E47: Pass familyBrief so it can be sent as pre-extracted entities
    familyBrief,
    // E48-FIX: Ref for stale-closure safety in guided intro flow
    familyBriefRef,
  });

  // WC-1b: Inject pendingMessage from ?q= param after consultant greeting
  useEffect(() => {
    if (pendingMessage && !showGuidedIntro && selectedConsultant && messages.length === 1 && messages[0].role === 'assistant') {
      handleSendMessage(pendingMessage);
      setPendingMessage(null);
      router.replace('/consultant');
    }
  }, [pendingMessage, showGuidedIntro, selectedConsultant, messages]);

  const handleViewSchoolDetail = async (schoolId, skipConfirmation = false) => {
    let school = schools.find(s => s.id === schoolId) || shortlistData.find(s => s.id === schoolId) || extraSchools.find(s => s.id === schoolId);
    if (school && !school.description && !school.website) {
      try {
        const fullRecords = await School.filter({ id: schoolId });
        if (fullRecords[0]) school = fullRecords[0];
      } catch (e) {
        console.error('[SCHOOL DETAIL] Failed to fetch full record:', e.message);
      }
    }
    if (school) {
      trackEvent('school_clicked', { metadata: { schoolName: school.name } });
      setSelectedSchool(school);
      setCurrentView('detail');
      if (!skipConfirmation) {
        setConfirmingSchool(school);
        // Auto-scroll chat to bottom so user sees the deep-dive prompt
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  };

  const handleConfirmDeepDive = async (school) => {
    setConfirmingSchool(null);
    setSelectedSchool(school);
    setDeepDiveAnalysis(null);
    setVisitPrepKit(null);
    setActionPlan(null);
    await handleSendMessage(`Tell me about ${school.name}`, school.id);
  };

  const handleCancelDeepDive = () => {
    setConfirmingSchool(null);
    handleBackToResults();
  };

  // Open full-screen comparison view and update conversationContext with compared school names
  const handleOpenComparison = async (comparedSchools) => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }
    setComparisonData(comparedSchools);
    // E41-S8: Use leftPanelMode instead of currentView='comparison' so chat stays visible
    setLeftPanelMode('comparison');

    // E11b: Fetch family-personalized comparisonMatrix from backend (non-blocking)
    try {
      const schoolIds = comparedSchools.map(s => s.id).filter(Boolean);
      const result = await invokeFunction('generateComparison', {
        schoolIds,
        familyProfileId: familyProfile?.id || null,
        userId: user?.id || null
      });
      // S87-WC2: Path A runs for logging/artifact only — Path B (handleNarrateComparison) is sole matrix writer
    } catch (e) {
      console.warn('[E11b] generateComparison failed (non-blocking):', e.message);
    }
    // Update conversation_context so chat AI knows which schools are being compared
    const updatedContext = {
      ...(currentConversation?.conversation_context || {}),
      comparingSchools: comparedSchools.map(s => s.name),
    };
    setCurrentConversation(prev => prev ? { ...prev, conversation_context: updatedContext } : prev);
    if (currentConversation?.id) {
      await updateConversation(currentConversation.id, {
        conversation_context: updatedContext,
      });
    }
    // Trigger narration
    handleNarrateComparison(comparedSchools);
  };

  // T-SL-005 + E11b: AI-narrated comparison synthesis with structured matrix
  const handleNarrateComparison = async (comparedSchools) => {
    await narrateComparison({
      comparedSchools,
      familyProfile,
      visitedSchoolIds,
      selectedConsultant,
      setMessages,
      setComparisonMatrix,
    });
  };

  const deleteConversation = async () => {
    if (!conversationToDelete) return;

    const success = await archiveConversation(conversationToDelete);

    if (success) {
      // Clear current conversation if it was the one deleted
      if (currentConversation?.id === conversationToDelete.id) {
        const firstActive = conversations.find(c => c.id !== conversationToDelete.id && c.is_active);
        if (firstActive) {
          await selectConversation(firstActive);
        } else {
          setCurrentConversation(null);
          setMessages([]);
          if (!selectedSchool) {
            setCurrentView('welcome');
          }
        }
      }
    }

    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const toggleStarConversation = async (convo, e) => {
    e.stopPropagation();
    try {
      await updateConversation(convo.id, {
        starred: !convo.starred
      });
      await loadConversations(user.id);
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  // Shared ChatPanel props for intake + results phases
  const chatPanelProps = {
    ref: inputRef,
    messages,
    schools,
    selectedConsultant,
    currentState,
    briefStatus,
    isTyping,
    tokenBalance,
    isPremium,
    loadingStage,
    loadingStages,
    feedbackPromptShown,
    familyProfile,
    onSendMessage: handleSendMessage,
    onTogglePanel: setActivePanel,
    onSetExpandedSchool: setAutoExpandSchoolId,
    onViewSchoolDetail: (school) => {
      setSelectedSchool(school);
      setCurrentView('detail');
    },
    onConfirmDeepDive: handleConfirmDeepDive,
    onCancelDeepDive: handleCancelDeepDive,
    deepDiveSchoolName: (pendingDeepDiveSchoolIds.size > 0 || (currentView === 'detail' && !confirmingSchool)) && selectedSchool ? selectedSchool.name : null,
  };


  // Detect if user is scrolled up, show new message indicator on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
      
      if (!isAtBottom) {
        setIsScrolledUp(true);
        setShowNewMessageIndicator(true);
      } else {
        setIsScrolledUp(false);
        setShowNewMessageIndicator(false);
      }
    }
  }, [messages]);

  // Auto-scroll to bottom on new messages (works in both views)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // E30-012 + E30-013: Auto-add to shortlist + auto-open panel after deep dive
  // Intentionally outside useMessageHandler to avoid F15 stale closure surface
  useEffect(() => {
    if (isTyping) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg?.deepDiveAnalysis || lastMsg.role !== 'assistant') return;
    const schoolId = lastMsg.deepDiveAnalysis.schoolId;
    if (!schoolId || deepDiveAutoAddedRef.current.has(schoolId)) return;
    deepDiveAutoAddedRef.current.add(schoolId);
    setPendingDeepDiveSchoolIds(prev => {
      const next = new Set(prev);
      next.delete(schoolId);
      return next;
    });
    const DOSSIER_AUTO_OPEN_DELAY_MS = 800;
    const alreadyShortlisted = shortlistData.some(s => s.id === schoolId);
    const wasRemoved = (removedSchoolIds || []).includes(schoolId);
    if (!alreadyShortlisted && !wasRemoved) {
      handleToggleShortlist(schoolId, { silent: true });
      const schoolName = lastMsg.deepDiveAnalysis.schoolName || schoolAnalyses?.[schoolId]?.schoolName || 'School';
      toast(`${schoolName} added to your shortlist`, { duration: 3000 });
    }
    setTimeout(async () => {
      // E39-S10: Navigate to school profile — fetch full record to avoid placeholder data
      const schoolName = lastMsg.deepDiveAnalysis.schoolName || schoolAnalyses?.[schoolId]?.schoolName || 'School';
      let fullSchool = schools.find(s => s.id === schoolId)
        || shortlistData.find(s => s.id === schoolId)
        || extraSchools.find(s => s.id === schoolId);
      if (!fullSchool || (!fullSchool.description && !fullSchool.website)) {
        try {
          const fullRecords = await School.filter({ id: schoolId });
          if (fullRecords[0]) fullSchool = fullRecords[0];
        } catch (e) {
          console.warn('[DEEPDIVE] Failed to fetch full school record:', e.message);
        }
      }
      setSelectedSchool(fullSchool || { id: schoolId, name: schoolName });
      setCurrentView('detail');
      setActivePanel(null);
    }, DOSSIER_AUTO_OPEN_DELAY_MS);
  }, [messages, isTyping]);

  // E32-003: Action processor - executes UI actions from backend
  useEffect(() => {
    if (isTyping) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg?.actions?.length || lastMsg.role !== 'assistant') return;

    const timeouts = [];

    for (const action of lastMsg.actions) {
      const actionKey = `${action.type}_${JSON.stringify(action.payload)}`;
      if (processedActionsRef.current.has(actionKey)) continue;
      processedActionsRef.current.add(actionKey);

      console.debug('[E32-003] Dispatching action:', action.type, action.payload);

      const executeAction = () => {
        switch (action.type) {
          case 'ADD_TO_SHORTLIST': {
            const alreadyShortlisted = shortlistData.some(s => s.id === action.payload.schoolId);
            const wasRemoved = (removedSchoolIds || []).includes(action.payload.schoolId);
            const alreadyHandledByDeepDive = lastMsg.deepDiveAnalysis?.schoolId === action.payload.schoolId;
            if (!alreadyShortlisted && !wasRemoved && !alreadyHandledByDeepDive) {
              handleToggleShortlist(action.payload.schoolId, { silent: true });
              const schoolName = [...(schools || []), ...(shortlistData || [])].find(s => s.id === action.payload.schoolId)?.name || 'School';
              toast.success(`${schoolName} added to your shortlist`, { style: { borderLeft: '4px solid #14b8a6' } });
            }
            break;
          }
          case 'OPEN_PANEL':
            setActivePanel(action.payload.panel);
            break;
          case 'EXPAND_SCHOOL':
            // E41-S5: Only this action triggers DEEPDIVE transition.
            // ask-about-school-info returns no action, so it stays in RESULTS.
            setAutoExpandSchoolId(action.payload.schoolId);
            setActivePanel('shortlist');
            break;
          case 'INITIATE_TOUR': {
            const school = [...(schools || []), ...(shortlistData || [])].find(s => s.id === action.payload.schoolId);
            if (school) {
              setTourRequestSchool(school);
            }
            break;
          }
          // E41-S10: Sort schools by distance (needs applyDistances, kept here)
          case 'SORT_SCHOOLS': {
            const sortBy = action.payload?.sortBy || 'distance';
            if (sortBy === 'distance' && userLocation) {
              applyDistances(userLocation, schools);
            }
            break;
          }
          // E41-S6: EDIT_CRITERIA / S7: FILTER_SCHOOLS / S10: LOAD_MORE
          // dispatched inline in useMessageHandler (synchronous, no 800ms delay)
          default:
            break;
        }
      };

      if (action.timing === 'after_message') {
        timeouts.push(setTimeout(executeAction, 800));
      } else {
        executeAction();
      }
    }

    return () => timeouts.forEach(t => clearTimeout(t));
  }, [messages, isTyping]);

  const handleScrollDownClick = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMessageIndicator(false);
  };

  // ─── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Show LoadingOverlay while restoring session from URL param
  if (sessionIdParam && !sessionRestored && restoringSession) {
    return (
      <div className="h-screen relative bg-slate-50">
        <LoadingOverlay
          isVisible={true}
          onTransitionComplete={() => {}}
        />
      </div>
    );
  }

  // Show consultant selection if not yet selected (but skip if restoring a session from URL)
  if (!selectedConsultant && !sessionIdParam) {
    return (
      <LayoutGroup>
        <div className="h-screen flex flex-col bg-slate-900">
          <a
            href="#consultant-selection"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg"
          >
            Skip to consultant selection
          </a>
          <div id="consultant-selection" className="flex-1 overflow-auto">
            <ConsultantSelection onSelectConsultant={handleSelectConsultant} />
          </div>
        </div>
      </LayoutGroup>
    );
  }

  // E47: Show guided intro sequence after consultant selection, before chat
  if (selectedConsultant && showGuidedIntro) {
    return (
      <div className="h-screen flex flex-col relative">
        <GuidedIntro
          consultantName={selectedConsultant}
          onComplete={handleGuidedIntroComplete}
        />
      </div>
    );
  }

  // If sessionId is in URL but consultant not yet selected, show loading spinner while restoration completes
  if (!selectedConsultant && sessionIdParam) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">

      {/* TASK E: Skip navigation */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>
      
      {/* TASK D: Progress bar */}
      <ProgressBar isLoading={isTyping} />
      
      {/* Header */}
      <Navbar variant="minimal" />

      {/* E47: Consultant avatar badge — only during guided intro (early return above), hidden in RESULTS/DEEPDIVE */}

      {/* E37: Loading overlay on brief confirmation with 5-second minimum */}
      <LoadingOverlay
        isVisible={showLoadingOverlay}
        familyBrief={familyBrief}
        onTransitionComplete={() => {
          setShowLoadingOverlay(false);
          setIsTransitioning(true);
        }}
      />

      {(isIntakePhase && !showSchoolGrid) ? (
         /* INTAKE PHASE - Centered Layout */
         <div id="main-content" className="flex-1 flex bg-[#1E1E2E] overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
            <div className="w-full max-w-2xl h-full max-h-[95vh] sm:max-h-[90vh] bg-[#2A2A3D] rounded-xl sm:rounded-2xl shadow-2xl flex flex-col transition-all duration-400">
              <ChatPanel
                {...chatPanelProps}
                variant="intake"
                isPremium={isPremium}
                onUpgrade={() => setShowUpgradeModal(true)}
                heroContent={null}
              />
            </div>
          </div>

          {/* T046: Right rail + sliding panel — intake phase */}
           {activePanel === 'brief' && (
             <FamilyBrief
               familyProfile={familyProfile}
               consultantName={selectedConsultant}
               onClose={() => setActivePanel(null)}
               extractedEntities={extractedEntitiesData}
             />
           )}
           {activePanel === 'addSchool' && (
             <AddSchoolPanel
               onClose={() => setActivePanel(null)}
               onToggleShortlist={handleToggleShortlist}
               shortlistedIds={shortlistData.map(s => s.id)}
             />
           )}
           <IconRail
             currentState={currentState}
             activePanel={activePanel}
             onTogglePanel={(panel) => setActivePanel(p => p === panel ? null : panel)}
             shortlistCount={shortlistData.length}
           />
        </div>
      ) : (
        /* RESULTS PHASE - Split Layout */
        <div className="flex-1 flex flex-row overflow-hidden relative transition-all duration-400 pb-0">
        {/* Mobile tab toggle */}
        <div className="lg:hidden flex border-b bg-white" style={{ display: 'none' }}>
          {/* hidden — mobile uses mobileView state below */}
          <button
            onClick={() => setMobileView('chat')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mobileView === 'chat' 
                ? 'text-teal-600 border-b-2 border-teal-600' 
                : 'text-slate-600'
            }`}
            aria-label="View chat"
          >
            Chat
          </button>
          <button
            onClick={() => setMobileView('schools')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mobileView === 'schools' 
                ? 'text-teal-600 border-b-2 border-teal-600' 
                : 'text-slate-600'
            }`}
            aria-label="View schools"
          >
            Schools ({schools.length})
          </button>
        </div>

        {/* CENTER CONTENT AREA */}
        <main
          className="overflow-y-auto bg-white transition-all duration-200 ease-out"
          style={{
            flex: 1,
            minWidth: 0,
            animation: isTransitioning ? 'slideInFromLeft 420ms cubic-bezier(0.22,1,0.36,1) both' : undefined,
          }}
        >


          {/* E41-S8: Comparison renders inline (leftPanelMode='comparison') — chat stays live on right */}
          {leftPanelMode === 'comparison' && comparisonData ? (
            <ComparisonView
              schools={comparisonData}
              familyProfile={familyProfile}
              comparisonMatrix={comparisonMatrix}
              isPremium={isPremium}
              onUpgrade={() => setShowUpgradeModal(true)}
              onBack={() => {
                setLeftPanelMode('grid');
                setComparisonData(null);
                // Clear comparingSchools from context
                const updatedContext = { ...(currentConversation?.conversation_context || {}) };
                delete updatedContext.comparingSchools;
                setCurrentConversation(prev => prev ? { ...prev, conversation_context: updatedContext } : prev);
              }}
            />
          ) : currentView === 'detail' && selectedSchool ? (
            <div style={{display:'contents'}}>
            {selectedSchool && deepDiveAnalysis && (() => {
              const keyDates = actionPlan ? [
                ...(actionPlan.visitTimeline?.events || []).map(e => ({
                  type: 'event',
                  label: e.title || e.type || 'Event',
                  date: e.date,
                  isEstimated: false,
                })),
                ...(actionPlan.applicationDeadlines?.deadline ? [{
                  type: 'deadline',
                  label: 'Application Deadline',
                  date: actionPlan.applicationDeadlines.deadline,
                  isEstimated: actionPlan.applicationDeadlines.isEstimated || false,
                }] : []),
                ...(actionPlan.applicationDeadlines?.financialAidDeadline ? [{
                  type: 'deadline',
                  label: 'Financial Aid Deadline',
                  date: actionPlan.applicationDeadlines.financialAidDeadline,
                  isEstimated: actionPlan.applicationDeadlines.isEstimated || false,
                }] : []),
              ] : null;
              return (
                <ResearchNotepad
                  schoolData={{
                    name: selectedSchool.name || selectedSchool.school_name || 'Unknown School',
                    location: `${selectedSchool.city || ''}, ${selectedSchool.province_state || selectedSchool.province || ''}`.trim().replace(/^,\s*/, ''),
                    grades: selectedSchool.grades_served || `${selectedSchool.lowest_grade || 'K'}-${selectedSchool.highest_grade || '12'}`,
                    type: selectedSchool.gender_policy || selectedSchool.school_type_label || '',
                    students: selectedSchool.enrollment || 0,
                    teacherRatio: selectedSchool.student_teacher_ratio || '',
                    tuition: selectedSchool.tuition_domestic_day ? `$${Number(selectedSchool.tuition_domestic_day).toLocaleString()}` : 'Contact school',
                  }}
                  fitScore={deepDiveAnalysis.fit_score}
                  fitLabel={deepDiveAnalysis.fit_label}
                  tradeOffs={deepDiveAnalysis.trade_offs}
                  aiInsight={deepDiveAnalysis.ai_insight}
                  priorityMatches={deepDiveAnalysis.priority_matches || []}
                  journeySteps={journeySteps}
                  keyDates={keyDates}
                  visitPrepKit={visitPrepKit}
                  actionPlan={actionPlan}
                  communityPulse={deepDiveAnalysis.community_pulse || null}
                  contactLog={contactLog}
                  researchNotes={researchNotes}
                  onNotesChange={setResearchNotes}
                  onSaveNotes={handleSaveNotes}
                  lastDeepDiveAt={(() => {
                    for (let i = messages.length - 1; i >= 0; i--) {
                      if (messages[i]?.deepDiveAnalysis?.schoolId === deepDiveAnalysis?.schoolId) {
                        return messages[i]?.createdAt || messages[i]?.timestamp || new Date().toISOString();
                      }
                    }
                    return null;
                  })()}
                  onRefreshDeepDive={() => {
                    if (deepDiveAnalysis?.schoolId) {
                      const schoolName = deepDiveAnalysis?.schoolName || selectedSchool?.name || 'this school';
                      handleSendMessage(`Tell me about ${schoolName}`, deepDiveAnalysis.schoolId);
                    }
                  }}
                />
              );
            })()}
            <SchoolDetailPanel
              school={selectedSchool}
              familyProfile={familyProfile}
              onBack={() => {
                setSelectedSchool(null);
                setCurrentView('schools');
              }}
              onToggleShortlist={handleToggleShortlist}
              isShortlisted={shortlistData.some(s => s.id === selectedSchool?.id)}
              onCompare={(school) => handleOpenComparison([school])}
              actionPlan={actionPlan}
              visitPrepKit={visitPrepKit}
              isPremium={isPremium}
              onUpgrade={() => setShowUpgradeModal(true)}
            />
            </div>
          ) : (currentState === STATES.RESULTS || currentView === 'schools') && schools.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <div className="max-w-md">
                <div className="text-6xl mb-4">🔍</div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">No schools matched your criteria</h2>
                <p className="text-slate-600 mb-6">Try broadening your search with one of these suggestions:</p>
                <div className="space-y-2 text-left">
                  <button 
                    onClick={() => handleSendMessage("Can you show me schools with a higher budget?")}
                    className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-medium transition-colors text-left"
                  >
                    • Increase your budget range
                  </button>
                  <button 
                    onClick={() => handleSendMessage("What schools are available in nearby areas?")}
                    className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-medium transition-colors text-left"
                  >
                    • Search in nearby cities
                  </button>
                  <button 
                    onClick={() => handleSendMessage("Show me schools without my priority filters")}
                    className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-medium transition-colors text-left"
                  >
                    • Relax your priority filters
                  </button>
                  <button 
                    onClick={() => handleSendMessage("What grade levels are available?")}
                    className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-medium transition-colors text-left"
                  >
                    • Adjust grade level
                  </button>
                </div>
              </div>
              </div>
              ) : (currentState === STATES.RESULTS || showSchoolGrid) && schools.length > 0 ? (
            <div className="h-full flex flex-col animate-fadeIn">
              <div className="p-3 sm:p-4 border-b flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                    Results ({filteredSchools.length})
                  </h2>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3 sm:p-4">
                <SchoolGrid
                key={`${schoolsAnimKey}-${JSON.stringify(priorityOverrides)}`}
                schools={filteredSchools}
                tieredSchools={buildTiers(filteredSchools, familyProfile, priorityOverrides)}
                onViewDetails={handleViewSchoolDetail}
                onToggleShortlist={handleToggleShortlist}
                shortlistedIds={shortlistData.map(s => s.id)}
                shortlistedSchools={shortlistData}
                showDistances={showDistances}
                isLoading={isTyping && schools.length === 0}
                accentColor={selectedConsultant === 'Jackie' ? '#C27B8A' : '#6B9DAD'}
                familyProfile={familyProfile}
                priorityOverrides={priorityOverrides}
                onPriorityToggle={handlePriorityToggle}
                onNarrateComparison={handleNarrateComparison}
                onOpenComparison={handleOpenComparison}
                visitedSchoolIds={visitedSchoolIds}
                extraSchools={extraSchools}
                onLoadMore={loadMoreSchools}
                extraSchoolsLoading={extraSchoolsLoading}
                extraSchoolsHasMore={extraSchoolsHasMore}
                extraSchoolsError={extraSchoolsError}
                userLocationAvailable={!!(conversationContext?.resolvedLat || userLocation?.lat)}
                />
              </div>
            </div>
          ) : null}

          

        </main>

        {/* T046: Sliding Brief/Shortlist panel */}
        {activePanel === 'brief' && (
          <div
            className="flex-shrink-0 h-full overflow-hidden"
            style={{
              width: 320,
              animation: 'slideInFromRight 200ms ease-out',
            }}
          >
            <FamilyBrief
              familyProfile={familyProfile}
              consultantName={selectedConsultant}
              onClose={() => setActivePanel(null)}
              extractedEntities={extractedEntitiesData}
            />
          </div>
        )}
        {activePanel === 'addSchool' && (
          <div
            className="flex-shrink-0 h-full overflow-hidden"
            style={{ width: 320, animation: 'slideInFromRight 200ms ease-out', background: '#1A1A2A', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
          >
            <AddSchoolPanel
              onClose={() => setActivePanel(null)}
              onToggleShortlist={handleToggleShortlist}
              shortlistedIds={shortlistData.map(s => s.id)}

            />
          </div>
        )}
        {activePanel === 'shortlist' && (
          <div
            className="flex-shrink-0 h-full overflow-hidden"
            style={{
              width: 320,
              animation: 'slideInFromRight 200ms ease-out',
              background: '#1A1A2A',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <ShortlistPanel
              shortlist={shortlistData}
              onClose={() => setActivePanel(null)}
              onRemove={handleToggleShortlist}
              familyProfile={familyProfile}
              schoolAnalyses={schoolAnalyses}
              artifactCache={artifactCache}
              consultantName={selectedConsultant}
              onSendMessage={handleSendMessage}
              isPremiumUser={isPremium}
              onDossierExpandChange={handleDossierExpandChange}
              onConfirmDeepDive={handleDeepDiveFromDossier}
              pendingDeepDiveSchoolIds={pendingDeepDiveSchoolIds}
              onViewSchool={(id) => {
                handleViewSchoolDetail(id);
                setActivePanel(null);
              }}
              autoExpandSchoolId={autoExpandSchoolId}
              onClearAutoExpand={() => setAutoExpandSchoolId(null)}
              schoolsWithDeepDive={schoolsWithDeepDive}
            />
          </div>
        )}
        {activePanel === 'timeline' && (
          <div
            className="flex-shrink-0 h-full overflow-hidden"
            style={{ width: 320, animation: 'slideInFromRight 200ms ease-out', background: '#1A1A2A', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
          >
            <TimelinePanel
              shortlist={shortlistData}
              onClose={() => setActivePanel(null)}
            />
          </div>
        )}

        {/* T046: Right-side Icon Rail */}
        <IconRail
          currentState={currentState}
          activePanel={activePanel}
          onTogglePanel={(panel) => setActivePanel(p => p === panel ? null : panel)}
          shortlistCount={shortlistData.length}
        />

        {/* RIGHT CHAT PANEL */}
        <aside
          className="bg-[#2A2A3D] border-l border-white/10 flex flex-col relative flex-shrink-0"
          style={{
            width: 450,
            transition: 'width 420ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <ChatPanel
            {...chatPanelProps}
            variant="sidebar"
            isPremium={isPremium}
            onUpgrade={() => setShowUpgradeModal(true)}
            confirmingSchool={confirmingSchool}
            showNewMessageIndicator={showNewMessageIndicator}
            onScrollDownClick={handleScrollDownClick}
          />
        </aside>
        </div>
      )}

      <ConsultantDialogs
        deleteDialogOpen={deleteDialogOpen}
        setDeleteDialogOpen={setDeleteDialogOpen}
        conversationToDelete={conversationToDelete}
        deleteConversation={deleteConversation}
        archiveConfirmOpen={archiveConfirmOpen}
        setArchiveConfirmOpen={setArchiveConfirmOpen}
        conversations={conversations}
        user={user}
        handleArchiveOldestConversation={handleArchiveOldestConversation}
        setPendingNewConversation={setPendingNewConversation}
        limitReachedOpen={limitReachedOpen}
        setLimitReachedOpen={setLimitReachedOpen}
        isAuthenticated={isAuthenticated}
        getConversationLimits={getConversationLimits}
        showUpgradeModal={showUpgradeModal}
        setShowUpgradeModal={setShowUpgradeModal}
        tokenBalance={tokenBalance}
        getPlanLimits={getPlanLimits}
        showLoginGate={showLoginGate}
        setShowLoginGate={setShowLoginGate}
        onLoginGateClose={() => {
          setShowLoginGate(false);
          // FIX-RESULTS-VIEW: The API call now proceeds behind the login gate modal.
          // When the API returns, it sets schools + view + clears briefStatus automatically.
          // Only clear briefStatus if the API already failed or somehow didn't clear it
          // AND we're not currently loading (isTyping would indicate API in progress).
          if (briefStatus === 'confirmed' && !isTyping) {
            setBriefStatus(null);
            setShowLoadingOverlay(false);
          }
        }}
        selectedConsultant={selectedConsultant}
        familyProfile={familyProfile}
        isDebugMode={isDebugMode}
        extractedEntitiesData={extractedEntitiesData}
        currentConversation={currentConversation}
        deepDiveAnalysis={deepDiveAnalysis}
        actionPlan={actionPlan}
        visitPrepKit={visitPrepKit}
        fitReEvaluation={fitReEvaluation}
        journeySteps={journeySteps}
        selectedSchool={selectedSchool}
        schoolsWithDeepDive={schoolsWithDeepDive}
        hydrationSource={hydrationSource}
      />

      {/* Shortlist Panel */}
      {showShortlistPanel && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowShortlistPanel(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-[320px] max-w-[85vw] overflow-hidden">
            <ShortlistPanel
              shortlist={shortlistData}
              onClose={() => setShowShortlistPanel(false)}
              onRemove={handleToggleShortlist}
              familyProfile={familyProfile}
              schoolAnalyses={schoolAnalyses}
              artifactCache={artifactCache}
              consultantName={selectedConsultant}
              onSendMessage={handleSendMessage}
              isPremiumUser={isPremium}
              onDossierExpandChange={handleDossierExpandChange}
              onConfirmDeepDive={handleDeepDiveFromDossier}
              pendingDeepDiveSchoolIds={pendingDeepDiveSchoolIds}
              onViewSchool={(id) => {
                handleViewSchoolDetail(id);
                setShowShortlistPanel(false);
              }}
              schoolsWithDeepDive={schoolsWithDeepDive}
            />
          </div>
        </>
      )}

      {/* Notes Panel */}
      {showNotesPanel && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowNotesPanel(false)}
          />
          <NotesPanel
            userId={user?.id}
            onClose={() => setShowNotesPanel(false)}
          />
        </>
      )}

      {/* Tour Request Modal */}
      {tourRequestSchool && (
        <TourRequestModal
          school={tourRequestSchool}
          onClose={() => setTourRequestSchool(null)}
          upcomingEvents={[]}
        />
      )}

      {/* T046: Panel rendered inline in layout, no overlay needed */}
    </div>
  );
}