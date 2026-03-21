import { useState, useEffect, useRef } from 'react';
import { invokeFunction } from '@/lib/functions';
import { restoreMostRecentConversation, restoreSessionFromParam } from '@/components/chat/SessionRestorer';

const PLAN_NAMES = { FREE: 'free', BASIC: 'basic', PREMIUM: 'premium', PRO: 'pro', ENTERPRISE: 'enterprise' };
const DEFAULT_GREETING = "Hi! I'm your NextSchool education consultant. I help families across Canada, the US, and Europe find the perfect private school. Tell me about your child — what grade are they in, and what matters most to you in a school?";

export function useConsultantSession({
  authUser, authIsAuthenticated, authIsLoadingAuth, authUpdateMe,
  searchParams, router,
  sessionId,
  currentConversation, setCurrentConversation,
  setSessionRestored, setRestoringSession, isRestoringSessionRef,
  setDebugInfo, setOnboardingPhase,
  loadConversations,
  pendingMessage, setPendingMessage,
  setSchools, setSelectedSchool, setCurrentView,
}) {
  // ─── State ───
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(100);
  const [isPremium, setIsPremium] = useState(false);
  const [feedbackPromptShown, setFeedbackPromptShown] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState(null);
  const [showGuidedIntro, setShowGuidedIntro] = useState(false);
  const [familyBrief, setFamilyBrief] = useState(null);
  const familyBriefRef = useRef(null);

  // ─── Refs for late-bound deps (populated by Consultant.jsx after later hooks) ───
  const loadShortlistRef = useRef(null);
  const handleSendMessageRef = useRef(null);
  const depsRef = useRef({});

  // ─── Derived ───
  const sessionIdParam = searchParams.get('sessionId');
  const sessionParamProcessedRef = useRef(false);

  const isDevMode = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('dev') === 'true'
    : false;
  const isDebugMode = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('debug') === 'true'
    : false;

  const loadingStages = [
    "Analyzing request...",
    "Searching schools...",
    "Preparing recommendations..."
  ];

  // ─── Plan helpers ───
  const getPlanLimits = (plan) => {
    if (plan === PLAN_NAMES.FREE) return { total: 100, dailyReplenishment: 3 };
    return { total: 1000, dailyReplenishment: 33 };
  };

  const getConversationLimits = (plan) => {
    if (plan === PLAN_NAMES.FREE) return 1;
    return 10;
  };

  // ─── Auth check ───
  const checkAuth = async () => {
    // Wait for AuthContext to finish loading before making decisions
    if (authIsLoadingAuth) return;

    try {
      const authenticated = authIsAuthenticated;
      setIsAuthenticated(authenticated);

      if (authenticated) {
        // Guard: profile not yet loaded — wait for next trigger
        if (!authUser || !authUser.id) return;
        const userData = authUser;
        setUser(userData);

        const plan = userData.subscription_plan || userData.tier || 'free';
        const limits = getPlanLimits(plan);
        if (plan !== PLAN_NAMES.FREE) {
          setTokenBalance(999999);
          setIsPremium(true);
        } else {
          const today = new Date().toISOString().split('T')[0];
          const renewalDate = userData.renewal_date ? userData.renewal_date.split('T')[0] : null;

          let newBalance = userData.token_balance !== undefined ? userData.token_balance : limits.total;

          if (!renewalDate || today > renewalDate) {
            newBalance = Math.min(newBalance + limits.dailyReplenishment, limits.total);
            await authUpdateMe({
              token_balance: newBalance,
              renewal_date: new Date().toISOString()
            });
          }

          setTokenBalance(newBalance);
          setIsPremium(false);
        }
        await loadConversations(userData.id);
        // RC-4 FIX: Removed premature loadShortlistRef.current?.() call.
        // loadShortlist is now called by restoreMostRecentConversation (RC-3)
        // or restoreSessionFromParam, which both pass explicit journeyId.
      } else {
        if (!isDevMode) {
          const returnTo = window.location.pathname + window.location.search;
          window.location.href = '/login?returnTo=' + encodeURIComponent(returnTo);
          return;
        }
        const DEV_TOKEN_BALANCE = 100;
        setTokenBalance(DEV_TOKEN_BALANCE);
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

  // ─── Mount effect: SEO, event reminders, session tracking, auth ───
  useEffect(() => {
    document.title = 'Meet Your Education Consultant | NextSchool';
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'Chat with Jackie or Liam, your AI education consultants. Get personalized private school recommendations in minutes.';

    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'School Search Consulting',
      description: 'AI-powered personalized private school recommendations',
      provider: { '@type': 'Organization', name: 'NextSchool', url: 'https://nextschool.ca' },
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

    if (!authIsLoadingAuth) {
      checkAuth();
    }

    fetch('/api/event-reminders')
      .then(r => r.ok ? r.json() : [])
      .then(reminders => {
        if (!reminders.length) return;
        const now = new Date();
        const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const { toast } = require('sonner');
        reminders.forEach(reminder => {
          const eventDate = new Date(reminder.event_date);
          if (eventDate > now && eventDate <= fortyEightHoursFromNow) {
            const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            const timeText = daysUntil === 0 ? 'tomorrow' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
            toast.info(`Reminder: ${reminder.school_name} — ${reminder.event_title} is ${timeText}!`);
          }
        });
        fetch('/api/event-reminders', { method: 'DELETE' }).catch(() => {});
      })
      .catch(err => console.error('[E16a-019] Failed to check reminders:', err));

    invokeFunction('trackSessionEvent', {
      eventType: 'session_start',
      sessionId
    }).catch(err => console.error('Failed to track session:', err));
  }, [sessionId, authIsLoadingAuth, authIsAuthenticated, authUser?.id]);

  // ─── Session restore from URL param ───
  useEffect(() => {
    if (sessionIdParam && !sessionParamProcessedRef.current && isAuthenticated && user) {
      const d = depsRef.current;
      restoreSessionFromParam(
        sessionIdParam, null, isAuthenticated, user,
        setSelectedConsultant, d.setRestoredSessionData, setMessages,
        d.setFamilyProfile, setSchools, setCurrentView, setOnboardingPhase,
        setCurrentConversation, setSessionRestored, setRestoringSession,
        loadShortlistRef.current, isRestoringSessionRef, sessionParamProcessedRef,
        setDebugInfo, d.setDeepDiveAnalysis, setSelectedSchool,
        d.setVisitPrepKit, d.setActionPlan, d.skipViewOverrideRef, d.setSchoolAnalyses
      );
    }
  }, [sessionIdParam, isAuthenticated, user?.id]);

  // ─── Safety timeout: ensure sessionRestored resolves within 15s ───
  // Prevents infinite spinner if restoreSessionFromParam hangs (network, etc.)
  useEffect(() => {
    if (!sessionIdParam) return;
    const timeout = setTimeout(() => {
      setSessionRestored((current) => {
        if (!current) {
          console.warn('[SESSION] Safety timeout triggered — forcing sessionRestored to true');
          setRestoringSession(false);
          isRestoringSessionRef.current = false;
        }
        return true;
      });
    }, 15000);
    return () => clearTimeout(timeout);
  }, [sessionIdParam]);

  // ─── RC-3 FIX: Restore most recent conversation on plain F5 (no sessionId) ───
  useEffect(() => {
    if (isAuthenticated && user && !sessionIdParam) {
      const d = depsRef.current;
      restoreMostRecentConversation(
        null, // _unused
        user,
        setMessages,
        setSelectedConsultant,
        setCurrentConversation,
        d.setFamilyProfile,
        setSchools,
        setCurrentView,
        setOnboardingPhase,
        d.setDeepDiveAnalysis,
        setSelectedSchool,
        isRestoringSessionRef,
        d.skipViewOverrideRef,
        d.setSchoolAnalyses,
        loadShortlistRef.current // loadShortlist — passes explicit journeyId internally
      );
    }
  }, [isAuthenticated, user?.id, sessionIdParam]);

  // ─── Loading stage progression ───
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

  // ─── Pending message injection from ?q= param ───
  useEffect(() => {
    if (pendingMessage && !showGuidedIntro && selectedConsultant && messages.length === 1 && messages[0].role === 'assistant') {
      handleSendMessageRef.current?.(pendingMessage);
      setPendingMessage(null);
      router.replace('/consultant');
    }
  }, [pendingMessage, showGuidedIntro, selectedConsultant, messages]);

  return {
    loading, user, setUser, isAuthenticated,
    tokenBalance, setTokenBalance, isPremium,
    feedbackPromptShown, setFeedbackPromptShown,
    loadingStage, loadingStages,
    isDevMode, isDebugMode, sessionIdParam,
    getPlanLimits, getConversationLimits,
    messages, setMessages,
    isTyping, setIsTyping,
    selectedConsultant, setSelectedConsultant,
    showGuidedIntro, setShowGuidedIntro,
    familyBrief, setFamilyBrief, familyBriefRef,
    // Refs for late-bound deps
    loadShortlistRef, handleSendMessageRef, depsRef,
  };
}
