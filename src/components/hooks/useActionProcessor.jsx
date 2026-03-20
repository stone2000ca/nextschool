import { useEffect, useRef } from 'react';
import { School } from '@/lib/entities';
import { toast } from 'sonner';

export function useActionProcessor({
  messages, isTyping,
  shortlistData, removedSchoolIds,
  schools, extraSchools,
  handleToggleShortlist,
  setSelectedSchool, setCurrentView, setActivePanel,
  setPendingDeepDiveSchoolIds, setAutoExpandSchoolId,
  setTourRequestSchool,
  applyDistances, userLocation,
  schoolAnalyses,
}) {
  // E30-012: Prevent double-processing the same deep dive school
  const deepDiveAutoAddedRef = useRef(new Set());
  // E32-003: Prevent double-processing the same UI action
  const processedActionsRef = useRef(new Set());

  // E30-012 + E30-013: Auto-add to shortlist + auto-open panel after deep dive
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
          case 'SORT_SCHOOLS': {
            const sortBy = action.payload?.sortBy || 'distance';
            if (sortBy === 'distance' && userLocation) {
              applyDistances(userLocation, schools);
            }
            break;
          }
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
}
