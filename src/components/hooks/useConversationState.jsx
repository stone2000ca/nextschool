/**
 * useConversationState — Phase 3b
 *
 * Owns conversation CRUD, briefStatus, phase tracking, and
 * schools-from-context hydration.
 *
 * Reads state from conversation_state table (Phase 1a) with fallback
 * to conversation_context JSONB for backward compatibility.
 *
 * Ownership boundary:
 *   useConversationState  → conversation lifecycle (load, create, switch, delete)
 *   useMessageHandler     → message-level persistence (updateConversation for messages + context)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchConversationState } from '@/lib/api/entities-api';
import { fetchSchools } from '@/lib/api/schools';
import {
  fetchConversations as apiFetchConversations,
  createConversation as apiCreateConversation,
  updateConversation as apiUpdateConversation,
} from '@/lib/api/conversations';
import { STATES } from '@/lib/stateMachineConfig';

/**
 * Maps conversation state to UI view.
 * Exported so Consultant.jsx and useMessageHandler can share the same mapping.
 */
export const mapStateToView = (state) => {
  if ([STATES.WELCOME, STATES.DISCOVERY, STATES.BRIEF].includes(state)) return 'chat';
  if (state === STATES.RESULTS) return 'schools';
  if (state === STATES.DEEP_DIVE) return 'detail';
  return 'chat';
};

/**
 * @param {object} opts
 * @param {string}   opts.userId              — authenticated user ID
 * @param {boolean}  opts.isAuthenticated
 * @param {object}   opts.user                — full user object
 * @param {object}   opts.selectedSchool       — currently selected school (for DEEP_DIVE guard)
 * @param {Function} opts.setSchools           — setter for schools array (for hydration)
 * @param {string|null} opts.initialPendingMessage — initial ?q= param value
 *
 * @returns conversation state, setters, and CRUD methods
 */
export function useConversationState({
  userId,
  isAuthenticated,
  user,
  selectedSchool,
  setSchools,
  initialPendingMessage = null,
}) {
  // ─── Conversation state (moved from Consultant.jsx) ────────────
  const [currentConversation, setCurrentConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [briefStatus, setBriefStatus] = useState(null);
  const [onboardingPhase, setOnboardingPhase] = useState(null);
  const [currentView, setCurrentView] = useState('welcome');
  const [sessionId] = useState(() => crypto.randomUUID());
  const [sessionRestored, setSessionRestored] = useState(false);
  const [restoringSession, setRestoringSession] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [pendingMessage, setPendingMessage] = useState(initialPendingMessage);
  const [isLoading, setIsLoading] = useState(false);
  const isRestoringSessionRef = useRef(false);

  // ─── Read from conversation_state table (Phase 1a) ─────────────
  // Falls back to conversation_context JSONB if no normalized row exists.
  const readConversationState = useCallback(async (conversationId) => {
    if (!conversationId) return null;
    try {
      const rows = await fetchConversationState(conversationId);
      if (rows.length > 0) {
        console.log('[useConversationState] Read state from conversation_state table for:', conversationId);
        return rows[0];
      }
    } catch (e) {
      console.warn('[useConversationState] conversation_state read failed, using JSONB fallback:', e.message);
    }
    return null;
  }, []);

  // ─── Load conversations for sidebar ────────────────────────────
  const loadConversations = useCallback(async (uid) => {
    const targetUid = uid || userId;
    if (!targetUid) return;
    try {
      const convos = await apiFetchConversations();
      // Sort: starred first (by date), then unstarred (by date)
      const sorted = convos.sort((a, b) => {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      setConversations(sorted);
    } catch (error) {
      console.error('[useConversationState] Failed to load conversations:', error);
    }
  }, [userId]);

  // ─── Switch to a conversation ──────────────────────────────────
  // Reads from conversation_state table with JSONB fallback.
  // Sets hook-owned state and returns resolved data so the caller
  // can perform additional side effects (e.g. setMessages, setSchools).
  const switchConversation = useCallback(async (convo) => {
    // Read normalized state (with fallback)
    const stateData = await readConversationState(convo.id);

    // Resolve briefStatus: prefer conversation_state table, fall back to JSONB
    const resolvedBriefStatus = stateData?.brief_status
      ?? convo.conversation_context?.briefStatus
      ?? null;
    setBriefStatus(resolvedBriefStatus);

    // Set current conversation
    setCurrentConversation(convo);

    // Resolve conversation state for view mapping
    const resolvedState = stateData?.state
      ?? convo.conversation_context?.state
      ?? STATES.WELCOME;

    // BUG-DD-001: Don't override view if in DEEP_DIVE with a selected school
    const isDeepDiveWithSchool = resolvedState === STATES.DEEP_DIVE && selectedSchool !== null;
    if (!isDeepDiveWithSchool) {
      setCurrentView(mapStateToView(resolvedState));
    }

    return { stateData, resolvedBriefStatus, resolvedState };
  }, [readConversationState, selectedSchool]);

  // ─── Create a new conversation ─────────────────────────────────
  const createConversation = useCallback(async ({ consultant } = {}) => {
    if (!userId) return null;
    try {
      setIsLoading(true);
      const newConvo = {
        user_id: userId,
        title: 'New Conversation',
        messages: [],
        conversation_context: { consultant },
        is_active: true,
      };
      const created = await apiCreateConversation(newConvo);
      await loadConversations(userId);
      return created;
    } catch (error) {
      console.error('[useConversationState] Failed to create conversation:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId, loadConversations]);

  // ─── Delete (archive) a conversation ───────────────────────────
  const deleteConversation = useCallback(async (convo) => {
    if (!convo?.id) return false;
    try {
      await apiUpdateConversation(convo.id, { is_active: false });
      await loadConversations(userId);
      return true;
    } catch (error) {
      console.error('[useConversationState] Failed to delete conversation:', error);
      return false;
    }
  }, [userId, loadConversations]);

  // ─── Schools-from-context hydration ────────────────────────────
  // When conversation_context.schools changes (e.g. session restore),
  // fetch full School records if only IDs are stored.
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
          const fullSchools = await fetchSchools({ ids: restored });
          setSchools(fullSchools);
        } else {
          // Already full objects
          setSchools(restored);
        }
      }
    };
    hydrate();
  }, [currentConversation?.conversation_context?.schools, setSchools]);

  // ─── BriefStatus sync from conversation_context ────────────────
  // FIX 17: Sync briefStatus from context but never re-lock when RESULTS arrived.
  // FIX-RACE (Defensive): Never re-lock the overlay when RESULTS have already arrived.
  // Without this guard, a stale 'confirmed' from a batched setCurrentConversation
  // update can re-set briefStatus and re-show the LoadingOverlay after dismissal.
  useEffect(() => {
    const contextBriefStatus = currentConversation?.conversation_context?.briefStatus;
    const contextState = currentConversation?.conversation_context?.state;
    if (contextState === STATES.RESULTS) return;
    if (contextBriefStatus !== briefStatus) {
      console.log('[useConversationState] Syncing briefStatus:', contextBriefStatus);
      setBriefStatus(contextBriefStatus);
    }
  }, [currentConversation?.conversation_context?.briefStatus]);

  return {
    // State + setters
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
    isLoading,

    // CRUD methods
    loadConversations,
    createConversation,
    switchConversation,
    deleteConversation,
  };
}
