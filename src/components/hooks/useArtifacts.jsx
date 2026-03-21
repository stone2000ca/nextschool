'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchConversationArtifacts } from '@/lib/api/entities-api';

/**
 * useArtifacts — Manages artifact state for a conversation + school.
 *
 * Reads from the conversation_artifacts table (dual-written by orchestrate/handleDeepDive)
 * instead of reverse-scanning messages. Replaces S4a-S4d rehydration useEffect blocks.
 *
 * @param {string|null} conversationId - Current conversation ID
 * @param {string|null} selectedSchoolId - Currently selected school ID
 * @returns Artifact state + setters + loading/refresh controls
 */
export function useArtifacts(conversationId, selectedSchoolId, schoolAnalysesFallback) {
  const [deepDiveAnalysis, setDeepDiveAnalysis] = useState(null);
  const [visitPrepKit, setVisitPrepKit] = useState(null);
  const [actionPlan, setActionPlan] = useState(null);
  const [fitReEvaluation, setFitReEvaluation] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [comparisonMatrix, setComparisonMatrix] = useState(null);
  const [hydrationSource, setHydrationSource] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Counter to force re-fetch on demand
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Track the previous school ID to detect switches
  const prevSchoolIdRef = useRef(selectedSchoolId);

  // FIX-DD-RESTORE: Helper to safely parse content that may be a JSON string or object
  const safeParse = (content) => {
    if (!content) return null;
    if (typeof content === 'object') return content;
    if (typeof content === 'string') {
      try { return JSON.parse(content); } catch { return null; }
    }
    return null;
  };

  // Artifact type → state setter mapping
  const ARTIFACT_MAP = {
    deep_dive_recommendation: (content) => {
      // FIX-DD-RESTORE: content may be plain text (AI message) or JSON string.
      // Only set deepDiveAnalysis if it's a valid structured object with fit_score.
      const parsed = safeParse(content);
      if (parsed && typeof parsed === 'object' && (parsed.fit_score !== undefined || parsed.fit_label)) {
        setDeepDiveAnalysis({ ...parsed, schoolId: selectedSchoolId });
      }
      // If content is plain text (not structured analysis), skip — don't set garbage data
    },
    visit_prep_kit: (content) => {
      const parsed = safeParse(content);
      setVisitPrepKit(parsed ? { ...parsed, schoolId: selectedSchoolId } : null);
    },
    action_plan: (content) =>
      setActionPlan(safeParse(content) || null),
    fit_reevaluation: (content) =>
      setFitReEvaluation(safeParse(content) || null),
  };

  // Fetch artifacts from conversation_artifacts table when conversation or school changes
  useEffect(() => {
    // On school switch, hydrate from schoolAnalyses cache if available, otherwise clear.
    // This preserves deep dive data restored by SessionRestorer (stored in schoolAnalyses).
    if (prevSchoolIdRef.current !== selectedSchoolId) {
      prevSchoolIdRef.current = selectedSchoolId;
      const cachedAnalysis = selectedSchoolId && schoolAnalysesFallback?.[selectedSchoolId];
      setDeepDiveAnalysis(cachedAnalysis ? { ...cachedAnalysis, schoolId: selectedSchoolId } : null);
      setVisitPrepKit(null);
      setActionPlan(null);
      setFitReEvaluation(null);
      setHydrationSource(cachedAnalysis ? 'HYDRATED_CACHE' : null);
    }

    if (!conversationId || !selectedSchoolId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchConversationArtifacts({
      conversation_id: conversationId,
      school_id: selectedSchoolId,
    })
      .then((artifacts) => {
        if (cancelled) return;

        if (!artifacts || artifacts.length === 0) {
          console.log('[useArtifacts] No artifacts found in DB for school:', selectedSchoolId);
          // Fall back to schoolAnalyses cache if DB is empty
          const cachedAnalysis = schoolAnalysesFallback?.[selectedSchoolId];
          if (cachedAnalysis) {
            setDeepDiveAnalysis({ ...cachedAnalysis, schoolId: selectedSchoolId });
            setHydrationSource('HYDRATED_CACHE');
          }
          return;
        }

        let deepDiveHydrated = false;
        for (const artifact of artifacts) {
          const setter = ARTIFACT_MAP[artifact.artifact_type];
          if (setter) {
            console.log(`[useArtifacts] Hydrating ${artifact.artifact_type} from DB`);
            setter(artifact.content);
            if (artifact.artifact_type === 'deep_dive_recommendation') {
              // Check if the setter actually produced valid data
              const parsed = safeParse(artifact.content);
              deepDiveHydrated = !!(parsed && typeof parsed === 'object' && (parsed.fit_score !== undefined || parsed.fit_label));
            }
          }
        }
        // If DB had artifacts but deep_dive_recommendation was invalid (plain text),
        // fall back to schoolAnalyses cache
        if (!deepDiveHydrated && schoolAnalysesFallback?.[selectedSchoolId]) {
          console.log('[useArtifacts] DB deep_dive invalid, falling back to schoolAnalyses cache');
          setDeepDiveAnalysis({ ...schoolAnalysesFallback[selectedSchoolId], schoolId: selectedSchoolId });
        }
        setHydrationSource('HYDRATED_DB');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useArtifacts] Failed to fetch artifacts:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, selectedSchoolId, fetchTrigger]);

  // Force re-fetch from DB
  const refreshArtifacts = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  // Clear all artifact state (used by resetChatState)
  const clearAll = useCallback(() => {
    setDeepDiveAnalysis(null);
    setVisitPrepKit(null);
    setActionPlan(null);
    setFitReEvaluation(null);
    setComparisonData(null);
    setComparisonMatrix(null);
    setHydrationSource(null);
  }, []);

  return {
    // Artifact values
    deepDiveAnalysis,
    visitPrepKit,
    actionPlan,
    fitReEvaluation,
    comparisonData,
    comparisonMatrix,
    hydrationSource,

    // Setters (needed by useMessageHandler, SessionRestorer, and imperative handlers)
    setDeepDiveAnalysis,
    setVisitPrepKit,
    setActionPlan,
    setFitReEvaluation,
    setComparisonData,
    setComparisonMatrix,
    setHydrationSource,

    // Controls
    isLoading,
    refreshArtifacts,
    clearAll,
  };
}
