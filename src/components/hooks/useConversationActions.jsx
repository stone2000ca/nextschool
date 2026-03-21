import { useCallback } from 'react';
import { updateConversation } from '@/lib/api/conversations';
import { STATES } from '@/lib/stateMachineConfig';

const DEFAULT_GREETING = "Hi! I'm your NextSchool education consultant. I help families across Canada, the US, and Europe find the perfect private school. Tell me about your child — what grade are they in, and what matters most to you in a school?";

export function useConversationActions({
  isAuthenticated, user, conversations,
  selectedConsultant, setSelectedConsultant,
  currentConversation, setCurrentConversation,
  createConversationRecord, switchConversation, archiveConversation,
  loadConversations,
  setMessages,
  setSchools, setSelectedSchool, setCurrentView,
  setOnboardingPhase,
  setActiveJourney,
  resetSchoolState, clearAllArtifacts,
  setFamilyProfile, setExtractedEntitiesData,
  setSchoolAnalyses, setArtifactCache,
  setShortlistData, setRemovedSchoolIds, setPendingDeepDiveSchoolIds,
  setVisitedSchoolIds,
  setShowLoadingOverlay,
  getConversationLimits,
  setArchiveConfirmOpen, setPendingNewConversation,
  setDeleteDialogOpen, setConversationToDelete,
  selectedSchool,
  setComparisonData, previousSearchResults,
  resetJourneyData,
  newChatPendingRef,
}) {
  const resetChatState = useCallback(() => {
    setMessages([]);
    setCurrentConversation({ conversation_context: {} });
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
    setShowLoadingOverlay(false);
    setCurrentView('chat');
    resetJourneyData();
  }, []);

  const selectConversation = useCallback(async (convo) => {
    // FIX-SL-ISOLATE: Clear shortlist BEFORE switchConversation so the useShortlist
    // effect (which fires on currentConversation.id change) doesn't merge stale data
    setShortlistData([]);
    setRemovedSchoolIds([]);
    // FIX-SL-BLEED: Clear stale journey so useShortlist effect doesn't fetch
    // the previous conversation's shortlist using the old journeyId
    setActiveJourney(null);
    await switchConversation(convo);

    const msgs = convo.messages || [];
    if (msgs.length === 0) {
      const greeting = {
        role: 'assistant',
        content: DEFAULT_GREETING,
        timestamp: new Date().toISOString()
      };
      setMessages([greeting]);
      setCurrentConversation({ ...convo, conversation_context: {} });
    } else {
      setMessages(msgs);
    }

    setSchools(convo.conversation_context?.schools || []);
    if (convo.conversation_context?.state !== STATES.DEEP_DIVE) {
      setSelectedSchool(null);
    }
  }, [switchConversation]);

  const proceedWithNewConversation = useCallback(async () => {
    try {
      if (newChatPendingRef) newChatPendingRef.current = true;
      resetChatState();
      const created = await createConversationRecord({ consultant: selectedConsultant });
      if (created) {
        await selectConversation(created);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      if (newChatPendingRef) newChatPendingRef.current = false;
    }
  }, [createConversationRecord, selectedConsultant, selectConversation, resetChatState]);

  const createNewConversation = useCallback(async () => {
    if (!isAuthenticated) {
      setSelectedConsultant(null);
      return;
    }
    const activeCount = conversations.filter(c => c.is_active).length;
    const plan = user?.subscription_plan || 'free';
    const limit = getConversationLimits(plan);

    if (activeCount >= limit) {
      setPendingNewConversation(true);
      setArchiveConfirmOpen(true);
      return;
    }
    await proceedWithNewConversation();
  }, [isAuthenticated, conversations, user, getConversationLimits, proceedWithNewConversation]);

  const handleArchiveOldestConversation = useCallback(async () => {
    try {
      const oldestConvo = conversations
        .filter(c => c.is_active)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

      if (oldestConvo) {
        await archiveConversation(oldestConvo);
      }
      await proceedWithNewConversation();
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    } finally {
      setArchiveConfirmOpen(false);
      setPendingNewConversation(false);
    }
  }, [conversations, archiveConversation, proceedWithNewConversation]);

  const deleteConversation = useCallback(async (conversationToDelete) => {
    if (!conversationToDelete) return;

    const success = await archiveConversation(conversationToDelete);

    if (success) {
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
  }, [archiveConversation, currentConversation, conversations, selectConversation, selectedSchool]);

  const toggleStarConversation = useCallback(async (convo, e) => {
    e.stopPropagation();
    try {
      await updateConversation(convo.id, { starred: !convo.starred });
      await loadConversations(user.id);
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  }, [loadConversations, user]);

  const handleBackToResults = useCallback(async () => {
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
  }, [currentConversation]);

  const handleComparisonBack = useCallback(() => {
    if (previousSearchResults.length > 0) {
      setSchools(previousSearchResults);
    }
    setComparisonData(null);
    if (!selectedSchool) {
      setCurrentView('schools');
    }
  }, [previousSearchResults, selectedSchool]);

  return {
    resetChatState,
    selectConversation,
    createNewConversation,
    proceedWithNewConversation,
    handleArchiveOldestConversation,
    deleteConversation,
    toggleStarConversation,
    handleBackToResults,
    handleComparisonBack,
  };
}
