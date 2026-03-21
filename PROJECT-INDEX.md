# PROJECT INDEX — NextSchool

PURPOSE: Minimal orientation doc. Every agent reads ONLY this at session start. Never expand — add detail to L1–L5.
Last Updated: March 21, 2026 | E51-S4 complete (email queue + preferences/unsubscribe). E51-S1/S2A/S3/S4 all merged. E50 sprints in progress.

## PLATFORM

Next.js 14 (App Router) | React frontend | Next.js API Routes (src/app/api/) backend
LLM: OpenAI (direct API — callOpenRouter REMOVED)
Hosting: Vercel | DB: Supabase (PostgreSQL + RLS) | Auth: Supabase Auth
Stripe payments | Google Maps API
Analytics: GTM (GTM-NVZZNTX3) + GA4 (G-8QBPQ74KPK)
Domain: nextschool.ca (Vercel — IONOS/Base44 retired)

## MIGRATION STATUS

Migrated FROM: Base44 app builder + Base44 cloud functions
Migrated TO: Next.js + Supabase + Vercel
Auth pages: BUILT — /login (Login.jsx) and /signup (Signup.jsx) exist in src/page-components/ and routed via src/app/login/ and src/app/signup/
Auth callback: src/app/auth/callback/ and src/app/auth/confirm/ exist
Middleware: src/middleware.ts — session refresh active; confirm route protection status (E43-103)
AuthContext: src/lib/AuthContext.tsx — ACTIVE (Supabase Auth, useAuth hook: login, signup, logout, updateMe, refreshUser, navigateToLogin). Not dead — do not delete.
Orphan audit still needed: index.html (root level), src/lib/PageNotFound.jsx
Active epic: E43 — Auth system build + full app restoration testing

## ENTITY TREE

```
user (account)
├── user_memory[] (persistent cross-session context)
├── shortlist_view (derived — aggregates chat_shortlist across chats)
├── school_analysis[] (per-school analysis records, user-scoped)
├── school_admin[] (admin access to claimed schools)
├── school_claim[] (claim requests by this user)
├── dispute_request[] (ownership disputes)
├── token_transaction[] (payment/token history)
└── chats
    └── chat_history (messages[], conversation_context)
        ├── chat_session (thin routing: session_token, FKs, status, consultant)
        ├── session_event[] (analytics per session)
        ├── family_profile (brief snapshot)
        ├── family_journey (1:1, linked by chat_history_id)
        │   ├── school_journey[] (per-school progression)
        │   │   ├── deep_dive_analysis
        │   │   ├── visit_prep_kit
        │   │   ├── fit_re_evaluation
        │   │   ├── school_dossier
        │   │   ├── stage
        │   │   └── research_note[] (per-school user notes)
        │   ├── chat_shortlist[] (per-chat shortlist)
        │   └── ai_narrative
        └── generated_artifact[] (keyed by conversation_id + school_id + artifact_type)

global (no user owner)
├── school (directory)
│   ├── school_event[]
│   ├── school_inquiry[]
│   ├── testimonial[]
│   ├── photo_candidate[]
│   └── enrichment_diff[]
├── blog
├── email_log
└── beta_feedback
```

## PAGES

All page logic lives in src/page-components/. Routed via src/app/[route]/page.tsx.

| Page | File | Route |
|---|---|---|
| Home | Home.jsx | / |
| Consultant (main chat) | Consultant.jsx | /consultant |
| School Directory | SchoolDirectory.jsx | /schools |
| School Profile | SchoolProfile.jsx | /school/[id] |
| Dashboard | Dashboard.jsx | /dashboard |
| School Admin | SchoolAdmin.jsx | /school-admin |
| Portal | Portal.jsx | /portal |
| Submit School | SubmitSchool.jsx | /submit-school |
| Claim School | ClaimSchool.jsx | /claim-school |
| Admin | Admin.jsx | /admin |
| Pricing | Pricing.jsx | /pricing |
| Blog | BlogPost.jsx | /blog |
| Guides | Guides.jsx | /guides |
| How It Works | HowItWorks.jsx | /how-it-works |
| For Schools | ForSchools.jsx | /for-schools |
| About | About.jsx | /about |
| Contact | Contact.jsx | /contact |
| Privacy | Privacy.jsx | /privacy |
| Terms | Terms.jsx | /terms |
| Login | Login.jsx | /login |
| Signup | Signup.jsx | /signup |
| Feedback | Feedback.jsx | /feedback |
| Shared Profile | SharedProfile.jsx | /shared/[id] |
| Shared Shortlist | SharedShortlistView.jsx | /shared/shortlist/[id] |

