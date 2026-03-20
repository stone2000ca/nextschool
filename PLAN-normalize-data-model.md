# Phase 1 Investigation: Normalize `conversation_context` Data Model

## 1. Complete Map of `conversation_context` Fields

The `conversations` table has a `conversation_context` JSONB column that currently serves as an untyped session store. Below is the full field inventory with read/write locations.

### 1.1 State Machine Fields

| Field | Type | Purpose |
|-------|------|---------|
| `state` | `string` | Current state: `WELCOME`, `DISCOVERY`, `BRIEF`, `RESULTS`, `DEEP_DIVE` |
| `resumeView` | `string \| null` | View state to resume on session restore |
| `briefStatus` | `string \| null` | `'confirmed'`, `'generating'`, `'editing'`, or `null` |

**Read locations:**
- `src/components/hooks/useMessageHandler.jsx` — lines 200, 309, 332, 354-356
- `src/page-components/Consultant.jsx` — lines 302, 354-356, 377, 428, 462, 898
- `src/components/chat/SessionRestorer.jsx` — lines 228, 254-256, 274-275, 356-357
- `src/lib/functions/orchestrate.ts` — lines 1483, 1561, 1625, 1789-1793, 2026

**Write locations:**
- `src/components/hooks/useMessageHandler.jsx` — line 336 (updatedContext)
- `src/lib/functions/orchestrate.ts` — state machine transitions
- `src/components/chat/SessionRestorer.jsx` — lines 255, 275 (reconstruction)

### 1.2 Extracted Family Preferences

| Field | Type | Purpose |
|-------|------|---------|
| `extractedEntities` | `object` | Nested object with child_name, child_grade, location_area, max_tuition, priorities, learning_differences |
| `childGrade` | `number \| null` | Top-level duplicate of extractedEntities.child_grade |
| `location` | `string \| null` | Top-level duplicate of extractedEntities.location_area |
| `region` | `string \| null` | `'Canada'`, `'US'`, `'Europe'` |
| `priorities` | `string[]` | User's school priorities |

**Read locations:**
- `src/components/chat/SessionRestorer.jsx` — lines 206-208, 445-453
- `src/components/hooks/useSchoolFiltering.jsx` — line 46
- `src/lib/functions/orchestrate.ts` — lines 97, 142-143, 185-186 (nested fallback chains)
- `src/page-components/Consultant.jsx` — lines 904, 1113

**Write locations:**
- `src/lib/functions/summarizeConversation.ts` — lines 83-86 (LLM extraction → spread into context)
- `src/lib/functions/orchestrate.ts` — via response data merge

### 1.3 School Results

| Field | Type | Purpose |
|-------|------|---------|
| `schools` | `School[] \| string[]` | Full school objects or IDs from search |
| `lastMatchedSchools` | `School[]` | Previous search results for comparison |

**Read locations:**
- `src/page-components/Consultant.jsx` — lines 428-442, 567-588, 904
- `src/components/chat/SessionRestorer.jsx` — lines 256, 432-441
- `src/components/hooks/useSchoolFiltering.jsx` — receives as param

**Write locations:**
- `src/components/hooks/useMessageHandler.jsx` — line 338
- `src/lib/functions/orchestrate.ts` — lines 1789-1793, 2026
- `src/lib/functions/handleResults.ts` — writes school list

### 1.4 Location Resolution (T045)

| Field | Type | Purpose |
|-------|------|---------|
| `resolvedLat` | `number \| null` | Cached latitude for distance filtering |
| `resolvedLng` | `number \| null` | Cached longitude for distance filtering |

**Read:** `Consultant.jsx` lines 945-946
**Write:** `orchestrate.ts` lines 1792-1793

### 1.5 Deep Dive Tracking

| Field | Type | Purpose |
|-------|------|---------|
| `lastDeepDiveSchoolId` | `string \| null` | Active deep dive school |
| `deepDiveMode` | `string \| null` | From debrief completion |
| `selectedSchoolId` | `string \| null` | Currently selected school |

**Read/Write:** `SessionRestorer.jsx`, `useMessageHandler.jsx`, `orchestrate.ts`

### 1.6 Session Linkage

| Field | Type | Purpose |
|-------|------|---------|
| `chatSessionId` | `string \| null` | Links to chat_sessions table |
| `conversationId` | `string \| null` | Self-referential ID |

**Write:** `useMessageHandler.jsx` lines 451, 508, 513
**Read:** `useMessageHandler.jsx` line 473

### 1.7 UI State

| Field | Type | Purpose |
|-------|------|---------|
| `comparingSchools` | `string[]` | School names in comparison view (E11b) |
| `autoRefreshed` | `boolean \| null` | Triggers animation key increment (T047) |
| `consultant` | `string \| null` | Consultant persona name ('Jackie', 'Liam', etc.) |

