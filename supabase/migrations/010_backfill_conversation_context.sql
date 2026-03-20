-- Migration 010: Backfill existing conversations into normalized tables
-- Phase 1d: One-time backfill of conversation_state, conversation_schools,
-- and conversation_artifacts from conversations.conversation_context and messages JSONB.
-- Idempotent: uses ON CONFLICT DO NOTHING throughout.
-- Safe to re-run: existing rows are preserved.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Backfill conversation_state
-- ═══════════════════════════════════════════════════════════════════════
-- Mirrors dualWrite.ts syncConversationState field mapping:
--   accumulatedFamilyProfile → extractedEntities → top-level context fallbacks

INSERT INTO conversation_state (
  conversation_id,
  user_id,
  state,
  resume_view,
  brief_status,
  child_name,
  child_grade,
  location_area,
  region,
  max_tuition,
  priorities,
  learning_differences,
  resolved_lat,
  resolved_lng,
  last_deep_dive_school_id,
  deep_dive_mode,
  selected_school_id,
  previous_school_id,
  debrief_school_id,
  debrief_question_queue,
  debrief_questions_asked,
  debrief_mode,
  turn_count,
  brief_edit_count,
  tier1_completed_turn,
  auto_refreshed,
  journey_id,
  family_journey_id,
  chat_session_id,
  consultant,
  created_at,
  updated_at
)
SELECT
  c.id                                              AS conversation_id,
  c.user_id                                         AS user_id,
  COALESCE(ctx->>'state', 'WELCOME')                AS state,
  ctx->>'resumeView'                                AS resume_view,
  ctx->>'briefStatus'                               AS brief_status,

  -- Family preferences: accumulatedFamilyProfile → extractedEntities → top-level
  COALESCE(
    ctx->'accumulatedFamilyProfile'->>'child_name',
    ctx->'extractedEntities'->>'child_name',
    ctx->>'child_name'
  )                                                 AS child_name,

  COALESCE(
    (ctx->'accumulatedFamilyProfile'->>'child_grade')::INTEGER,
    (ctx->'extractedEntities'->>'child_grade')::INTEGER,
    (ctx->>'childGrade')::INTEGER
  )                                                 AS child_grade,

  COALESCE(
    ctx->'accumulatedFamilyProfile'->>'location_area',
    ctx->'extractedEntities'->>'location_area',
    ctx->>'location'
  )                                                 AS location_area,

  COALESCE(
    ctx->'accumulatedFamilyProfile'->>'region',
    ctx->'extractedEntities'->>'region',
    ctx->>'region'
  )                                                 AS region,

  COALESCE(
    (ctx->'accumulatedFamilyProfile'->>'max_tuition')::INTEGER,
    (ctx->'extractedEntities'->>'max_tuition')::INTEGER,
    (ctx->>'maxTuition')::INTEGER
  )                                                 AS max_tuition,

  -- priorities: JSONB array → TEXT[] (with type guard)
  COALESCE(
    (SELECT array_agg(p.elem)
     FROM jsonb_array_elements_text(
       CASE WHEN jsonb_typeof(COALESCE(
         ctx->'accumulatedFamilyProfile'->'priorities',
         ctx->'extractedEntities'->'priorities',
         ctx->'priorities'
       )) = 'array' THEN COALESCE(
         ctx->'accumulatedFamilyProfile'->'priorities',
         ctx->'extractedEntities'->'priorities',
         ctx->'priorities'
       ) END
     ) AS p(elem)),
    '{}'::TEXT[]
  )                                                 AS priorities,

  -- learning_differences: JSONB array → TEXT[] (with type guard)
  COALESCE(
    (SELECT array_agg(ld.elem)
     FROM jsonb_array_elements_text(
       CASE WHEN jsonb_typeof(COALESCE(
         ctx->'accumulatedFamilyProfile'->'learning_differences',
         ctx->'extractedEntities'->'learning_differences',
         ctx->'learningDifferences'
       )) = 'array' THEN COALESCE(
         ctx->'accumulatedFamilyProfile'->'learning_differences',
         ctx->'extractedEntities'->'learning_differences',
         ctx->'learningDifferences'
       ) END
     ) AS ld(elem)),
    '{}'::TEXT[]
  )                                                 AS learning_differences,

  -- Location resolution
  (ctx->>'resolvedLat')::DOUBLE PRECISION           AS resolved_lat,
  (ctx->>'resolvedLng')::DOUBLE PRECISION           AS resolved_lng,

  -- Deep dive tracking
  ctx->>'lastDeepDiveSchoolId'                      AS last_deep_dive_school_id,
  ctx->>'deepDiveMode'                              AS deep_dive_mode,
  ctx->>'selectedSchoolId'                          AS selected_school_id,
  ctx->>'previousSchoolId'                          AS previous_school_id,

  -- Debrief mode
  ctx->>'debriefSchoolId'                           AS debrief_school_id,

  COALESCE(
    (SELECT array_agg(dq.elem)
     FROM jsonb_array_elements_text(
       CASE WHEN jsonb_typeof(ctx->'debriefQuestionQueue') = 'array'
            THEN ctx->'debriefQuestionQueue' END
     ) AS dq(elem)),
    '{}'::TEXT[]
  )                                                 AS debrief_question_queue,

  COALESCE(
    (SELECT array_agg(da.elem)
     FROM jsonb_array_elements_text(
       CASE WHEN jsonb_typeof(ctx->'debriefQuestionsAsked') = 'array'
            THEN ctx->'debriefQuestionsAsked' END
     ) AS da(elem)),
    '{}'::TEXT[]
  )                                                 AS debrief_questions_asked,

  ctx->>'debriefMode'                               AS debrief_mode,

  -- Counters & flags
  COALESCE((ctx->>'turnCount')::INTEGER, 0)         AS turn_count,
  COALESCE((ctx->>'briefEditCount')::INTEGER, 0)    AS brief_edit_count,
  (ctx->>'tier1CompletedTurn')::INTEGER              AS tier1_completed_turn,
  COALESCE((ctx->>'autoRefreshed')::BOOLEAN, false)  AS auto_refreshed,

  -- Journey linkage
  COALESCE(ctx->>'journeyId', c.journey_id)         AS journey_id,
  ctx->>'familyJourneyId'                           AS family_journey_id,

  -- Session linkage
  ctx->>'chatSessionId'                             AS chat_session_id,
  ctx->>'consultant'                                AS consultant,

  -- Timestamps (inherit from conversation)
  c.created_at,
  c.updated_at