## BACKEND FUNCTIONS

All functions live in src/lib/functions/ and are called via src/app/api/*/route.ts.

**Orchestration**
- orchestrate.ts (110KB) — main pipeline: classifyIntent, extractEntities, handleBrief, handleResults, handleDeepDive, handleVisitDebrief, handleJourneyOutcome

**Search / Match**
- searchSchools.ts, getNearbySchools.ts, matchSchoolsForProfile.ts

**Artifacts**
- generateComparison.ts, generateMatchExplanations.ts, generateDecisionNarration.ts, generateProfileNarrative.ts, generateSchoolSummary.ts, generateConversationTitle.ts, generateSharedShortlistLink.ts

**Conversation**
- summarizeConversation.ts, summarizeConversationMessages.ts

**Infra**
- trackSessionEvent.ts, updateUserMemory.ts, processTokenTransaction.ts, sendClaimEmail.ts, calculateCompletenessScore.ts, enrichSchoolFromWeb.ts, scrapeSchoolPhotos.ts, updateSchoolPhotos.ts, geocodeSchools.ts, calculateDistance.ts

**Payments**
- createCheckoutSession.ts, handleStripeWebhook.ts

**User**
- onboardUser.ts, updateUserMemory.ts

**Admin / Claims**
- adminClaims.ts, adminStats.ts, approveClaim.ts, rejectClaim.ts, verifyClaimCode.ts, bulkImportSchools.ts, exportSchools.ts, importEnrichedSchools.ts, exportShortlist.ts, fetchSchoolProfile.ts

Removed: callOpenRouter — direct OpenAI calls in orchestrate.ts

## FRONTEND STRUCTURE

Auth: src/lib/AuthContext.tsx (Supabase Auth — useAuth hook)

**Hooks (src/components/hooks/):**
- useMessageHandler.jsx (36KB — critical)
- useDataLoader.jsx
- useShortlist.jsx
- useSchoolFiltering.jsx
- useUserLocation.jsx
- use-mobile.jsx

**Page Components (src/page-components/):** See PAGES table above

**Component Subdirectories (src/components/):**
- chat/ | schools/ | dashboard/ | admin/ | school-admin/ | claim/ | dialogs/ | navigation/ | ui/ | utils/

State Machine: src/lib/stateMachineConfig.jsx
Supabase client: src/lib/supabase/
Integrations: src/lib/integrations.ts
AuthGate: Status unconfirmed — verify if implemented in E43-104

## CONVERSATION FLOW

WELCOME → DISCOVERY → BRIEF → RESULTS → DEEPDIVE
Data-driven transitions via resolveTransition (8 rules, 8 intentSignals)
Sufficiency tiers: RICH / MINIMUM / THIN | Max 3 Brief edits | Hard cap turn 7
RESULTS + DEEPDIVE emit structured UI actions (ADD_TO_SHORTLIST, OPEN_PANEL, EXPAND_SCHOOL, INITIATE_TOUR)

## CRITICAL FILES

Changes to any of these require full regression:
- src/lib/functions/orchestrate.ts
- src/page-components/Consultant.jsx
- src/components/hooks/useMessageHandler.jsx
- src/middleware.ts

## DEBUGGING

DebugPanel: ?debug=true on Consultant URL — 3 tabs: State Inspector, Entity Viewer, LLM Log
Smoke tests: CF-01 (fresh load), CF-03 (RESULTS), CF-05 (DEEPDIVE)
DebugPanel functionality unverified post-migration — include in E43-205 regression

## ARCHITECTURE LAYERS

(load when needed — never load all at once)
- L1: Entity Schemas — full field definitions
- L2: Backend Functions — signatures + logic
- L3: Frontend Components — component list + props
- L4: State Machine — resolveTransition rules + pipeline
- L5: History & Decisions — sprint notes, deprecated items
