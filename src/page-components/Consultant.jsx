import { useRef, useMemo, useCallback } from 'react';

import { useAuth } from '@/lib/AuthContext';
import { STATES } from '@/lib/stateMachineConfig';
import { invokeFunction } from '@/lib/functions';
import { LayoutGroup } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';

// Existing hooks
import { useConversationState, mapStateToView } from '@/components/hooks/useConversationState';
import { useSchoolResults } from '@/components/hooks/useSchoolResults';
import { useDataLoader } from '@/components/hooks/useDataLoader';
import { useShortlist } from '@/components/hooks/useShortlist';
import { useArtifacts } from '@/components/hooks/useArtifacts';
import { useSchoolFiltering } from '@/components/hooks/useSchoolFiltering';
import { useMessageHandler } from '@/components/hooks/useMessageHandler';
import { useUserLocation } from '@/components/hooks/useUserLocation';

// New hooks (CC2 decomposition)
import { useConsultantSession } from '@/components/hooks/useConsultantSession';
import { useConsultantUI } from '@/components/hooks/useConsultantUI';
import { useConversationActions } from '@/components/hooks/useConversationActions';
import { useSchoolInteractions } from '@/components/hooks/useSchoolInteractions';
import { useSchoolJourneyData } from '@/components/hooks/useSchoolJourneyData';
import { useActionProcessor } from '@/components/hooks/useActionProcessor';
import { useDeepLinkHandler } from '@/components/hooks/useDeepLinkHandler';

// Components
import Navbar from '@/components/navigation/Navbar';
import IconRail from '@/components/navigation/IconRail';
import ChatPanel from '@/components/chat/ChatPanel';
import ConsultantSelection from '@/components/chat/ConsultantSelection';
import GuidedIntro from '@/components/chat/GuidedIntro';
import FamilyBrief from '@/components/chat/FamilyBrief';
import AddSchoolPanel from '@/components/chat/AddSchoolPanel';
import ConsultantDialogs from '@/components/chat/ConsultantDialogs';
import ProgressBar from '@/components/ui/progress-bar';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

// New sub-components (CC2 decomposition)
import ResultsPhaseContent from '@/components/chat/ResultsPhaseContent';
import SlidingPanels from '@/components/chat/SlidingPanels';
import OverlayPanels from '@/components/chat/OverlayPanels';

import { getSchoolsWithDeepDive } from '@/components/utils/deepDiveUtils';