**Write:** `Consultant.jsx` lines 1113-1115 (comparingSchools), `orchestrate.ts` line 1791 (autoRefreshed)
**Read:** `useMessageHandler.jsx` line 309 (autoRefreshed)

### 1.8 Debrief Mode (E13a)

| Field | Type | Purpose |
|-------|------|---------|
| `debriefSchoolId` | `string \| null` | School being debriefed |
| `debriefQuestionQueue` | `string[]` | Pending debrief questions |
| `debriefQuestionsAsked` | `string[]` | Already-asked debrief questions |
| `debriefMode` | `string \| null` | `'debrief'` or `'standard'` |

**Read/Write:** `orchestrate.ts`

### 1.9 Counters & Flags

| Field | Type | Purpose |
|-------|------|---------|
| `turnCount` | `number` | State machine turn counter |
| `briefEditCount` | `number` | Number of brief edits |
| `tier1CompletedTurn` | `number` | Turn when tier1 completed |
| `deepDiveFollowUpShown_<schoolId>` | `boolean` | Dynamic keys tracking per-school follow-up display |

**Read/Write:** `orchestrate.ts`

### 1.10 Journey Linkage

| Field | Type | Purpose |
|-------|------|---------|
| `journeyId` | `string \| null` | Reference to family_journeys.id |
| `journey` | `object \| null` | Cached journey object |
| `family_journey_id` | `string \| null` | Alternate key for journey |
| `previousSchoolId` | `string \| null` | Previously viewed school in deep dive |

**Read/Write:** `orchestrate.ts`, `SessionRestorer.jsx`

### 1.11 Nested Fallback (familyProfile)

| Field | Type | Purpose |
|-------|------|---------|
| `familyProfile` | `object` | Nested fallback with childGrade, maxTuition |

**Read:** `src/lib/functions/constants.ts` lines 97, 142-143, 185-186

### 1.12 Other `conversations` Table Columns (for reference)

The `conversations` table also has these non-context columns relevant to migration:

| Column | Type | Purpose |
|--------|------|---------|
| `messages` | JSONB | Array of message objects (artifacts embedded here too) |
| `long_term_summary` | TEXT | LLM-generated conversation summary |
| `short_term_context` | JSONB | Last ~8 key points from recent messages |
| `archived_messages` | JSONB | Old messages truncated from main array |
| `journey_id` | TEXT | FK to family_journeys (duplicated in context) |
| `is_active` | BOOLEAN | Active/archived flag |

---

## 2. Artifact Storage & Rehydration Patterns

### 2.1 How Artifacts Are Generated

Artifacts are generated in `src/lib/functions/handleDeepDive.ts`:
- **deepDiveAnalysis** — fit_label, fit_score, trade_offs, data_gaps, visit_questions, financial_summary, ai_insight, priority_matches, community_pulse
- **visitPrepKit** — visit preparation checklist
- **actionPlan** — next steps for the family
- **fitReEvaluation** — updated fit assessment after deep dive

### 2.2 Triple Storage Pattern (Current)

Artifacts are stored in **three places simultaneously**:

1. **Attached to message objects** (`useMessageHandler.jsx` lines 597-612):
   ```javascript
   const aiMessage = {
     role: 'assistant',
     content: aiMessageContent,
     deepDiveAnalysis: { ...response.data.deepDiveAnalysis, schoolId },
     visitPrepKit: { ...response.data.visitPrepKit, schoolId },
     actionPlan: { ...response.data.actionPlan, schoolId },
     fitReEvaluation: { ...response.data.fitReEvaluation, schoolId },
   };
   ```

2. **Persisted to `school_analyses` table** (`handleDeepDive.ts` lines 305-323):
   - Upserts by `(user_id, school_id)`
   - Stores denormalized analysis fields directly as columns

3. **Persisted to `generated_artifacts` table** (`handleDeepDive.ts` lines 363-379):
   - Upserts by `(user_id, school_id, artifact_type)`
   - Stores `content` as JSON string
   - Types: `deep_dive_recommendation`, `visit_prep_kit`, `action_plan`

### 2.3 Rehydration Patterns (S4a–S4d)

**S4a — Scan messages** (`SessionRestorer.jsx` lines 123-143):
- Iterates all messages looking for `msg.deepDiveAnalysis?.schoolId`
- Builds `allDeepDiveAnalyses` map keyed by schoolId

**S4b — Fallback to SchoolAnalysis entity** (`SessionRestorer.jsx` lines 145-196):
- If messages lack embedded analyses, queries `school_analyses` table
- Merges into `schoolAnalyses` state map

