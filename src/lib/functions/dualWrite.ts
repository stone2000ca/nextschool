// Phase 1c: Dual-Write helpers
// Mirrors conversation_context JSONB data into normalized tables.
// All writes are fire-and-forget — failures are logged but never block the main flow.
// No read paths are changed; existing conversation_context writes remain untouched.

import { getAdminClient } from '@/lib/supabase/admin'

// ─── conversation_state upsert ──────────────────────────────────────
// Maps context fields → conversation_state columns

export function syncConversationState(
  conversationId: string,
  userId: string,
  context: Record<string, any>
) {
  if (!conversationId || !userId) return;

  const row: Record<string, any> = {
    conversation_id: conversationId,
    user_id: userId,
    state: context.state || 'WELCOME',
    resume_view: context.resumeView ?? null,
    brief_status: null,
    // Extracted family preferences (from accumulatedFamilyProfile or context)
    child_name: context.accumulatedFamilyProfile?.child_name ?? context.child_name ?? null,
    child_grade: context.accumulatedFamilyProfile?.child_grade ?? context.child_grade ?? null,
    location_area: context.accumulatedFamilyProfile?.location_area ?? context.location_area ?? null,
    region: context.accumulatedFamilyProfile?.region ?? context.region ?? null,
    max_tuition: context.accumulatedFamilyProfile?.max_tuition ?? context.max_tuition ?? null,
    priorities: context.accumulatedFamilyProfile?.priorities ?? context.priorities ?? [],
    learning_differences: context.accumulatedFamilyProfile?.learning_differences ?? context.learning_differences ?? [],
    // Location resolution
    resolved_lat: context.resolvedLat ?? null,
    resolved_lng: context.resolvedLng ?? null,
    // Deep dive tracking
    last_deep_dive_school_id: context.lastDeepDiveSchoolId ?? null,
    deep_dive_mode: context.deepDiveMode ?? null,
    selected_school_id: context.selectedSchoolId ?? null,
    previous_school_id: context.previousSchoolId ?? null,
    // Debrief mode
    debrief_school_id: context.debriefSchoolId ?? null,
    debrief_question_queue: context.debriefQuestionQueue ?? [],
    debrief_questions_asked: context.debriefQuestionsAsked ?? [],
    debrief_mode: context.debriefMode ?? null,
    // Counters & flags
    turn_count: context.turnCount ?? 0,
    brief_edit_count: context.briefEditCount ?? 0,
    tier1_completed_turn: context.tier1CompletedTurn ?? null,
    auto_refreshed: context.autoRefreshed ?? false,
    // Journey linkage
    journey_id: context.journeyId ?? null,
    family_journey_id: context.familyJourneyId ?? null,
    // Session linkage
    chat_session_id: context.chatSessionId ?? null,
    consultant: context.consultant ?? null,
  };

  const admin = getAdminClient();
  (admin
    .from('conversation_state') as any)
    .upsert(row, { onConflict: 'conversation_id' })
    .then(({ error }: any) => {
      if (error) console.error('[DUAL-WRITE] conversation_state upsert failed:', error.message);
      else console.log('[DUAL-WRITE] conversation_state synced for:', conversationId);
    })
    .catch((e: any) => console.error('[DUAL-WRITE] conversation_state exception:', e.message));
}

// ─── conversation_state read ────────────────────────────────────────
// Reads the normalized conversation_state row for a given conversation.
// Returns the row object or null if not found / on error.

export async function readConversationState(
  conversationId: string
): Promise<Record<string, any> | null> {
  if (!conversationId) return null;

  try {
    const admin = getAdminClient();
    const { data, error } = await (admin
      .from('conversation_state') as any)
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (error) {
      console.error('[DUAL-READ] conversation_state read failed:', error.message);
      return null;
    }
    return data ?? null;
  } catch (e: any) {
    console.error('[DUAL-READ] conversation_state exception:', e.message);
    return null;
  }
}

// ─── conversation_schools insert ────────────────────────────────────
// Inserts school references; marks previous results as non-current.

export function syncConversationSchools(
  conversationId: string,
  schools: Array<{ id: string; [key: string]: any }>,
  source: string = 'search'
) {
  if (!conversationId || !schools?.length) return;

  const admin = getAdminClient();

  // Mark previous results as non-current (fire-and-forget)
  (admin
    .from('conversation_schools') as any)
    .update({ is_current_results: false })
    .eq('conversation_id', conversationId)
    .eq('source', source)
    .then(({ error }: any) => {
      if (error) console.error('[DUAL-WRITE] conversation_schools clear-current failed:', error.message);
    })
    .catch(() => {});

  // Insert new school rows
  const rows = schools.map((school, idx) => ({
    conversation_id: conversationId,
    school_id: school.id,
    source,
    rank: idx + 1,
    is_current_results: true,
  }));

  (admin
    .from('conversation_schools') as any)
    .upsert(rows, { onConflict: 'conversation_id,school_id,source' })
    .then(({ error }: any) => {
      if (error) console.error('[DUAL-WRITE] conversation_schools upsert failed:', error.message);
      else console.log(`[DUAL-WRITE] conversation_schools synced ${rows.length} schools for:`, conversationId);
    })
    .catch((e: any) => console.error('[DUAL-WRITE] conversation_schools exception:', e.message));
}

// syncConversationArtifact removed — generated_artifacts eliminated,
// ConversationArtifacts is now the single source of truth for all artifacts.
