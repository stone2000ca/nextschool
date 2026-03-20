import ShortlistPanel from '@/components/chat/ShortlistPanel';
import NotesPanel from '@/components/chat/NotesPanel';
import TourRequestModal from '@/components/schools/TourRequestModal';

export default function OverlayPanels({
  showShortlistPanel, setShowShortlistPanel,
  shortlistData, handleToggleShortlist, familyProfile,
  schoolAnalyses, artifactCache, selectedConsultant,
  handleSendMessage, isPremium,
  handleDossierExpandChange, handleDeepDiveFromDossier,
  pendingDeepDiveSchoolIds, handleViewSchoolDetail,
  schoolsWithDeepDive,
  showNotesPanel, setShowNotesPanel, userId,
  tourRequestSchool, setTourRequestSchool,
}) {
  return (
    <>
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
            userId={userId}
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
    </>
  );
}
