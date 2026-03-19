import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useAuth } from '@/lib/AuthContext';
import { School, SchoolJourney, ChatHistory, FamilyJourney, ResearchNote, SchoolInquiry } from '@/lib/entities';
import { invokeFunction } from '@/lib/functions';
import { STATES, BRIEF_STATUS } from '@/lib/stateMachineConfig';
import { restoreGuestSession } from '@/components/chat/SessionRestorer';
import { handleNarrateComparison as narrateComparison } from '@/components/chat/handleNarrateComparison';

// Import searchSchools function
const searchSchools = (params) => invokeFunction('searchSchools', params);
import { Button } from "@/components/ui/button";
import { Plus, Heart, FileText, Trash2, Star, ClipboardList } from "lucide-react";
import { toast } from "sonner"; // E16a-019
import IconRail from '@/components/navigation/IconRail';
import FamilyBrief from '@/components/chat/FamilyBrief';
import WelcomeState from '@/components/schools/WelcomeState';
import ConsultantSelection from '@/components/chat/ConsultantSelection';
import GuidedIntro from '@/components/chat/GuidedIntro';
import SchoolGrid from '@/components/schools/SchoolGrid';
import SchoolDetailPanel from '@/components/schools/SchoolDetailPanel';
import ShortlistPanel from '@/components/chat/ShortlistPanel';
import AddSchoolPanel from '@/components/chat/AddSchoolPanel';
import TimelinePanel from '@/components/chat/TimelinePanel';
import NotesPanel from '@/components/chat/NotesPanel';
import ComparisonView from '@/components/schools/ComparisonView';
import { getTuitionBand, buildPriorityChecks } from '@/components/schools/SchoolCard';
import { validateBriefContent, generateProgrammaticBrief } from '../components/utils/briefUtils';
import { buildTiers } from '../components/utils/tierEngine';
import { useUserLocation } from '../components/hooks/useUserLocation';
import { useShortlist } from '../components/hooks/useShortlist';
import { useDataLoader } from '../components/hooks/useDataLoader';
import { extractAndSaveMemories } from '../components/utils/memoryManager';
import { restoreSessionFromParam, restoreMostRecentConversation } from '@/components/chat/SessionRestorer';
import ConsultantDialogs from '@/components/chat/ConsultantDialogs';
import ChatPanel from '@/components/chat/ChatPanel';
import ProgressBar from '@/components/ui/progress-bar';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/navigation/Navbar';
import TourRequestModal from '../components/schools/TourRequestModal';
import { useSchoolFiltering } from '@/components/hooks/useSchoolFiltering';
import { useMessageHandler } from '@/components/hooks/useMessageHandler';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import ResearchNotepad from '@/components/ui/ResearchNotepad';
import { getSchoolsWithDeepDive } from '../components/utils/deepDiveUtils';

const PLAN_NAMES = { FREE: 'free', BASIC: 'basic', PREMIUM: 'premium', PRO: 'pro', ENTERPRISE: 'enterprise' };

const DEFAULT_GREETING = "Hi! I'm your NextSchool education consultant. I help families across Canada, the US, and Europe find the perfect private school. Tell me about your child — what grade are they in, and what matters most to you in a school?";

const mapStateToView = (state) => {
  if ([STATES.WELCOME, STATES.DISCOVERY, STATES.BRIEF].includes(state)) return 'chat';
  if (state === STATES.RESULTS) return 'schools';
  if (state === STATES.DEEP_DIVE) return 'detail';
  return 'chat';
};