**S4c — Inject back into messages** (`SessionRestorer.jsx`):
- Re-attaches analysis data onto the last assistant message so S4a can find it on subsequent renders

**S4d — Restore schools from context** (`SessionRestorer.jsx` lines 256-267):
- Reads `conversation_context.schools` or parses `chat_sessions.matched_schools`
- Fetches full school records by ID from `schools` table

**WC6 — Runtime cache hydration** (`useDataLoader.jsx` + `useMessageHandler.jsx`):
- `loadPreviousArtifacts()` loads all `GeneratedArtifact` + `SchoolAnalysis` records for conversation
- Builds `artifactCache` keyed by `${schoolId}_${artifactType}`
- Used as fallback when API response lacks artifacts in DEEP_DIVE state

### 2.4 Schools Array in conversation_context

The `schools` array in `conversation_context` stores **full school objects** (not just IDs), which means:
- Large JSONB payload (each school record is ~50+ fields)
- Duplicates data already in the `schools` table
- Written on every state update via `useMessageHandler.jsx` line 338
- On restore, `SessionRestorer` re-fetches from DB anyway (S97-WC3 pattern)

---

## 3. Proposed Schema: 3 New Tables

### 3.1 `conversation_state`

Extracts the state machine and session metadata from JSONB into discrete, indexable columns.

```sql
-- Migration: Extract state machine fields from conversation_context JSONB
CREATE TABLE IF NOT EXISTS conversation_state (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- State machine
  state TEXT NOT NULL DEFAULT 'WELCOME',           -- WELCOME|DISCOVERY|BRIEF|RESULTS|DEEP_DIVE
  resume_view TEXT,
  brief_status TEXT,                               -- confirmed|generating|editing|null

  -- Extracted family preferences (denormalized for fast access)
  child_name TEXT,
  child_grade INTEGER,
  location_area TEXT,
  region TEXT,                                     -- Canada|US|Europe
  max_tuition INTEGER,
  priorities TEXT[] DEFAULT '{}',
  learning_differences TEXT[] DEFAULT '{}',

  -- Location resolution
  resolved_lat DOUBLE PRECISION,
  resolved_lng DOUBLE PRECISION,

  -- Deep dive tracking
  last_deep_dive_school_id TEXT,
  deep_dive_mode TEXT,
  selected_school_id TEXT,
  previous_school_id TEXT,

  -- Debrief mode (E13a)
  debrief_school_id TEXT,
  debrief_question_queue TEXT[] DEFAULT '{}',
  debrief_questions_asked TEXT[] DEFAULT '{}',
  debrief_mode TEXT,

  -- Counters & flags
  turn_count INTEGER DEFAULT 0,
  brief_edit_count INTEGER DEFAULT 0,
  tier1_completed_turn INTEGER,
  auto_refreshed BOOLEAN DEFAULT false,

  -- Journey linkage
  journey_id TEXT,
  family_journey_id TEXT,

  -- Session linkage
  chat_session_id TEXT,
  consultant TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(conversation_id)
);

CREATE INDEX idx_conversation_state_user ON conversation_state(user_id);
CREATE INDEX idx_conversation_state_conv ON conversation_state(conversation_id);
```

### 3.2 `conversation_schools`

Replaces the `schools` and `lastMatchedSchools` arrays with a join table.

```sql
-- Migration: Extract school references from conversation_context.schools array
CREATE TABLE IF NOT EXISTS conversation_schools (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'search',           -- search|shortlist|comparison
  rank INTEGER,                                     -- Position in results list
  is_current_results BOOLEAN DEFAULT true,          -- true = current, false = previous
  added_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(conversation_id, school_id, source)
);

CREATE INDEX idx_conversation_schools_conv ON conversation_schools(conversation_id);
CREATE INDEX idx_conversation_schools_school ON conversation_schools(school_id);
```

### 3.3 `conversation_artifacts`

Unifies the triple-storage pattern into a single source of truth per conversation+school+type.

```sql
-- Migration: Unified artifact storage per conversation
CREATE TABLE IF NOT EXISTS conversation_artifacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,

  artifact_type TEXT NOT NULL,                     -- deep_dive_analysis|visit_prep_kit|action_plan|fit_re_evaluation
  content JSONB NOT NULL DEFAULT '{}',             -- Structured artifact data
  is_locked BOOLEAN DEFAULT false,                 -- Premium gating
  version TEXT DEFAULT 'V1',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(conversation_id, school_id, artifact_type)
);

CREATE INDEX idx_conversation_artifacts_conv ON conversation_artifacts(conversation_id);
CREATE INDEX idx_conversation_artifacts_user ON conversation_artifacts(user_id);
CREATE INDEX idx_conversation_artifacts_school ON conversation_artifacts(school_id);
```

