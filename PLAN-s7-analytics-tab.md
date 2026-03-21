# E54-S7: Analytics Tab & Cross-Section Hints — Investigation & Plan

## Current Portal State (`/schooladmin/:id`)

**Route:** `src/app/schooladmin/[id]/page.tsx` → `SchoolAdminDuo.jsx`

### Duo-Pane Layout (shipped S3–S6)

| Pane | Width | Content |
|------|-------|---------|
| Left | 65% | 3 tabs: Preview (placeholder), Key Facts (9 cards, S5), Analytics (placeholder) |
| Right | 35% | Agent chat mockup with sample messages (S6) |

**Key files:**
- `src/page-components/SchoolAdminDuo.jsx` — layout shell
- `src/components/school-admin/DuoLeftPane.jsx` — tab container (line 27–30: Analytics placeholder)
- `src/components/school-admin/DuoRightPane.jsx` — chat mockup
- `src/components/school-admin/KeyFactsTab.jsx` — 9-card editor
- `src/components/school-admin/Analytics.jsx` — **existing mock** (single-pane version, hardcoded data, behind Pro tier gate)

---

## Available Analytics Data Sources

### Fully Migrated Tables (ready to query)

| Table | Migration | School-Relevant Columns |
|-------|-----------|------------------------|
| `chat_shortlists` | 017 | `school_id`, `source` (manual/auto-match/restored), `added_at` |
| `school_journeys` | 017 | `school_id`, `status` (shortlisted/removed/touring/visited), `match_score`, `debrief_sentiment` |
| `family_journeys` | 017 | `current_phase`, `outcome`, `outcome_school_id` — enrollment outcomes |
| `visit_records` | 013 | `school_id`, `event_type`, `impression` (loved_it/mixed/not_for_us), `would_visit_again` |
| `event_reminders` | 011 | `event_id`, `school_name` — event interest signals |

### Referenced But Not Yet Migrated

| Table | Code Location | Notes |
|-------|---------------|-------|
| `session_events` | `trackSessionEvent.ts` | Could track profile views — needs migration |
| `visitor_logs` | `api/visitor-logs/route.ts` | Generic, needs schema |
| `search_logs` | `entities.ts` mapping only | No API routes or functions |

### Key Insight

`chat_shortlists` and `school_journeys` are the richest ready-to-use sources. Profile view tracking requires either a `session_events` migration or a new lightweight table.

---

## What the Analytics Tab Needs

A backend function `getSchoolAnalytics(schoolId)` returning:

1. **Shortlist saves** — `COUNT(*)` from `chat_shortlists` where `school_id` matches (+ 30-day time series)
2. **Journey funnel** — `school_journeys` grouped by `status` (shortlisted → touring → visited)
3. **Match score stats** — avg/median `match_score` from `school_journeys`
4. **Visit sentiment** — `visit_records` grouped by `impression` and `would_visit_again`
5. **Regional families** — province/city from `user_profiles` joined through `family_journeys` → `school_journeys`
6. **Profile views** — requires new tracking (migration needed)

---

## S7 Subtask Breakdown

### S7.1 — `getSchoolAnalytics` backend function
**Type:** Backend
**Files:** New `src/lib/functions/getSchoolAnalytics.ts`, new `src/app/api/school-analytics/route.ts`
**Work:**
- Query `chat_shortlists` for shortlist count + 30-day daily series
- Query `school_journeys` for status funnel + avg match score
- Query `visit_records` for sentiment breakdown
- Return tile-ready JSON aggregates
- Add route mapping in `lib/functions.ts` ROUTE_MAP

### S7.2 — Profile view tracking
**Type:** Backend + Migration
**Files:** New migration, update to school detail page
**Work:**
- Create `school_profile_views` table (school_id, viewer_user_id nullable, viewed_at, referrer)
- Or: add migration for `session_events` and fire event from `/school/[slug]` page
- Include count in `getSchoolAnalytics` response
- **Can run in parallel with S7.3**

### S7.3 — Analytics tile cards component
**Type:** Frontend
**Files:** New `src/components/school-admin/AnalyticsTiles.jsx`, edit `DuoLeftPane.jsx`
**Work:**
- Replace "Analytics coming soon" placeholder with tile grid
- 3–4 compact stat cards: profile views, shortlist saves, journey conversions, visit sentiment
- Responsive for duo-pane width (2-col grid, not 4-col like the existing mock)
- Fetch from `/api/school-analytics`
- **Depends on S7.1**

### S7.4 — Regional family data tile
**Type:** Frontend + Backend
**Files:** Extend `getSchoolAnalytics.ts`, extend `AnalyticsTiles.jsx`
**Work:**
- Join `school_journeys` → `family_journeys` → `user_profiles` for province/city
- Add a simple "Top Regions" list tile
- **Depends on S7.1**

### S7.5 — Agent analytics hints
**Type:** Frontend + Agent
**Files:** Update `schoolAgent.ts` or `DuoRightPane.jsx`
**Work:**
- Feed analytics summary into agent system prompt
- Agent generates contextual tips (e.g., "Shortlist saves dropped — consider updating tuition")
- Display as hint bubbles in chat pane or as a "tips" section
- **Depends on S7.1**

### S7.6 — Cross-section hints on Key Facts
**Type:** Frontend
**Files:** Update `KeyFactCard.jsx` or `KeyFactsTab.jsx`
**Work:**
- Show subtle inline hints on relevant cards (e.g., Tuition card: "23 families shortlisted — 60% searched 'financial aid'")
- Non-blocking, light touch
- **Depends on S7.1 + S7.3**

---

## Recommended Execution Order

```
S7.1 (backend) ──┬──→ S7.3 (tiles) ──→ S7.6 (cross-hints)
                  ├──→ S7.5 (agent hints)
                  └──→ S7.4 (regional)
S7.2 (tracking) ──────→ enriches S7.3 data
```

**Critical path:** S7.1 → S7.3 → S7.5

---

## Locked Files (Do Not Touch)

- `Dashboard.jsx` — locked by BOO
- `useMessageHandler.jsx` — locked by DEXTER
- `useSchoolJourneyData.jsx` — locked by DEXTER