export default function Consultant() {
   // Safe trackEvent definition - defaults to no-op if not defined globally
   const trackEvent = (typeof window !== 'undefined' && window.trackEvent) ? window.trackEvent : (name, data) => {};
   const { user: authUser, isAuthenticated: authIsAuthenticated, updateMe: authUpdateMe } = useAuth();

   const searchParams = useSearchParams();
   const router = useRouter();
   const sessionIdParam = searchParams.get('sessionId');
   const [pendingMessage, setPendingMessage] = useState(() => searchParams.get('q') || null);
   const sessionParamProcessedRef = useRef(false);
  
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [restoringSession, setRestoringSession] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const isRestoringSessionRef = useRef(false);
  const skipViewOverrideRef = useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [selectedConsultant, setSelectedConsultant] = useState(null);
  const [showGuidedIntro, setShowGuidedIntro] = useState(false);
  const [familyBrief, setFamilyBrief] = useState(null);
  const [showResponseChips, setShowResponseChips] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [feedbackPromptShown, setFeedbackPromptShown] = useState(false);
  
  // View states
  const [currentView, setCurrentView] = useState('welcome');
  const [schools, setSchools] = useState([]);
  const [previousSearchResults, setPreviousSearchResults] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [onboardingPhase, setOnboardingPhase] = useState(null);
  const [briefStatus, setBriefStatus] = useState(null);
  
  // Chat states
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
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
  
  // Family Brief panel
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [lastTypingTime, setLastTypingTime] = useState(Date.now());
  const [showFamilyBrief, setShowFamilyBrief] = useState(false);
  // T046: Right-side rail panel state
  const [activePanel, setActivePanel] = useState(null); // 'brief' | 'shortlist' | null

  // E31-003: Load More Schools state
  const [extraSchools, setExtraSchools] = useState([]);
  const [extraSchoolsPage, setExtraSchoolsPage] = useState(1);
  const [extraSchoolsHasMore, setExtraSchoolsHasMore] = useState(true);
  const [extraSchoolsLoading, setExtraSchoolsLoading] = useState(false);
  const [extraSchoolsError, setExtraSchoolsError] = useState(null);

  // E39-S11: Hydration source tracking
  const [hydrationSource, setHydrationSource] = useState(null);

  // BRIEF→RESULTS transition animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevIsIntakePhaseRef = useRef(true);

  // T-RES-006: Priority overrides { [rowId]: 'musthave' | 'nicetohave' | 'dontcare' }
  const [priorityOverrides, setPriorityOverrides] = useState({});

  const handlePriorityToggle = (rowId) => {
    setPriorityOverrides(prev => {
      const CYCLE = ['musthave', 'nicetohave', 'dontcare'];
      const current = prev[rowId] || 'nicetohave';
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      // Guard: at least 1 priority must remain non-dontcare
      const updated = { ...prev, [rowId]: next };
      const allDontCare = Object.values(updated).every(v => v === 'dontcare');
      if (allDontCare) return prev;
      return updated;
    });
  };
  
  // DEEPDIVE confirmation state
  const [confirmingSchool, setConfirmingSchool] = useState(null);

  // DEEPDIVE analysis card data
  const [deepDiveAnalysis, setDeepDiveAnalysis] = useState(null);

  // E11b: Comparison artifact matrix
  const [comparisonMatrix, setComparisonMatrix] = useState(null);

  // Visit Prep Kit data
  const [visitPrepKit, setVisitPrepKit] = useState(null);

  // Contact Log data
  const [contactLog, setContactLog] = useState([]);

  // Research Notes
  const [researchNotes, setResearchNotes] = useState('');

  // Action Plan data
  const [actionPlan, setActionPlan] = useState(null);

  // Fit Re-Evaluation data
  const [fitReEvaluation, setFitReEvaluation] = useState(null);

  // T047: Auto-refresh animation trigger
  const [schoolsAnimKey, setSchoolsAnimKey] = useState(0);

  // E41-S8: Left panel mode — 'grid' (default) or 'comparison' (inline, keeps chat visible)
  const [leftPanelMode, setLeftPanelMode] = useState('grid');

  // E39-S8: Memoized set of schools with deep dive analysis
  const schoolsWithDeepDive = useMemo(() => getSchoolsWithDeepDive(messages), [messages]);

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

  // Determine UI phase based on state and schools
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

  // Whether the Family Brief toggle should be visible
  const isBriefState = true; // T045: FamilyBrief visible in all states
  const hasFamilyProfileData = familyProfile && Object.entries(familyProfile).some(
    ([k, v]) => !['id', 'user_id', 'conversation_id', 'created_at', 'updated_at', 'created_by', 'onboarding_phase', 'onboarding_complete'].includes(k)
      && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0) && v !== ''
  );
  const showBriefToggle = isBriefState && hasFamilyProfileData;
  
  // FIX 17: Sync briefStatus from conversation_context whenever it changes
  useEffect(() => {
    const contextBriefStatus = currentConversation?.conversation_context?.briefStatus;
    if (contextBriefStatus !== briefStatus) {
      console.log('[FIX 17] Syncing briefStatus:', contextBriefStatus);
      setBriefStatus(contextBriefStatus);
    }
  }, [currentConversation?.conversation_context?.briefStatus]);
  
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

  const saveScrollPosition = () => {
    if (chatScrollRef.current) {
      setSavedScrollPosition(chatScrollRef.current.scrollTop);
    }
  };

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

  // Hydrate schools from restored conversation_context (after session restore or when context first arrives)
  useEffect(() => {
    const hydrate = async () => {
      let restored = currentConversation?.conversation_context?.schools;
      if (!restored) return;
      // If stored as JSON string, parse first
      if (typeof restored === 'string') {
        try { restored = JSON.parse(restored); } catch (_) { /* noop */ }
      }
      if (Array.isArray(restored) && restored.length > 0) {
        // If array of IDs, fetch full School records
        if (typeof restored[0] === 'string') {
          const fullSchools = await School.filter({ id: { $in: restored } });
          setSchools(fullSchools);
        } else {
          // Already full objects
          setSchools(restored);
        }
      }
    };
    hydrate();
  }, [currentConversation?.conversation_context?.schools]);

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

  const loadConversations = async (userId) => {
    try {
      const convos = await ChatHistory.filter({ user_id: userId, is_active: true });
      // Sort: starred first (by date), then unstarred (by date)
      const sorted = convos.sort((a, b) => {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      setConversations(sorted);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };



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
      const newConvo = {
        user_id: user?.id,
        title: 'New Conversation',
        messages: [],
        conversation_context: { consultant: selectedConsultant },
        is_active: true
      };
      
      const created = await ChatHistory.create(newConvo);
      
      // Load conversations to update sidebar
      await loadConversations(user.id);
      
      // Set as current conversation
      selectConversation(created);
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
        // Archive it
        await ChatHistory.update(oldestConvo.id, {
          is_active: false
        });
        
        // Reload conversations
        await loadConversations(user.id);
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
    setSchools([]);
    setSelectedSchool(null);
    setDeepDiveAnalysis(null);
    setVisitPrepKit(null);
    setActionPlan(null);
    setFitReEvaluation(null);
    setFamilyProfile(null);
    setExtractedEntitiesData(null);
    setSchoolAnalyses({});
    setArtifactCache({});
    setShortlistData([]);
    setRemovedSchoolIds([]);
    setPendingDeepDiveSchoolIds(new Set());
    setShowResponseChips(false);
    setComparisonData(null);
    setComparisonMatrix(null);
    setExtraSchools([]);
    setExtraSchoolsPage(1);
    setExtraSchoolsHasMore(true);
    setExtraSchoolsLoading(false);
    setExtraSchoolsError(null);
    setPriorityOverrides({});
    setVisitedSchoolIds([]);
    setResearchNotes('');
    setSchoolJourney(null);
    setContactLog([]);
    setHydrationSource(null);
    setSchoolsAnimKey(0);
    setLeftPanelMode('grid');
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

  // E47: Called when GuidedIntro completes — transitions to chat with FamilyBrief
  const handleGuidedIntroComplete = (brief) => {
    setFamilyBrief(brief);
    setShowGuidedIntro(false);

    const greeting = {
      role: 'assistant',
      content: selectedConsultant === 'Jackie'
        ? `Great to meet you, ${brief.parentName}! I already have a good picture — let me find the best schools for ${brief.childName}. Feel free to add anything else, or I'll get started.`
        : `Got it, ${brief.parentName}. I have what I need to find strong options for ${brief.childName}. Anything else, or should I start searching?`,
      timestamp: new Date().toISOString()
    };
    setMessages([greeting]);
    setShowResponseChips(true);
  };

  const selectConversation = (convo) => {
    setCurrentConversation(convo);
    setShortlistData([]);
    setRemovedSchoolIds([]);
    
    // FIX #3: Set briefStatus from conversation context
    const contextBriefStatus = convo.conversation_context?.briefStatus;
    if (contextBriefStatus) {
      setBriefStatus(contextBriefStatus);
    } else {
      setBriefStatus(null);
    }

    // Then set messages from this conversation
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

    // BUG-DD-001: Map state to view with DEEP_DIVE guard
    const conversationState = convo.conversation_context?.state || STATES.WELCOME;
    const isDeepDiveWithSchool = conversationState === STATES.DEEP_DIVE && selectedSchool !== null;

    if (!isDeepDiveWithSchool) {
      setCurrentView(mapStateToView(conversationState));
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
        await ChatHistory.update(currentConversation.id, {
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

  // E31-003: Load More Schools handler
  const conversationContext = currentConversation?.conversation_context;
  const loadMoreSchools = useCallback(async () => {
    const lat = conversationContext?.resolvedLat || familyProfile?.resolvedLat || userLocation?.lat;
    const lng = conversationContext?.resolvedLng || familyProfile?.resolvedLng || userLocation?.lng;
    if (!lat || !lng) {
      setExtraSchoolsError('no_location');
      return;
    }
    setExtraSchoolsLoading(true);
    setExtraSchoolsError(null);
    try {
      const displayedIds = (schools || []).map(s => s.id);
      const shortlistIds = shortlistData?.map(s => s.id) || user?.shortlist || [];
      const extraIds = extraSchools.map(s => s.id);
      const excludeIds = [...new Set([...displayedIds, ...shortlistIds, ...extraIds])];

      const result = await invokeFunction('getNearbySchools', {
        lat, lng, excludeIds,
        gradeMin: familyProfile?.childGrade || null,
        maxTuition: familyProfile?.maxTuition || null,
        dealbreakers: familyProfile?.dealbreakers || [],
        familyGender: familyProfile?.childGender || null,
        schoolGenderExclusions: familyProfile?.schoolGenderExclusions || [],
        schoolGenderPreference: familyProfile?.schoolGenderPreference || null,
        page: extraSchoolsPage,
        pageSize: 20,
      });
      const data = result.data || result;
      setExtraSchools(prev => [...prev, ...(data.schools || [])]);
      setExtraSchoolsHasMore(data.hasMore || false);
      setExtraSchoolsPage(prev => prev + 1);
    } catch (err) {
      console.error('[LOAD MORE] Error:', err);
      setExtraSchoolsError('fetch_failed');
    } finally {
      setExtraSchoolsLoading(false);
    }
  }, [extraSchoolsPage, schools, shortlistData, user, extraSchools, familyProfile, conversationContext, userLocation]);

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
    setShowResponseChips,
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

  // T047: No manual refresh handler needed — matches auto-refresh on entity extraction

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
      await ChatHistory.update(currentConversation.id, {
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
    
    try {
      // Mark as inactive instead of deleting
      await ChatHistory.update(conversationToDelete.id, {
        is_active: false
      });
      
      // Reload conversations
      await loadConversations(user.id);
      
      // Clear current conversation if it was the one deleted
      if (currentConversation?.id === conversationToDelete.id) {
        const firstActive = conversations.find(c => c.id !== conversationToDelete.id && c.is_active);
        if (firstActive) {
          selectConversation(firstActive);
        } else {
          setCurrentConversation(null);
          setMessages([]);
          if (!selectedSchool) {
            setCurrentView('welcome');
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
    
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const toggleStarConversation = async (convo, e) => {
    e.stopPropagation();
    try {
      await ChatHistory.update(convo.id, {
        starred: !convo.starred
      });
      await loadConversations(user.id);
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const applyDistancesToSchools = (location) => {
    const sorted = applyDistances(location, schools);
    setSchools(sorted);
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
    showResponseChips,
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

  // E39-S4a: Rehydrate deepDiveAnalysis from persisted messages on school switch
  useEffect(() => {
    // Don't run while AI is still typing
    if (isTyping) return;
    // BUG-RN-05 WC-2: Don't wipe deepDiveAnalysis during session restore
    if (isRestoringSessionRef.current) return;
    if (!selectedSchool?.id || !messages.length) {
      setDeepDiveAnalysis(null);
      setHydrationSource(null);
      return;
    }

    // Scan messages in reverse for the most recent deep dive for this school
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.role === 'assistant' &&
        msg.deepDiveAnalysis &&
        msg.deepDiveAnalysis.schoolId === selectedSchool.id
      ) {
        console.log('[E39-S4a] Rehydrating deepDiveAnalysis from message', i);
        setHydrationSource('HYDRATED_MSG');
        setDeepDiveAnalysis(msg.deepDiveAnalysis);
        return;
      }
    }
    setDeepDiveAnalysis(null);
    setHydrationSource(null);
  }, [messages, isTyping, selectedSchool?.id]);

  // E39-S4b: Rehydrate visitPrepKit from persisted messages on school switch
  useEffect(() => {
    if (isTyping) return;
    if (!selectedSchool?.id || !messages.length) {
      setVisitPrepKit(null);
      setHydrationSource(null);
      return;
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.visitPrepKit && msg.visitPrepKit.schoolId === selectedSchool.id) {
        console.log('[E39-S4b] Rehydrating visitPrepKit from message', i);
        setHydrationSource('HYDRATED_MSG');
        setVisitPrepKit(msg.visitPrepKit);
        return;
      }
    }
    setVisitPrepKit(null);
    setHydrationSource(null);
  }, [messages, isTyping, selectedSchool?.id]);

  // E39-S4c: Rehydrate actionPlan from persisted messages on school switch
  useEffect(() => {
    if (isTyping) return;
    if (!selectedSchool?.id || !messages.length) {
      setActionPlan(null);
      setHydrationSource(null);
      return;
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.actionPlan && msg.actionPlan.schoolId === selectedSchool.id) {
        console.log('[E39-S4c] Rehydrating actionPlan from message', i);
        setHydrationSource('HYDRATED_MSG');
        setActionPlan(msg.actionPlan);
        return;
      }
    }
    setActionPlan(null);
    setHydrationSource(null);
  }, [messages, isTyping, selectedSchool?.id]);

  // E39-S4d: Rehydrate fitReEvaluation from persisted messages on school switch
  useEffect(() => {
    if (isTyping) return;
    if (!selectedSchool?.id || !messages.length) {
      setFitReEvaluation(null);
      setHydrationSource(null);
      return;
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.fitReEvaluation && msg.fitReEvaluation.schoolId === selectedSchool.id) {
        console.log('[E39-S4d] Rehydrating fitReEvaluation from message', i);
        setHydrationSource('HYDRATED_MSG');
        setFitReEvaluation(msg.fitReEvaluation);
        return;
      }
    }
    setFitReEvaluation(null);
    setHydrationSource(null);
  }, [messages, isTyping, selectedSchool?.id]);

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
      <div className="h-screen flex flex-col bg-slate-50">
        <a 
          href="#consultant-selection" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg"
        >
          Skip to consultant selection
        </a>
        <Navbar variant="minimal" />
        <div id="consultant-selection" className="flex-1 overflow-auto">
          <ConsultantSelection onSelectConsultant={handleSelectConsultant} />
        </div>
      </div>
    );
  }

  // E47: Show guided intro sequence after consultant selection, before chat
  if (selectedConsultant && showGuidedIntro) {
    return (
      <div className="h-screen flex flex-col">
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

      {/* E37: Loading overlay on brief confirmation with 5-second minimum */}
      <LoadingOverlay 
        isVisible={showLoadingOverlay}
        onTransitionComplete={() => { setShowLoadingOverlay(false); setBriefStatus(null); setIsTransitioning(true); }}
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
                heroContent={
                  currentState === STATES.WELCOME ? (
                    <div className="text-center space-y-6 py-8">
                      <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-[#E8E8ED]">Welcome to NextSchool</h1>
                        <p className="text-[#E8E8ED]/70">Your personalized school search, simplified</p>
                      </div>
                      <div className="grid gap-4 max-w-md mx-auto text-left">
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                            selectedConsultant === 'Jackie' ? 'bg-[#C27B8A]/20 text-[#C27B8A]' : 'bg-[#6B9DAD]/20 text-[#6B9DAD]'
                          }`}>1</div>
                          <div>
                            <h3 className="font-semibold text-[#E8E8ED]">Tell us about your child</h3>
                            <p className="text-sm text-[#E8E8ED]/60">Grade, location, priorities</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                            selectedConsultant === 'Jackie' ? 'bg-[#C27B8A]/20 text-[#C27B8A]' : 'bg-[#6B9DAD]/20 text-[#6B9DAD]'
                          }`}>2</div>
                          <div>
                            <h3 className="font-semibold text-[#E8E8ED]">Review your brief</h3>
                            <p className="text-sm text-[#E8E8ED]/60">Confirm what matters most</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                            selectedConsultant === 'Jackie' ? 'bg-[#C27B8A]/20 text-[#C27B8A]' : 'bg-[#6B9DAD]/20 text-[#6B9DAD]'
                          }`}>3</div>
                          <div>
                            <h3 className="font-semibold text-[#E8E8ED]">See your matches</h3>
                            <p className="text-sm text-[#E8E8ED]/60">Personalized school recommendations</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null
                }
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
                    name: selectedSchool.name || selectedSchool.schoolName || 'Unknown School',
                    location: `${selectedSchool.city || ''}, ${selectedSchool.provinceState || selectedSchool.province || ''}`.trim().replace(/^,\s*/, ''),
                    grades: selectedSchool.gradesServed || `${selectedSchool.lowestGrade || 'K'}-${selectedSchool.highestGrade || '12'}`,
                    type: selectedSchool.genderPolicy || selectedSchool.schoolTypeLabel || '',
                    students: selectedSchool.enrollment || 0,
                    teacherRatio: selectedSchool.studentTeacherRatio || '',
                    tuition: selectedSchool.tuitionDomesticDay ? `$${Number(selectedSchool.tuitionDomesticDay).toLocaleString()}` : 'Contact school',
                  }}
                  fitScore={deepDiveAnalysis.fitScore}
                  fitLabel={deepDiveAnalysis.fitLabel}
                  tradeOffs={deepDiveAnalysis.tradeOffs}
                  aiInsight={deepDiveAnalysis.aiInsight}
                  priorityMatches={deepDiveAnalysis.priorityMatches || []}
                  journeySteps={journeySteps}
                  keyDates={keyDates}
                  visitPrepKit={visitPrepKit}
                  actionPlan={actionPlan}
                  communityPulse={deepDiveAnalysis.communityPulse || null}
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