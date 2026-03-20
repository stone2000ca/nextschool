import FamilyBrief from '@/components/chat/FamilyBrief';
import AddSchoolPanel from '@/components/chat/AddSchoolPanel';
import ShortlistPanel from '@/components/chat/ShortlistPanel';
import TimelinePanel from '@/components/chat/TimelinePanel';

export default function SlidingPanels({
  activePanel,
  familyProfile, selectedConsultant, extractedEntitiesData,
  setActivePanel,
  handleToggleShortlist, shortlistData,
  schoolAnalyses, artifactCache,
  handleSendMessage, isPremium,
  handleDossierExpandChange, handleDeepDiveFromDossier,
  pendingDeepDiveSchoolIds, handleViewSchoolDetail,
  autoExpandSchoolId, setAutoExpandSchoolId,
  schoolsWithDeepDive,
}) {
  return (
    <>
      {activePanel === 'brief' && (
        <div
          className="flex-shrink-0 h-full overflow-hidden"
          style={{ width: 320, animation: 'slideInFromRight 200ms ease-out' }}
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
    </>
  );
}
