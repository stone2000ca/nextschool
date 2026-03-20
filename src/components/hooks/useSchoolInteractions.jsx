import { useCallback } from 'react';
import { School } from '@/lib/entities';
import { invokeFunction } from '@/lib/functions';
import { updateConversation } from '@/lib/api/conversations';
import { handleNarrateComparison as narrateComparison } from '@/components/chat/handleNarrateComparison';

export function useSchoolInteractions({
  selectedConsultant, setSelectedConsultant,
  setShowGuidedIntro, setFamilyBrief, familyBriefRef,
  setConfirmingSchool, setSelectedSchool,
  setDeepDiveAnalysis, setVisitPrepKit, setActionPlan,
  setCurrentView, setComparisonData, setLeftPanelMode,
  setComparisonMatrix, setMessages,
  setShowUpgradeModal,
  currentConversation, setCurrentConversation,
  schools, shortlistData, extraSchools,
  familyProfile, visitedSchoolIds,
  isPremium, user,
  handleSendMessage,
  resetChatState,
  trackEvent, sessionId,
  messagesEndRef,
}) {
  const handleSelectConsultant = useCallback((consultantName) => {
    setSelectedConsultant(consultantName);
    invokeFunction('trackSessionEvent', {
      eventType: 'consultant_selected',
      consultantName: consultantName,
      sessionId
    }).catch(err => console.error('Failed to track:', err));

    resetChatState();
    setShowGuidedIntro(true);
  }, [sessionId, resetChatState]);

  const handleGuidedIntroComplete = useCallback((brief) => {
    if (brief.budget && typeof brief.budget === 'string') {
      const nums = brief.budget.match(/\d+/g);
      if (nums && nums.length >= 2) {
        brief.budget = ((Number(nums[0]) + Number(nums[1])) / 2) * 1000;
      } else if (nums && nums.length === 1) {
        brief.budget = Number(nums[0]) * 1000;
      }
      if (isNaN(brief.budget)) brief.budget = '';
    }

    familyBriefRef.current = brief;
    setFamilyBrief(brief);
    setShowGuidedIntro(false);

    setTimeout(() => {
      handleSendMessage('__GUIDED_INTRO_COMPLETE__', null, null);
    }, 50);
  }, [handleSendMessage]);

  const handleViewSchoolDetail = useCallback(async (schoolId, skipConfirmation = false) => {
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
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }, [schools, shortlistData, extraSchools, trackEvent]);

  const handleConfirmDeepDive = useCallback(async (school) => {
    setConfirmingSchool(null);
    setSelectedSchool(school);
    setDeepDiveAnalysis(null);
    setVisitPrepKit(null);
    setActionPlan(null);
    await handleSendMessage(`Tell me about ${school.name}`, school.id);
  }, [handleSendMessage]);

  const handleCancelDeepDive = useCallback(() => {
    setConfirmingSchool(null);
    setSelectedSchool(null);
    setCurrentView('schools');
    if (currentConversation) {
      const updatedContext = {
        ...currentConversation.conversation_context,
        state: 'RESULTS',
        selectedSchoolId: null,
      };
      setCurrentConversation(prevConvo => ({
        ...prevConvo,
        conversation_context: updatedContext,
      }));
      if (currentConversation.id) {
        updateConversation(currentConversation.id, {
          conversation_context: updatedContext,
        });
      }
    }
  }, [currentConversation]);

  // E49-S4B: Pass conversationId + userId for backend enriched narrative + caching
  const handleNarrateComparisonFn = useCallback(async (comparedSchools) => {
    await narrateComparison({
      comparedSchools,
      familyProfile,
      visitedSchoolIds,
      selectedConsultant,
      setMessages,
      setComparisonMatrix,
      conversationId: currentConversation?.id || null,
      userId: user?.id || null,
    });
  }, [familyProfile, visitedSchoolIds, selectedConsultant, currentConversation?.id, user?.id]);

  const handleOpenComparison = useCallback(async (comparedSchools) => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }
    setComparisonData(comparedSchools);
    setLeftPanelMode('comparison');

    try {
      const schoolIds = comparedSchools.map(s => s.id).filter(Boolean);
      await invokeFunction('generateComparison', {
        schoolIds,
        familyProfileId: familyProfile?.id || null,
        userId: user?.id || null
      });
    } catch (e) {
      console.warn('[E11b] generateComparison failed (non-blocking):', e.message);
    }

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
    handleNarrateComparisonFn(comparedSchools);
  }, [isPremium, familyProfile, user, currentConversation, handleNarrateComparisonFn]);

  return {
    handleSelectConsultant,
    handleGuidedIntroComplete,
    handleViewSchoolDetail,
    handleConfirmDeepDive,
    handleCancelDeepDive,
    handleOpenComparison,
    handleNarrateComparison: handleNarrateComparisonFn,
  };
}
