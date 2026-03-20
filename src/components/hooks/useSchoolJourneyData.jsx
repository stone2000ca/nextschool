import { useState, useEffect, useMemo } from 'react';
import { FamilyJourney, SchoolJourney, SchoolInquiry } from '@/lib/entities';
import { fetchResearchNotes, createResearchNote, updateResearchNote } from '@/lib/api/entities-api';

export function useSchoolJourneyData({ selectedSchool, isAuthenticated, user, deepDiveAnalysis }) {
  const [schoolJourney, setSchoolJourney] = useState(null);
  const [researchNotes, setResearchNotes] = useState('');
  const [contactLog, setContactLog] = useState([]);

  // Journey Steps: fetch when selected school changes
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
    fetchResearchNotes({ school_id: selectedSchool.id }).then(results => {
      setResearchNotes(results[0]?.notes || '');
    }).catch(() => setResearchNotes(''));
  }, [selectedSchool?.id, isAuthenticated, user?.id]);

  const handleSaveNotes = async () => {
    if (!selectedSchool?.id || !user?.id) return;
    const existing = await fetchResearchNotes({ school_id: selectedSchool.id });
    if (existing.length > 0) {
      await updateResearchNote(existing[0].id, { notes: researchNotes, updated_at: new Date().toISOString() });
    } else {
      await createResearchNote({ school_id: selectedSchool.id, notes: researchNotes, updated_at: new Date().toISOString() });
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

  const resetJourneyData = () => {
    setSchoolJourney(null);
    setResearchNotes('');
    setContactLog([]);
  };

  return {
    schoolJourney,
    journeySteps,
    researchNotes, setResearchNotes,
    contactLog,
    handleSaveNotes,
    resetJourneyData,
  };
}