export default function Consultant() {
  const trackEvent = (typeof window !== 'undefined' && window.trackEvent) ? window.trackEvent : () => {};
  const { user: authUser, isAuthenticated: authIsAuthenticated, isLoadingAuth: authIsLoadingAuth, updateMe: authUpdateMe } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // E49-S4A: Ref for handleOpenComparison so useMessageHandler can call it
  // without declaration-order issues (handleOpenComparison comes from useSchoolInteractions, defined later)
  const compareShortlistRef = useRef(null);

  // ─── School results (Phase 3c) ───
  const {
    schools, setSchools,
    previousSearchResults, setPreviousSearchResults,
    selectedSchool, setSelectedSchool,
    extraSchools, setExtraSchools,
    extraSchoolsPage, setExtraSchoolsPage,
    extraSchoolsHasMore, setExtraSchoolsHasMore,
    extraSchoolsLoading, extraSchoolsError,
    loadMoreSchools: _loadMoreSchools,
    priorityOverrides, setPriorityOverrides, handlePriorityToggle,
    confirmingSchool, setConfirmingSchool,
    schoolsAnimKey, setSchoolsAnimKey,
    leftPanelMode, setLeftPanelMode,
    resetSchoolState,
  } = useSchoolResults();

  // ─── Conversation state (Phase 3b) ───
  const {
    currentConversation, setCurrentConversation,
    conversations,
    briefStatus, setBriefStatus,
    onboardingPhase, setOnboardingPhase,
    currentView, setCurrentView,
    sessionId, sessionRestored, setSessionRestored,
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

  // ─── Session management (auth, messages, typing, consultant state) ───
  const session = useConsultantSession({
    authUser, authIsAuthenticated, authIsLoadingAuth, authUpdateMe,
    searchParams, router,
    sessionId,
    currentConversation, setCurrentConversation,
    setSessionRestored, setRestoringSession, isRestoringSessionRef,
    setDebugInfo, setOnboardingPhase,
    loadConversations, pendingMessage, setPendingMessage,
    setSchools, setSelectedSchool, setCurrentView,
  });

  const {
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
    loadShortlistRef, handleSendMessageRef, depsRef, newChatPendingRef,
  } = session;

  // ─── Derived state ───
  const currentState = currentConversation?.conversation_context?.state || STATES.WELCOME;
  const conversationContext = currentConversation?.conversation_context;

  // ─── UI state (panels, dialogs, transitions, scroll) ───
  const ui = useConsultantUI({
    currentConversation, selectedSchool, schools,
    currentView, setCurrentView,
    isRestoringSessionRef, currentState,
    briefStatus, isTyping, messages,
    leftPanelMode,
  });

  // ─── Data loading ───
  const {
    familyProfile, setFamilyProfile,
    artifactCache, setArtifactCache,
    schoolAnalyses, setSchoolAnalyses,
    visitedSchoolIds, setVisitedSchoolIds,
    activeJourney, setActiveJourney,
    extractedEntitiesData, setExtractedEntitiesData,
    restoredSessionData, setRestoredSessionData,
    loadFamilyProfile, loadPreviousArtifacts,
  } = useDataLoader({ user, currentConversation, isAuthenticated });

  // ─── Shortlist ───
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
    selectedConsultant, familyProfile, setMessages, trackEvent,
    setShowLoginGate: ui.setShowLoginGate,
    onConfirmDeepDive: (school) => handleConfirmDeepDive(school),
    currentConversation, activeJourney, extraSchools,
  });

  // ─── Artifacts ───
  const {
    deepDiveAnalysis, setDeepDiveAnalysis,
    visitPrepKit, setVisitPrepKit,
    actionPlan, setActionPlan,
    fitReEvaluation, setFitReEvaluation,
    comparisonData, setComparisonData,
    comparisonMatrix, setComparisonMatrix,
    hydrationSource, setHydrationSource,
    isLoading: artifactsLoading,
    refreshArtifacts, clearAll: clearAllArtifacts,
  } = useArtifacts(currentConversation?.id, selectedSchool?.id);

  // ─── School journey data ───
  const {
    schoolJourney, journeySteps,
    researchNotes, setResearchNotes,
    contactLog, handleSaveNotes, resetJourneyData,
  } = useSchoolJourneyData({ selectedSchool, isAuthenticated, user, deepDiveAnalysis });

  // ─── School filtering ───
  const {
    filteredSchools, showDistances, applyDistances,
    resetSort, filterOverrides, setFilterOverrides, resetFilterOverrides,
  } = useSchoolFiltering(schools, conversationContext);

  // ─── User location ───
  const userLocation = useUserLocation();

  // ─── Load more schools (cross-hook wrapper) ───
  const loadMoreSchools = useCallback(
    () => _loadMoreSchools({ conversationContext, familyProfile, userLocation, shortlistData, user }),
    [_loadMoreSchools, conversationContext, familyProfile, userLocation, shortlistData, user],
  );

  // ─── Memoized deep-dive school set ───
  const schoolsWithDeepDive = useMemo(() => getSchoolsWithDeepDive(messages), [messages]);

  // ─── Message handler ───
  const { handleSendMessage } = useMessageHandler({
    messages, setMessages, selectedConsultant, sessionId,
    isAuthenticated, setShowLoginGate: ui.setShowLoginGate,
    currentConversation, familyProfile, briefStatus, setBriefStatus,
    extractedEntitiesData, setExtractedEntitiesData,
    isPremium, tokenBalance, setTokenBalance, user, setUser,
    shortlistData, schools, setSchools, selectedSchool, setSelectedSchool,
    setCurrentView, onboardingPhase, restoredSessionData,
    setCurrentConversation, setIsTyping, setLastTypingTime: ui.setLastTypingTime,
    setFamilyProfile, setSchoolsAnimKey, setDeepDiveAnalysis,
    setVisitPrepKit, setActionPlan, setFitReEvaluation,
    artifactCache, resetSort, loadShortlist, loadConversations,
    userLocation, setFeedbackPromptShown, feedbackPromptShown,
    isDevMode, setShowUpgradeModal: ui.setShowUpgradeModal, trackEvent,
    mapStateToView, hasAutoPopulatedShortlist,
    activeJourney, setActiveJourney,
    setFilterOverrides, resetFilterOverrides, loadMoreSchools,
    setActivePanel: ui.setActivePanel, applyDistances,
    familyBrief, familyBriefRef,
    // E49-S4A: Comparison intent routing — uses ref wrapper for declaration-order safety
    onCompareShortlist: (...args) => compareShortlistRef.current?.(...args),
  });

  // ─── Conversation actions ───
  const {
    resetChatState, selectConversation,
    createNewConversation, handleArchiveOldestConversation,
    deleteConversation, toggleStarConversation,
    handleBackToResults, handleComparisonBack,
  } = useConversationActions({
    isAuthenticated, user, conversations,
    selectedConsultant, setSelectedConsultant,
    currentConversation, setCurrentConversation,
    createConversationRecord, switchConversation, archiveConversation,
    loadConversations, setMessages,
    setSchools, setSelectedSchool, setCurrentView,
    setBriefStatus, setOnboardingPhase, setActiveJourney,
    resetSchoolState, clearAllArtifacts,
    setFamilyProfile, setExtractedEntitiesData,
    setSchoolAnalyses, setArtifactCache,
    setShortlistData, setRemovedSchoolIds, setPendingDeepDiveSchoolIds,
    setVisitedSchoolIds, setShowLoadingOverlay: ui.setShowLoadingOverlay,
    getConversationLimits,
    setArchiveConfirmOpen: ui.setArchiveConfirmOpen,
    setPendingNewConversation: ui.setPendingNewConversation,
    setDeleteDialogOpen: ui.setDeleteDialogOpen,
    setConversationToDelete: ui.setConversationToDelete,
    selectedSchool,
    setComparisonData, previousSearchResults,
    resetJourneyData,
    newChatPendingRef,
  });

  // ─── School interactions ───
  const {
    handleSelectConsultant, handleGuidedIntroComplete,
    handleViewSchoolDetail, handleConfirmDeepDive, handleCancelDeepDive,
    handleOpenComparison, handleNarrateComparison,
  } = useSchoolInteractions({
    selectedConsultant, setSelectedConsultant,
    setShowGuidedIntro, setFamilyBrief, familyBriefRef,
    setConfirmingSchool, setSelectedSchool,
    setDeepDiveAnalysis, setVisitPrepKit, setActionPlan,
    setCurrentView, setComparisonData, setLeftPanelMode,
    setComparisonMatrix, setMessages,
    setShowUpgradeModal: ui.setShowUpgradeModal,
    currentConversation, setCurrentConversation,
    schools, shortlistData, extraSchools,
    familyProfile, visitedSchoolIds,
    isPremium, user,
    handleSendMessage, resetChatState,
    trackEvent, sessionId,
    messagesEndRef: ui.messagesEndRef,
  });

  // E49-S4A: Keep ref in sync so useMessageHandler can call latest version
  compareShortlistRef.current = handleOpenComparison;

  // ─── Action processor (pure side effects) ───
  useActionProcessor({
    messages, isTyping,
    shortlistData, removedSchoolIds,
    schools, extraSchools,
    handleToggleShortlist,
    setSelectedSchool, setCurrentView,
    setActivePanel: ui.setActivePanel,
    setPendingDeepDiveSchoolIds, setAutoExpandSchoolId,
    setTourRequestSchool: ui.setTourRequestSchool,
    applyDistances, userLocation,
    schoolAnalyses,
    currentConversation,
  });

  // ─── Deep link handling (E51-S1A) ───
  useDeepLinkHandler({
    setSelectedSchool,
    setDetailTab: ui.setDetailTab,
    setCurrentView,
  });

  // ─── Populate late-bound refs for session hook ───
  loadShortlistRef.current = loadShortlist;
  handleSendMessageRef.current = handleSendMessage;
  depsRef.current = {
    setRestoredSessionData, setFamilyProfile, setSchoolAnalyses,
    setDeepDiveAnalysis, setVisitPrepKit, setActionPlan,
    skipViewOverrideRef: ui.skipViewOverrideRef,
  };

  // ─── Chat panel props (shared between intake + results) ───
  const chatPanelProps = {
    ref: ui.inputRef,
    messages, schools, selectedConsultant, currentState,
    briefStatus, isTyping, tokenBalance, isPremium,
    loadingStage, loadingStages, feedbackPromptShown, familyProfile,
    onSendMessage: handleSendMessage,
    onTogglePanel: ui.setActivePanel,
    onSetExpandedSchool: setAutoExpandSchoolId,
    onViewSchoolDetail: (school) => {
      setSelectedSchool(school);
      setCurrentView('detail');
    },
    onConfirmDeepDive: handleConfirmDeepDive,
    onCancelDeepDive: handleCancelDeepDive,
    deepDiveSchoolName: (pendingDeepDiveSchoolIds.size > 0 || (currentView === 'detail' && !confirmingSchool)) && selectedSchool ? selectedSchool.name : null,
  };

  // ─── Early returns ───
  const spinner = <div className="h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" /></div>;
  if (loading || (!selectedConsultant && sessionIdParam && (!sessionRestored || restoringSession))) return spinner;
  if (sessionIdParam && !sessionRestored && restoringSession) {
    return <div className="h-screen relative bg-slate-50"><LoadingOverlay isVisible={true} onTransitionComplete={() => {}} /></div>;
  }
  if (!selectedConsultant) {
    return (
      <LayoutGroup><div className="h-screen flex flex-col bg-slate-900">
        <a href="#consultant-selection" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg">Skip to consultant selection</a>
        <div id="consultant-selection" className="flex-1 overflow-auto"><ConsultantSelection onSelectConsultant={handleSelectConsultant} /></div>
      </div></LayoutGroup>
    );
  }
  if (selectedConsultant && showGuidedIntro) {
    return <div className="h-screen flex flex-col relative"><GuidedIntro consultantName={selectedConsultant} onComplete={handleGuidedIntroComplete} /></div>;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg">Skip to main content</a>
      <ProgressBar isLoading={isTyping} />
      <Navbar variant="minimal" />
      <LoadingOverlay isVisible={ui.showLoadingOverlay} familyBrief={familyBrief} onTransitionComplete={() => { ui.setShowLoadingOverlay(false); ui.setIsTransitioning(true); }} />

      {(ui.isIntakePhase && !ui.showSchoolGrid) ? (
        /* INTAKE PHASE - Centered Layout */
        <div id="main-content" className="flex-1 flex bg-[#1E1E2E] overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
            <div className="w-full max-w-2xl h-full max-h-[95vh] sm:max-h-[90vh] bg-[#2A2A3D] rounded-xl sm:rounded-2xl shadow-2xl flex flex-col transition-all duration-400">
              <ChatPanel {...chatPanelProps} variant="intake" isPremium={isPremium} onUpgrade={() => ui.setShowUpgradeModal(true)} heroContent={null} />
            </div>
          </div>

          {ui.activePanel === 'brief' && (
            <FamilyBrief familyProfile={familyProfile} consultantName={selectedConsultant} onClose={() => ui.setActivePanel(null)} extractedEntities={extractedEntitiesData} />
          )}
          {ui.activePanel === 'addSchool' && (
            <AddSchoolPanel onClose={() => ui.setActivePanel(null)} onToggleShortlist={handleToggleShortlist} shortlistedIds={shortlistData.map(s => s.id)} />
          )}
          <IconRail currentState={currentState} activePanel={ui.activePanel} onTogglePanel={(panel) => ui.setActivePanel(p => p === panel ? null : panel)} shortlistCount={shortlistData.length} />
        </div>
      ) : (
        /* RESULTS PHASE - Split Layout */
        <div className="flex-1 flex flex-row overflow-hidden relative transition-all duration-400 pb-0">
          {/* CENTER CONTENT AREA */}
          <main
            className="overflow-y-auto bg-white transition-all duration-200 ease-out"
            style={{
              flex: 1, minWidth: 0,
              animation: ui.isTransitioning ? 'slideInFromLeft 420ms cubic-bezier(0.22,1,0.36,1) both' : undefined,
            }}
          >
            <ResultsPhaseContent
              leftPanelMode={leftPanelMode} comparisonData={comparisonData}
              setLeftPanelMode={setLeftPanelMode} setComparisonData={setComparisonData}
              currentConversation={currentConversation} setCurrentConversation={setCurrentConversation}
              currentView={currentView} selectedSchool={selectedSchool}
              deepDiveAnalysis={deepDiveAnalysis} actionPlan={actionPlan} visitPrepKit={visitPrepKit}
              familyProfile={familyProfile} comparisonMatrix={comparisonMatrix}
              isPremium={isPremium} setShowUpgradeModal={ui.setShowUpgradeModal}
              setSelectedSchool={setSelectedSchool} setCurrentView={setCurrentView}
              handleToggleShortlist={handleToggleShortlist} shortlistData={shortlistData}
              handleOpenComparison={handleOpenComparison} handleSendMessage={handleSendMessage}
              currentState={currentState} schools={schools} filteredSchools={filteredSchools}
              schoolsAnimKey={schoolsAnimKey} priorityOverrides={priorityOverrides}
              handleViewSchoolDetail={handleViewSchoolDetail} handlePriorityToggle={handlePriorityToggle}
              handleNarrateComparison={handleNarrateComparison}
              isTyping={isTyping} selectedConsultant={selectedConsultant}
              showDistances={showDistances}
              visitedSchoolIds={visitedSchoolIds} extraSchools={extraSchools}
              loadMoreSchools={loadMoreSchools}
              extraSchoolsLoading={extraSchoolsLoading} extraSchoolsHasMore={extraSchoolsHasMore}
              extraSchoolsError={extraSchoolsError}
              conversationContext={conversationContext} userLocation={userLocation}
              journeySteps={journeySteps} contactLog={contactLog}
              researchNotes={researchNotes} setResearchNotes={setResearchNotes}
              handleSaveNotes={handleSaveNotes} messages={messages}
              showSchoolGrid={ui.showSchoolGrid}
              detailTab={ui.detailTab} setDetailTab={ui.setDetailTab}
            />
          </main>

          {/* Sliding panels */}
          <SlidingPanels
            activePanel={ui.activePanel}
            familyProfile={familyProfile} selectedConsultant={selectedConsultant}
            extractedEntitiesData={extractedEntitiesData}
            setActivePanel={ui.setActivePanel}
            handleToggleShortlist={handleToggleShortlist} shortlistData={shortlistData}
            schoolAnalyses={schoolAnalyses} artifactCache={artifactCache}
            handleSendMessage={handleSendMessage} isPremium={isPremium}
            handleDossierExpandChange={handleDossierExpandChange}
            handleDeepDiveFromDossier={handleDeepDiveFromDossier}
            pendingDeepDiveSchoolIds={pendingDeepDiveSchoolIds}
            handleViewSchoolDetail={handleViewSchoolDetail}
            autoExpandSchoolId={autoExpandSchoolId} setAutoExpandSchoolId={setAutoExpandSchoolId}
            schoolsWithDeepDive={schoolsWithDeepDive}
          />

          {/* Icon Rail */}
          <IconRail currentState={currentState} activePanel={ui.activePanel} onTogglePanel={(panel) => ui.setActivePanel(p => p === panel ? null : panel)} shortlistCount={shortlistData.length} />

          {/* RIGHT CHAT PANEL */}
          <aside
            className="bg-[#2A2A3D] border-l border-white/10 flex flex-col relative flex-shrink-0"
            style={{ width: 450, transition: 'width 420ms cubic-bezier(0.22,1,0.36,1)' }}
          >
            <ChatPanel
              {...chatPanelProps} variant="sidebar"
              isPremium={isPremium} onUpgrade={() => ui.setShowUpgradeModal(true)}
              confirmingSchool={confirmingSchool}
              showNewMessageIndicator={ui.showNewMessageIndicator}
              onScrollDownClick={ui.handleScrollDownClick}
            />
          </aside>
        </div>
      )}

      <ConsultantDialogs
        deleteDialogOpen={ui.deleteDialogOpen} setDeleteDialogOpen={ui.setDeleteDialogOpen}
        conversationToDelete={ui.conversationToDelete}
        deleteConversation={() => deleteConversation(ui.conversationToDelete)}
        archiveConfirmOpen={ui.archiveConfirmOpen} setArchiveConfirmOpen={ui.setArchiveConfirmOpen}
        conversations={conversations} user={user}
        handleArchiveOldestConversation={handleArchiveOldestConversation}
        setPendingNewConversation={ui.setPendingNewConversation}
        limitReachedOpen={ui.limitReachedOpen} setLimitReachedOpen={ui.setLimitReachedOpen}
        isAuthenticated={isAuthenticated} getConversationLimits={getConversationLimits}
        showUpgradeModal={ui.showUpgradeModal} setShowUpgradeModal={ui.setShowUpgradeModal}
        tokenBalance={tokenBalance} getPlanLimits={getPlanLimits}
        showLoginGate={ui.showLoginGate} setShowLoginGate={ui.setShowLoginGate}
        onLoginGateClose={() => {
          ui.setShowLoginGate(false);
          if (briefStatus === 'confirmed' && !isTyping) {
            setBriefStatus(null);
            ui.setShowLoadingOverlay(false);
          }
        }}
        selectedConsultant={selectedConsultant} familyProfile={familyProfile}
        isDebugMode={isDebugMode} extractedEntitiesData={extractedEntitiesData}
        currentConversation={currentConversation}
        deepDiveAnalysis={deepDiveAnalysis} actionPlan={actionPlan}
        visitPrepKit={visitPrepKit} fitReEvaluation={fitReEvaluation}
        journeySteps={journeySteps} selectedSchool={selectedSchool}
        schoolsWithDeepDive={schoolsWithDeepDive} hydrationSource={hydrationSource}
      />

      <OverlayPanels
        showShortlistPanel={ui.showShortlistPanel} setShowShortlistPanel={ui.setShowShortlistPanel}
        shortlistData={shortlistData} handleToggleShortlist={handleToggleShortlist}
        familyProfile={familyProfile} schoolAnalyses={schoolAnalyses}
        artifactCache={artifactCache} selectedConsultant={selectedConsultant}
        handleSendMessage={handleSendMessage} isPremium={isPremium}
        handleDossierExpandChange={handleDossierExpandChange}
        handleDeepDiveFromDossier={handleDeepDiveFromDossier}
        pendingDeepDiveSchoolIds={pendingDeepDiveSchoolIds}
        handleViewSchoolDetail={handleViewSchoolDetail}
        schoolsWithDeepDive={schoolsWithDeepDive}
        showNotesPanel={ui.showNotesPanel} setShowNotesPanel={ui.setShowNotesPanel}
        userId={user?.id}
        tourRequestSchool={ui.tourRequestSchool} setTourRequestSchool={ui.setTourRequestSchool}
      />
    </div>
  );
}
