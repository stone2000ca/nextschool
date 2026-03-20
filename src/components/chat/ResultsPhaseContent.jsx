import { useEffect } from 'react';
import ComparisonView from '@/components/schools/ComparisonView';
import SchoolDetailPanel from '@/components/schools/SchoolDetailPanel';
import SchoolGrid from '@/components/schools/SchoolGrid';
import SchoolWebsitePane from '@/components/schools/SchoolWebsitePane';
import ResearchNotepad from '@/components/ui/ResearchNotepad';
import { buildTiers } from '@/components/utils/tierEngine';
import { STATES } from '@/lib/stateMachineConfig';

export default function ResultsPhaseContent({
  leftPanelMode, comparisonData, setLeftPanelMode, setComparisonData,
  currentConversation, setCurrentConversation,
  currentView, selectedSchool,
  deepDiveAnalysis, actionPlan, visitPrepKit,
  familyProfile, comparisonMatrix, isPremium, setShowUpgradeModal,
  setSelectedSchool, setCurrentView,
  handleToggleShortlist, shortlistData,
  handleOpenComparison,
  handleSendMessage,
  currentState, schools, filteredSchools,
  schoolsAnimKey, priorityOverrides,
  handleViewSchoolDetail, handlePriorityToggle,
  handleNarrateComparison,
  isTyping, selectedConsultant,
  showDistances,
  visitedSchoolIds, extraSchools, loadMoreSchools,
  extraSchoolsLoading, extraSchoolsHasMore, extraSchoolsError,
  conversationContext, userLocation,
  journeySteps, contactLog, researchNotes, setResearchNotes, handleSaveNotes,
  messages, showSchoolGrid,
  detailTab, setDetailTab,
}) {
  // S3A: Reset detail tab when school changes; default to notepad if deep-dive exists
  useEffect(() => {
    setDetailTab(deepDiveAnalysis ? 'notepad' : 'overview');
  }, [selectedSchool?.id]);
  // E41-S8: Comparison renders inline
  if (leftPanelMode === 'comparison' && comparisonData) {
    return (
      <ComparisonView
        schools={comparisonData}
        familyProfile={familyProfile}
        comparisonMatrix={comparisonMatrix}
        isPremium={isPremium}
        onUpgrade={() => setShowUpgradeModal(true)}
        onBack={() => {
          setLeftPanelMode('grid');
          setComparisonData(null);
          const updatedContext = { ...(currentConversation?.conversation_context || {}) };
          delete updatedContext.comparingSchools;
          setCurrentConversation(prev => prev ? { ...prev, conversation_context: updatedContext } : prev);
        }}
      />
    );
  }

  if (currentView === 'detail' && selectedSchool) {
    // Build key dates from actionPlan
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

    // Find last deep dive timestamp
    const lastDeepDiveAt = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.deepDiveAnalysis?.schoolId === deepDiveAnalysis?.schoolId) {
          return messages[i]?.createdAt || messages[i]?.timestamp || new Date().toISOString();
        }
      }
      return null;
    })();

    return (
      <div className="h-full flex flex-col" style={{ background: '#141a1f' }}>
        {/* S3A: Tab navigation */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.08] shrink-0">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'notepad', label: 'Research Notepad', disabled: !deepDiveAnalysis },
            { key: 'website', label: 'Website' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && setDetailTab(tab.key)}
              disabled={tab.disabled}
              className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                detailTab === tab.key
                  ? 'bg-teal-600 text-white'
                  : tab.disabled
                    ? 'text-[#6b6560] cursor-not-allowed'
                    : 'text-[#b8b5af] hover:text-[#e8e6e1] hover:bg-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {detailTab === 'overview' && (
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
          )}

          {detailTab === 'notepad' && selectedSchool && deepDiveAnalysis && (
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
              chatSummary={deepDiveAnalysis.chat_summary || null}
              priorityMatches={deepDiveAnalysis.priority_matches || []}
              journeySteps={journeySteps}
              keyDates={keyDates}
              visitPrepKit={visitPrepKit}
              actionPlan={actionPlan}
              communityPulse={deepDiveAnalysis.community_pulse || null}
              financialSummary={deepDiveAnalysis.financial_summary || null}
              contactLog={contactLog}
              researchNotes={researchNotes}
              onNotesChange={setResearchNotes}
              onSaveNotes={handleSaveNotes}
              lastDeepDiveAt={lastDeepDiveAt}
              onRefreshDeepDive={() => {
                if (deepDiveAnalysis?.schoolId) {
                  const schoolName = deepDiveAnalysis?.schoolName || selectedSchool?.name || 'this school';
                  handleSendMessage(`Tell me about ${schoolName}`, deepDiveAnalysis.schoolId);
                }
              }}
            />
          )}

          {detailTab === 'website' && (
            <SchoolWebsitePane school={selectedSchool} />
          )}
        </div>
      </div>
    );
  }

  if ((currentState === STATES.RESULTS || currentView === 'schools') && schools.length === 0) {
    return (
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
              &bull; Increase your budget range
            </button>
            <button
              onClick={() => handleSendMessage("What schools are available in nearby areas?")}
              className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-medium transition-colors text-left"
            >
              &bull; Search in nearby cities
            </button>
            <button
              onClick={() => handleSendMessage("Show me schools without my priority filters")}
              className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-medium transition-colors text-left"
            >
              &bull; Relax your priority filters
            </button>
            <button
              onClick={() => handleSendMessage("What grade levels are available?")}
              className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-medium transition-colors text-left"
            >
              &bull; Adjust grade level
            </button>
          </div>
        </div>
      </div>
    );
  }

  if ((currentState === STATES.RESULTS || showSchoolGrid) && schools.length > 0) {
    return (
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
    );
  }

  return null;
}