### RLS Policies (for all 3 tables)

```sql
-- Enable RLS
ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_artifacts ENABLE ROW LEVEL SECURITY;

-- User can read/write their own rows
CREATE POLICY "Users manage own conversation_state"
  ON conversation_state FOR ALL
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users manage own conversation_schools"
  ON conversation_schools FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()::TEXT
    )
  );

CREATE POLICY "Users manage own conversation_artifacts"
  ON conversation_artifacts FOR ALL
  USING (auth.uid()::TEXT = user_id);

-- Service role bypasses RLS automatically
```

---

## 4. All Files That Import/Use `conversation_context`

### Backend (lib/functions/)

| File | Usage |
|------|-------|
| `src/lib/functions/orchestrate.ts` | Primary orchestrator — reads context for state routing, writes updated context in response |
| `src/lib/functions/handleBrief.ts` | Reads context for brief generation parameters |
| `src/lib/functions/handleDeepDive.ts` | Reads context for deep dive; writes to school_analyses + generated_artifacts |
| `src/lib/functions/handleResults.ts` | Reads/writes context for school results and state |
| `src/lib/functions/summarizeConversation.ts` | Writes extractedPreferences into context |
| `src/lib/functions/constants.ts` | Reads nested context for fallback resolution (childGrade, maxTuition) |

### Frontend (components/hooks/)

| File | Usage |
|------|-------|
| `src/components/hooks/useMessageHandler.jsx` | Central hub — reads API response context, builds updatedContext, persists to ChatHistory |
| `src/components/hooks/useSchoolFiltering.jsx` | Reads extractedEntities for profile-based filtering |
| `src/components/hooks/useDataLoader.jsx` | Loads artifact cache from GeneratedArtifact + SchoolAnalysis entities |

### Frontend (components/chat/)

| File | Usage |
|------|-------|
| `src/components/chat/SessionRestorer.jsx` | Full context restoration from saved conversations (S4a-S4d + S97-WC3) |
| `src/components/chat/ConsultantDialogs.jsx` | Debug panel displays raw context |

### Frontend (page-components/)

| File | Usage |
|------|-------|
| `src/page-components/Consultant.jsx` | Main consumer — reads state/briefStatus/schools/location, writes comparingSchools |

### Data layer

| File | Usage |
|------|-------|
| `src/lib/entities.ts` | ChatHistory entity maps to conversations table (where context lives) |
| `src/lib/entities-server.ts` | Server-side equivalent |

**Total: 14 files directly reference conversation_context**

---

## 5. Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Dual-write period** | During migration, context must be written to both old JSONB and new tables | Use a feature flag; write to both, read from new; remove old reads last |
| **Session restore breakage** | `SessionRestorer.jsx` is the most complex consumer with multiple fallback chains | Migrate SessionRestorer last; keep old restore path as fallback |
| **Race conditions** | `useMessageHandler` does optimistic context updates that could conflict with new table writes | Use Supabase `upsert` with conflict resolution |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Performance regression** | Multiple table reads instead of single JSONB read | Use `Promise.all` for parallel fetches; add composite indexes |
| **Schools array size** | Full school objects in JSONB can be large; migration must handle existing data | Backfill script to extract school IDs from existing conversation_context |
| **Untyped JSONB** | No validation on existing data means migration must handle inconsistent shapes | Defensive parsing with fallback defaults |
| **Artifact triple-write** | Currently stored in messages, school_analyses, AND generated_artifacts | Phase out message embedding; consolidate to conversation_artifacts |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **RLS policy mismatch** | New tables need proper RLS policies | Copy patterns from existing conversations RLS |
| **Entity layer changes** | `entities.ts` needs new entity mappings | Additive change, no breaking modifications |

### Recommended Migration Order

1. **Phase 1a**: Create new tables (additive, zero risk)
2. **Phase 1b**: Add new entity mappings to `entities.ts` / `entities-server.ts` (additive)
3. **Phase 1c**: Dual-write — modify `useMessageHandler.jsx` and `orchestrate.ts` to write to both old JSONB and new tables
4. **Phase 1d**: Backfill existing conversations into new tables (one-time script)
5. **Phase 1e**: Switch reads — update `SessionRestorer.jsx`, `Consultant.jsx`, `useSchoolFiltering.jsx` to read from new tables
6. **Phase 1f**: Remove old writes — stop writing to conversation_context JSONB (keep column for rollback)
7. **Phase 1g**: Cleanup — remove conversation_context column after validation period

### Estimated Scope

- **14 files** need modification
- **3 new migration files** (tables + RLS + backfill)
- **2 new entity definitions** in entities.ts
- **~500-800 lines** of code changes across all files
- **Backfill script** for existing data