FROM conversations c
CROSS JOIN LATERAL (
  SELECT c.conversation_context AS ctx
) AS _ctx
WHERE c.conversation_context IS NOT NULL
  AND c.conversation_context != '{}'::JSONB
ON CONFLICT (conversation_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 2. Backfill conversation_schools
-- ═══════════════════════════════════════════════════════════════════════
-- Extracts school IDs from conversation_context.schools array.
-- Schools can be full objects (with .id) or bare ID strings.
-- Only inserts schools that exist in the schools table (UUID FK).

INSERT INTO conversation_schools (
  conversation_id,
  school_id,
  source,
  rank,
  is_current_results,
  added_at
)
SELECT
  c.id                                              AS conversation_id,
  s.id                                              AS school_id,
  'search'                                          AS source,
  elem.idx::INTEGER                                 AS rank,
  true                                              AS is_current_results,
  c.updated_at                                      AS added_at
FROM conversations c
CROSS JOIN LATERAL jsonb_array_elements(c.conversation_context->'schools')
  WITH ORDINALITY AS elem(val, idx)
-- Join to schools table to validate the FK and resolve UUID
INNER JOIN schools s ON s.id = (
  CASE
    -- Full school object: extract .id
    WHEN jsonb_typeof(elem.val) = 'object' THEN (elem.val->>'id')::UUID
    -- Bare string ID
    WHEN jsonb_typeof(elem.val) = 'string' THEN (trim('"' FROM elem.val::TEXT))::UUID
    ELSE NULL
  END
)
WHERE c.conversation_context IS NOT NULL
  AND c.conversation_context->'schools' IS NOT NULL
  AND jsonb_typeof(c.conversation_context->'schools') = 'array'
  AND jsonb_array_length(c.conversation_context->'schools') > 0
ON CONFLICT (conversation_id, school_id, source) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 3. Backfill conversation_artifacts
-- ═══════════════════════════════════════════════════════════════════════
-- Scans messages JSONB array for assistant messages containing artifact fields:
--   deepDiveAnalysis, visitPrepKit, actionPlan, fitReEvaluation
-- Each artifact has a schoolId embedded. Only inserts if the school exists.
-- When multiple messages have the same artifact for the same school,
-- keeps the latest (last in array = highest ordinality).

WITH artifact_rows AS (
  SELECT
    c.id                                            AS conversation_id,
    c.user_id                                       AS user_id,
    msg.val->'deepDiveAnalysis'                     AS dda,
    msg.val->'visitPrepKit'                         AS vpk,
    msg.val->'actionPlan'                           AS ap,
    msg.val->'fitReEvaluation'                      AS fre,
    -- schoolId can come from any of the artifact objects
    COALESCE(
      msg.val->'deepDiveAnalysis'->>'schoolId',
      msg.val->'visitPrepKit'->>'schoolId',
      msg.val->'actionPlan'->>'schoolId',
      msg.val->'fitReEvaluation'->>'schoolId'
    )                                               AS school_id_text,
    msg.ord                                         AS msg_ord,
    c.created_at                                    AS conv_created_at,
    c.updated_at                                    AS conv_updated_at
  FROM conversations c
  CROSS JOIN LATERAL jsonb_array_elements(c.messages)
    WITH ORDINALITY AS msg(val, ord)
  WHERE c.messages IS NOT NULL
    AND jsonb_typeof(c.messages) = 'array'
    AND jsonb_array_length(c.messages) > 0
    AND (
      msg.val ? 'deepDiveAnalysis'
      OR msg.val ? 'visitPrepKit'
      OR msg.val ? 'actionPlan'
      OR msg.val ? 'fitReEvaluation'
    )
),
-- Deduplicate: for each (conversation, school, artifact_type), keep the last message
unpivoted AS (
  -- deepDiveAnalysis
  SELECT DISTINCT ON (ar.conversation_id, ar.school_id_text)
    ar.conversation_id,
    ar.user_id,
    ar.school_id_text,
    'deep_dive_analysis'  AS artifact_type,
    ar.dda                AS content,
    ar.conv_created_at,
    ar.conv_updated_at
  FROM artifact_rows ar
  WHERE ar.dda IS NOT NULL
    AND jsonb_typeof(ar.dda) = 'object'
    AND ar.school_id_text IS NOT NULL
  ORDER BY ar.conversation_id, ar.school_id_text, ar.msg_ord DESC

  UNION ALL

  -- visitPrepKit
  SELECT DISTINCT ON (ar.conversation_id, ar.school_id_text)
    ar.conversation_id,
    ar.user_id,
    ar.school_id_text,
    'visit_prep_kit'      AS artifact_type,
    ar.vpk                AS content,
    ar.conv_created_at,
    ar.conv_updated_at
  FROM artifact_rows ar
  WHERE ar.vpk IS NOT NULL
    AND jsonb_typeof(ar.vpk) = 'object'
    AND ar.school_id_text IS NOT NULL
  ORDER BY ar.conversation_id, ar.school_id_text, ar.msg_ord DESC

  UNION ALL

  -- actionPlan
  SELECT DISTINCT ON (ar.conversation_id, ar.school_id_text)
    ar.conversation_id,
    ar.user_id,
    ar.school_id_text,
    'action_plan'         AS artifact_type,
    ar.ap                 AS content,
    ar.conv_created_at,
    ar.conv_updated_at
  FROM artifact_rows ar
  WHERE ar.ap IS NOT NULL
    AND jsonb_typeof(ar.ap) = 'object'
    AND ar.school_id_text IS NOT NULL
  ORDER BY ar.conversation_id, ar.school_id_text, ar.msg_ord DESC

  UNION ALL

  -- fitReEvaluation
  SELECT DISTINCT ON (ar.conversation_id, ar.school_id_text)
    ar.conversation_id,
    ar.user_id,
    ar.school_id_text,
    'fit_re_evaluation'   AS artifact_type,
    ar.fre                AS content,
    ar.conv_created_at,
    ar.conv_updated_at
  FROM artifact_rows ar
  WHERE ar.fre IS NOT NULL
    AND jsonb_typeof(ar.fre) = 'object'
    AND ar.school_id_text IS NOT NULL
  ORDER BY ar.conversation_id, ar.school_id_text, ar.msg_ord DESC
)
INSERT INTO conversation_artifacts (
  conversation_id,
  user_id,
  school_id,
  artifact_type,
  content,
  is_locked,
  version,
  created_at,
  updated_at
)
SELECT
  u.conversation_id,
  u.user_id,
  s.id                                              AS school_id,
  u.artifact_type,
  u.content,
  false                                             AS is_locked,
  'V1'                                              AS version,
  u.conv_created_at,
  u.conv_updated_at
FROM unpivoted u
-- Validate school FK exists
INNER JOIN schools s ON s.id = (u.school_id_text)::UUID
ON CONFLICT (conversation_id, school_id, artifact_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
-- 4. Log backfill counts
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _state_count BIGINT;
  _schools_count BIGINT;
  _artifacts_count BIGINT;
BEGIN
  SELECT count(*) INTO _state_count FROM conversation_state;
  SELECT count(*) INTO _schools_count FROM conversation_schools;
  SELECT count(*) INTO _artifacts_count FROM conversation_artifacts;

  RAISE NOTICE '[BACKFILL] conversation_state: % total rows', _state_count;
  RAISE NOTICE '[BACKFILL] conversation_schools: % total rows', _schools_count;
  RAISE NOTICE '[BACKFILL] conversation_artifacts: % total rows', _artifacts_count;
END;
$$;
