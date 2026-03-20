# Audit: Remaining Direct Entity Imports (Phase 2)

**Date:** 2026-03-20
**Branch:** `claude/audit-entity-imports-phase-2-wXoaS`
**Already shipped:** Conversation API (PR #138), Shortlist API (PR #139)

---

## Summary

**47 files** import from `@/lib/entities` and call entity methods directly from the client side. These span **22 distinct entity types** and use 6 method types (`.filter()`, `.list()`, `.get()`, `.create()`, `.update()`, `.delete()`).

---

## 1. Complete File Inventory

### Page Components (11 files)

| File | Entities | Methods |
|------|----------|---------|
| `page-components/Portal.jsx` | School | list |
| `page-components/Consultant.jsx` | School, SchoolJourney, FamilyJourney, ResearchNote, SchoolInquiry | filter, update, create |
| `page-components/Home.jsx` | School | filter |
| `page-components/SharedProfile.jsx` | School, User | filter |
| `page-components/ClaimSchool.jsx` | School, SchoolClaim, SchoolAdmin, User | filter, create, update |
| `page-components/Feedback.jsx` | BetaFeedback | create |
| `page-components/SchoolAdmin.jsx` | School, SchoolAdmin, SchoolClaim, User, SchoolInquiry, EnrichmentDiff, PhotoCandidate | filter, update |
| `page-components/AdminFeedback.jsx` | BetaFeedback | list |
| `page-components/SchoolProfile.jsx` | School, Testimonial, SchoolEvent | filter |
| `page-components/SubmitSchool.jsx` | School, SchoolClaim | list, create |
| `page-components/SchoolDirectory.jsx` | SchoolEvent, VisitorLog | filter, create |

### Hooks (4 files)

| File | Entities | Methods |
|------|----------|---------|
| `components/hooks/useMessageHandler.jsx` | FamilyJourney, User | filter, create, update |
| `components/hooks/useDataLoader.jsx` | GeneratedArtifact, SchoolAnalysis, FamilyProfile, FamilyJourney, SchoolJourney | filter, update |
| `components/hooks/useArtifacts.jsx` | ConversationArtifacts | filter |
| `components/hooks/useConversationState.jsx` | ConversationState, School | filter |

### Chat Components (6 files)

| File | Entities | Methods |
|------|----------|---------|
| `components/chat/SessionRestorer.jsx` | SchoolAnalysis, FamilyProfile, School | filter, get |
| `components/chat/ChatPanel.jsx` | School | filter |
| `components/chat/AddSchoolPanel.jsx` | School | filter |
| `components/chat/TimelinePanel.jsx` | SchoolEvent | filter |
| `components/chat/handleNarrateComparison.jsx` | GeneratedArtifact | create |
| `components/chat/NotesPanel.jsx` | Notes, UserMemory, FamilyProfile | filter, create, delete, update |

### School Components (6 files)

| File | Entities | Methods |
|------|----------|---------|
| `components/schools/TourRequestModal.jsx` | TourRequest, SchoolInquiry, FamilyProfile, FamilyJourney, SchoolJourney | filter, create, update |
| `components/schools/SchoolDetailPanel.jsx` | SchoolEvent | filter |
| `components/schools/ApplicationTimeline.jsx` | SchoolEvent | filter |
| `components/schools/SchoolGrid.jsx` | SchoolEvent | filter |
| `components/schools/SchoolDetail.jsx` | SchoolEvent | filter |
| `components/schools/ContactSchoolModal.jsx` | SchoolInquiry | create |

### Admin Components (5 files)

| File | Entities | Methods |
|------|----------|---------|
| `components/admin/AdminSubmissions.jsx` | SchoolClaim, School, SchoolAdmin | filter, update, create |
| `components/admin/AdminAnalytics.jsx` | User, TokenTransaction | list |
| `components/admin/AdminUsers.jsx` | User | list, update |
| `components/admin/AdminDisputes.jsx` | DisputeRequest, School, SchoolAdmin, User | filter, update, create |
| `components/admin/AdminSchools.jsx` | School | list, update |

### School-Admin Components (10 files)

| File | Entities | Methods |
|------|----------|---------|
| `components/school-admin/ProfileEditor.jsx` | Testimonial | filter |
| `components/school-admin/EventsSection.jsx` | SchoolEvent | filter, update, create, delete |
| `components/school-admin/PhotoReviewSection.jsx` | PhotoCandidate, School | filter, update |
| `components/school-admin/TestimonialsSection.jsx` | Testimonial | filter, delete, update, create |
| `components/school-admin/EnrichmentReviewSection.jsx` | EnrichmentDiff, School | filter, update |
| `components/school-admin/PhotosMediaSection.jsx` | School | update |
| `components/school-admin/AdmissionsSection.jsx` | School | update |
| `components/school-admin/AccountSection.jsx` | SchoolAdmin | filter |
| `components/school-admin/CSVUpload.jsx` | School | update |
| `components/school-admin/EditProfileForm.jsx` | School | update |
| `components/school-admin/Inquiries.jsx` | SchoolInquiry | filter, update |

### Utility & Navigation (4 files)

| File | Entities | Methods |
|------|----------|---------|
| `components/utils/memoryManager.jsx` | UserMemory | filter, update, create |
| `components/utils/sendSchoolEmail.jsx` | EmailLog | create |
| `components/utils/DebugPanel.jsx` | EmailLog, LLMLog | filter, list |
| `components/navigation/Navbar.jsx` | SchoolAdmin | filter |

### Claim Components (1 file)

| File | Entities | Methods |
|------|----------|---------|
| `components/claim/DisputeForm.jsx` | DisputeRequest | create |

---

## 2. Grouped by API Domain

### A. Schools API (HIGH — 35+ calls, 15+ files)

**Entity:** School
**Methods:** filter, list, create, update
**Files:**
- `page-components/Portal.jsx` — list all schools
- `page-components/Home.jsx` — filter featured schools
- `page-components/SharedProfile.jsx` — filter by IDs
- `page-components/ClaimSchool.jsx` — search by name, filter by ID
- `page-components/SchoolAdmin.jsx` — filter by ID, by admin_user_id, update
- `page-components/SchoolProfile.jsx` — filter by slug, by ID, by city
- `page-components/SubmitSchool.jsx` — list, create
- `components/chat/SessionRestorer.jsx` — filter by IDs
- `components/chat/ChatPanel.jsx` — filter by slug/name
- `components/chat/AddSchoolPanel.jsx` — search by name
- `components/hooks/useConversationState.jsx` — filter by IDs
- `components/admin/AdminSubmissions.jsx` — filter, update
- `components/admin/AdminSchools.jsx` — list, update
- `components/school-admin/EnrichmentReviewSection.jsx` — update
- `components/school-admin/PhotosMediaSection.jsx` — update (photos/logo)
- `components/school-admin/AdmissionsSection.jsx` — update
- `components/school-admin/CSVUpload.jsx` — update
- `components/school-admin/EditProfileForm.jsx` — update
- `components/school-admin/PhotoReviewSection.jsx` — update

**Proposed routes:**
- `GET /api/schools` — list/filter (query params: slug, city, ids, search, featured)
- `GET /api/schools/[id]` — get single school
- `PUT /api/schools/[id]` — update school (auth: school-admin or admin)
- `POST /api/schools` — create school (submit flow)

**Hooks to create/rewire:** `useSchool(id)`, `useSchools(filter)`, `useSchoolUpdate()`

---

### B. School Events API (12+ calls, 7 files)

**Entity:** SchoolEvent
**Methods:** filter, create, update, delete
**Files:**
- `page-components/SchoolProfile.jsx` — upcoming events for a school
- `page-components/SchoolDirectory.jsx` — filter events
- `components/schools/SchoolDetailPanel.jsx` — events by school_id
- `components/schools/ApplicationTimeline.jsx` — active events by school_id
- `components/schools/SchoolGrid.jsx` — all active events
- `components/schools/SchoolDetail.jsx` — active events by school_id
- `components/chat/TimelinePanel.jsx` — active events by school_id
- `components/school-admin/EventsSection.jsx` — CRUD (filter, create, update, delete)

**Proposed routes:**
- `GET /api/school-events?school_id=X` — list events for a school
- `POST /api/school-events` — create event (auth: school-admin)
- `PUT /api/school-events/[id]` — update event
- `DELETE /api/school-events/[id]` — delete event

**Hooks:** `useSchoolEvents(schoolId)`, `useSchoolEventMutations()`

---

### C. Family Journey API (9+ calls, 4 files)

**Entities:** FamilyJourney, SchoolJourney
**Methods:** filter, create, update
**Files:**
- `page-components/Consultant.jsx` — filter user journeys, school journeys
- `components/hooks/useMessageHandler.jsx` — filter, create family journey
- `components/hooks/useDataLoader.jsx` — filter journeys, update, filter school journeys
- `components/schools/TourRequestModal.jsx` — filter/create/update both journey types

**Proposed routes:**
- `GET /api/family-journeys` — list user's journeys
- `POST /api/family-journeys` — create journey
- `PUT /api/family-journeys/[id]` — update journey
- `GET /api/school-journeys?family_journey_id=X` — list school journeys
- `POST /api/school-journeys` — create school journey
- `PUT /api/school-journeys/[id]` — update school journey

**Hooks:** `useFamilyJourneys()`, `useSchoolJourneys(journeyId)`, journey mutation hooks

---

### D. Family Profile API (9+ calls, 4 files)

**Entity:** FamilyProfile
**Methods:** filter, get, delete
**Files:**
- `components/chat/SessionRestorer.jsx` — get by ID
- `components/chat/NotesPanel.jsx` — filter by user, delete
- `components/hooks/useDataLoader.jsx` — filter by user + conversation
- `components/schools/TourRequestModal.jsx` — filter by user

**Proposed routes:**
- `GET /api/family-profiles` — get current user's profile
- `GET /api/family-profiles/[id]` — get by ID
- `DELETE /api/family-profiles/[id]` — delete profile

**Hooks:** `useFamilyProfile()`

---

### E. School Claims API (10+ calls, 3 files)

**Entities:** SchoolClaim, SchoolAdmin
**Methods:** filter, create, update
**Files:**
- `page-components/ClaimSchool.jsx` — filter claims, create, cancel
- `page-components/SchoolAdmin.jsx` — filter claims for verification
- `components/admin/AdminSubmissions.jsx` — filter pending, approve/reject (update + SchoolAdmin.create)

**Proposed routes:**
- `GET /api/school-claims` — list user's claims
- `POST /api/school-claims` — create claim
- `PUT /api/school-claims/[id]` — update claim status
- `POST /api/school-claims/[id]/approve` — admin approve (creates SchoolAdmin)

**Hooks:** `useSchoolClaims()`, `useClaimMutations()`

---

### F. School Inquiries API (10+ calls, 5 files)

**Entity:** SchoolInquiry
**Methods:** filter, create, update
**Files:**
- `page-components/Consultant.jsx` — filter by school_id
- `page-components/SchoolAdmin.jsx` — filter tour requests
- `components/schools/TourRequestModal.jsx` — create
- `components/schools/ContactSchoolModal.jsx` — create
- `components/school-admin/Inquiries.jsx` — filter, update (respond, close, tour_status)

**Proposed routes:**
- `GET /api/school-inquiries?school_id=X` — list inquiries
- `POST /api/school-inquiries` — create inquiry
- `PUT /api/school-inquiries/[id]` — update (respond, close, tour status)

**Hooks:** `useSchoolInquiries(schoolId)`, `useInquiryMutations()`

---

### G. Testimonials API (8+ calls, 3 files)

**Entity:** Testimonial
**Methods:** filter, create, update, delete
**Files:**
- `page-components/SchoolProfile.jsx` — filter visible testimonials
- `components/school-admin/ProfileEditor.jsx` — filter by school
- `components/school-admin/TestimonialsSection.jsx` — full CRUD

**Proposed routes:**
- `GET /api/testimonials?school_id=X` — list testimonials
- `POST /api/testimonials` — create (auth: school-admin)
- `PUT /api/testimonials/[id]` — update
- `DELETE /api/testimonials/[id]` — delete

**Hooks:** `useTestimonials(schoolId)`, `useTestimonialMutations()`

---

### H. Artifacts API (3+ calls, 3 files)

**Entities:** GeneratedArtifact, ConversationArtifacts
**Methods:** filter, create
**Files:**
- `components/hooks/useDataLoader.jsx` — filter by conversation_id
- `components/hooks/useArtifacts.jsx` — filter by conversation + school
- `components/chat/handleNarrateComparison.jsx` — create

**Proposed routes:**
- `GET /api/artifacts?conversation_id=X&school_id=Y` — list artifacts
- `POST /api/artifacts` — create artifact

**Hooks:** `useArtifacts(conversationId, schoolId)` (rewire existing)

---

### I. Notes & Memory API (12+ calls, 2 files)

**Entities:** Notes, UserMemory
**Methods:** filter, create, update, delete
**Files:**
- `components/chat/NotesPanel.jsx` — full CRUD for Notes + UserMemory delete
- `components/utils/memoryManager.jsx` — UserMemory filter, create, update

**Proposed routes:**
- `GET /api/notes` — list user's notes
- `POST /api/notes` — create note
- `PUT /api/notes/[id]` — update note
- `DELETE /api/notes/[id]` — delete note
- `GET /api/user-memory` — get user memory
- `PUT /api/user-memory` — upsert user memory
- `DELETE /api/user-memory` — clear user memory

**Hooks:** `useNotes()`, `useUserMemory()`

Note: `/api/update-user-memory` already exists — may be reusable.

---

### J. Admin Users API (10+ calls, 4 files)

**Entities:** User, TokenTransaction
**Methods:** filter, list, update
**Files:**
- `page-components/SharedProfile.jsx` — filter user by ID
- `components/admin/AdminAnalytics.jsx` — list users, list transactions
- `components/admin/AdminUsers.jsx` — list, update users
- `components/admin/AdminDisputes.jsx` — filter users by ID/email

**Proposed routes:**
- `GET /api/admin/users` — list all users (admin only)
- `PUT /api/admin/users/[id]` — update user (admin only)
- `GET /api/admin/analytics` — aggregated user + transaction data

Note: `User.update()` in `useMessageHandler.jsx` (token_balance) should move server-side.

---

### K. Disputes API (5+ calls, 2 files)

**Entity:** DisputeRequest
**Methods:** filter, create, update
**Files:**
- `components/claim/DisputeForm.jsx` — create
- `components/admin/AdminDisputes.jsx` — filter pending, approve/reject

**Proposed routes:**
- `POST /api/disputes` — create dispute
- `GET /api/admin/disputes` — list pending (admin only)
- `PUT /api/admin/disputes/[id]` — resolve dispute (admin only)

---

### L. Enrichment & Photos API (11+ calls, 3 files)

**Entities:** EnrichmentDiff, PhotoCandidate
**Methods:** filter, update
**Files:**
- `page-components/SchoolAdmin.jsx` — filter pending diffs and candidates
- `components/school-admin/EnrichmentReviewSection.jsx` — filter, update (accept/reject + School.update)
- `components/school-admin/PhotoReviewSection.jsx` — filter, update (accept/reject + School.update)

**Proposed routes:**
- `GET /api/enrichment-diffs?school_id=X` — list pending diffs
- `PUT /api/enrichment-diffs/[id]` — accept/reject diff
- `GET /api/photo-candidates?school_id=X` — list pending candidates
- `PUT /api/photo-candidates/[id]` — accept/reject candidate

---

### M. Feedback API (2 calls, 2 files)

**Entity:** BetaFeedback
**Methods:** create, list
**Files:**
- `page-components/Feedback.jsx` — create
- `page-components/AdminFeedback.jsx` — list all

**Proposed routes:**
- `POST /api/feedback` — submit feedback
- `GET /api/admin/feedback` — list all (admin only)

---

### N. School Analysis API (5+ calls, 2 files)

**Entity:** SchoolAnalysis
**Methods:** filter
**Files:**
- `components/chat/SessionRestorer.jsx` — filter for session restore
- `components/hooks/useDataLoader.jsx` — filter by user + conversation

**Proposed routes:**
- `GET /api/school-analyses?conversation_id=X` — list analyses

---

### O. Research Notes API (3 calls, 1 file)

**Entity:** ResearchNote
**Methods:** filter, create, update
**Files:**
- `page-components/Consultant.jsx` — filter by user+school, upsert

**Proposed routes:**
- `GET /api/research-notes?school_id=X` — get notes
- `PUT /api/research-notes` — upsert note

---

### P. Debug/Logging API (4 calls, 2 files)

**Entities:** EmailLog, LLMLog
**Methods:** filter, list, create
**Files:**
- `components/utils/sendSchoolEmail.jsx` — EmailLog.create
- `components/utils/DebugPanel.jsx` — EmailLog.filter, LLMLog.filter/list

**Proposed routes:**
- `GET /api/admin/email-logs` — list email logs (admin/debug)
- `GET /api/admin/llm-logs?conversation_id=X` — list LLM logs (admin/debug)

Note: `sendSchoolEmail.jsx` EmailLog.create should move entirely server-side.

---

### Q. Tour Requests API (1 file, but complex)

**Entity:** TourRequest
**Methods:** create
**Files:**
- `components/schools/TourRequestModal.jsx` — create + cascading journey updates

**Proposed:** Fold into School Inquiries API as `POST /api/school-inquiries` with `type: 'tour_request'`

---

### R. Visitor Log (1 call, 1 file)

**Entity:** VisitorLog
**Methods:** create
**Files:**
- `page-components/SchoolDirectory.jsx`

**Proposed:** `POST /api/visitor-log` — fire-and-forget analytics write

---

### S. Conversation State API (2 calls, 1 file)

**Entity:** ConversationState
**Methods:** filter
**Files:**
- `components/hooks/useConversationState.jsx`

**Proposed:** `GET /api/conversation-state?conversation_id=X`

---

### T. School Admin Entity API (used in Navbar + admin)

**Entity:** SchoolAdmin (the entity, not the page)
**Methods:** filter, create, update
**Files:**
- `components/navigation/Navbar.jsx` — check if user is school admin
- `components/school-admin/AccountSection.jsx` — list admins for school
- `components/admin/AdminSubmissions.jsx` — create on claim approval
- `components/admin/AdminDisputes.jsx` — filter, update, create

**Proposed:** Bundle with School Claims API (same admin workflow)

---

## 3. Locked Files

| File | Owner | Notes |
|------|-------|-------|
| `components/schools/SchoolCard.jsx` | **HUNK** | Not currently importing entities — no conflict |
| `lib/dualWrite.ts` | **LARS** | Not currently importing entities — no conflict |

---

## 4. Recommended Migration Priority

### Wave 1 — Highest impact (most callers)
1. **Schools API** — 15+ files, 35+ calls. Biggest win.
2. **School Events API** — 7 files, used across chat + directory + school-admin
3. **Family Journey API** — Core consultant flow, 4 files

### Wave 2 — Medium impact
4. **School Inquiries API** — 5 files, includes tour requests
5. **School Claims API** — 3 files, complex admin workflow
6. **Notes & Memory API** — 2 files, full CRUD
7. **Testimonials API** — 3 files, school-admin CRUD

### Wave 3 — Lower file count but important
8. **Family Profile API** — 4 files
9. **Artifacts API** — 3 files
10. **Admin Users API** — 4 files (admin-only)
11. **Enrichment & Photos API** — 3 files (school-admin-only)

### Wave 4 — Small / single-file
12. Disputes API
13. Feedback API
14. School Analysis API
15. Research Notes API
16. Conversation State API
17. Debug/Logging API
18. Visitor Log

---

## 5. Stats

- **Total files with direct entity imports:** 47
- **Total distinct entities used client-side:** 22
- **Total entity method calls (approx):** 170+
- **Proposed new API route groups:** 18
- **Already migrated:** Conversations (PR #138), Shortlist (PR #139)
