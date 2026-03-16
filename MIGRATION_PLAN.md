# School Schema V1 → V2 Migration Plan

## Global Find-and-Replace Map

| V1 (camelCase) | V2 (snake_case) | Special Notes |
|---|---|---|
| `provinceState` | `province_state` | |
| `religiousAffiliation` | `faith_based` | Name change, not just case |
| `boardingAvailable` | `boarding_available` | |
| `genderPolicy` | `gender_policy` | |
| `languageOfInstruction` | `languages_of_instruction` | Plural change |
| `headerPhotoUrl` | `header_photo_url` | |
| `logoUrl` | `logo_url` | |
| `lowestGrade` | `lowest_grade` | |
| `highestGrade` | `highest_grade` | |
| `gradesServed` | `grades_served` | |
| `schoolTier` | `school_tier` | |
| `claimStatus` | `claim_status` | |
| `dayTuition` | `day_tuition` | |
| `boardingTuition` | `boarding_tuition` | |
| `curriculumType` | `curriculum` | **Now an ARRAY** — update `===` to `.includes()` |
| `avgClassSize` | `avg_class_size` | |
| `studentTeacherRatio` | `student_teacher_ratio` | |
| `artsPrograms` | `arts_programs` | |
| `sportsPrograms` | `sports_programs` | |
| `financialAidAvailable` | `financial_aid_available` | |
| `missionStatement` | `mission_statement` | |
| `schoolType` | `school_type_label` | Name change |
| `applicationDeadline` | `day_admission_deadline` | Name change |
| `admissionRequirements` | `admission_requirements` | |
| `openHouseDates` | `open_house_dates` | |
| `created_date` | `created_at` | Sort param in searchSchools.ts |

## Files to Update (by category)

### Backend Functions (25+ files)
- `functions/searchSchools.ts` — heaviest file, ~15+ field refs + sort param
- `functions/handleDeepDive.ts` — ~12 field refs
- `functions/enrichSchoolFromWeb.ts` — ~12 field refs
- `functions/findDuplicateSchools.ts` — ~10 field refs
- `functions/mergeDuplicateSchools.ts` — ~8 field refs
- `functions/getNearbySchools.ts` — ~12 field refs
- `functions/calculateCompletenessScore.ts` — ~10 field refs
- `functions/generateSharedShortlistLink.ts` — ~10 field refs
- `functions/generateMatchExplanations.ts` — ~6 field refs
- `functions/generateSchoolSummary.ts` — ~5 field refs
- `functions/exportShortlist.ts` — ~6 field refs
- `functions/handleResults.ts` — ~4 field refs
- `functions/generateComparison.ts` — ~4 field refs
- `functions/fetchSchoolProfile.ts` — ~4 field refs
- `functions/orchestrateConversation.ts` — schoolType refs
- `functions/sendClaimEmail.ts` — claimStatus refs
- `functions/generateSitemap.ts` — claimStatus ref
- `functions/verifyClaimCode.ts` — schoolTier/claimStatus refs
- `functions/populateSchoolWebsites.ts` — provinceState + created_date
- `functions/geocodeSchools.ts` — provinceState
- `functions/updateSchoolPhotos.ts` — headerPhotoUrl refs
- `functions/updateSchoolPhotosWithUrls.ts` — headerPhotoUrl refs
- `functions/cleanupAndAnalyze.ts` — headerPhotoUrl refs
- `functions/migration_2026-02-26_remove-clearbit-urls.ts` — headerPhotoUrl
- `functions/migration_2026-02-26_remove-unsplash-urls.ts` — headerPhotoUrl

### Frontend Components (~35 files)
- `src/pages/SchoolProfile.jsx` — heaviest, 20+ refs
- `src/pages/Consultant.jsx` — ~15 refs including created_date sorts
- `src/pages/SchoolDirectory.jsx` — ~8 refs
- `src/pages/SubmitSchool.jsx` — ~15 refs (form fields)
- `src/pages/Portal.jsx` — provinceState
- `src/pages/ClaimSchool.jsx` — claimStatus + created_date
- `src/pages/SchoolAdmin.jsx` — schoolTier + created_date
- `src/pages/Dashboard.jsx` — created_date
- `src/pages/stateMachineConfig.jsx` — schoolType
- `src/components/schools/SchoolDetailPanel.jsx` — ~18 refs
- `src/components/schools/SchoolCard.jsx` — ~12 refs
- `src/components/schools/SchoolCardUnified.jsx` — ~10 refs
- `src/components/schools/ComparisonView.jsx` — ~15 refs
- `src/components/schools/ComparisonTable.jsx` — ~6 refs
- `src/components/schools/SchoolDetail.jsx` — ~10 refs
- `src/components/schools/ShortlistComparisonModal.jsx` — ~5 refs
- `src/components/schools/HeaderPhotoHelper.jsx` — headerPhotoUrl/logoUrl
- `src/components/schools/ContactSchoolModal.jsx` — claimStatus
- `src/components/school-admin/ProfileEditor.jsx` — ~20 refs
- `src/components/school-admin/EditProfileForm.jsx` — ~15 refs
- `src/components/school-admin/ProfileCompletenessRing.jsx` — ~10 refs
- `src/components/school-admin/PhotosMediaSection.jsx` — headerPhotoUrl/logoUrl
- `src/components/school-admin/PhotoReviewSection.jsx` — headerPhotoUrl
- `src/components/school-admin/AdmissionsSection.jsx` — ~8 refs
- `src/components/school-admin/CSVUpload.jsx` — artsPrograms/sportsPrograms
- `src/components/school-admin/EventsSection.jsx` — schoolTier
- `src/components/school-admin/Subscription.jsx` — schoolTier
- `src/components/school-admin/Inquiries.jsx` — created_date
- `src/components/chat/SessionRestorer.jsx` — provinceState + created_date
- `src/components/chat/FamilyBrief.jsx` — schoolType
- `src/components/chat/SchoolDossierCard.jsx` — ~4 refs
- `src/components/chat/AddSchoolPanel.jsx` — ~3 refs
- `src/components/chat/handleNarrateComparison.jsx` — ~10 refs
- `src/components/chat/NotesPanel.jsx` — created_date
- `src/components/chat/ConsultantDialogs.jsx` — created_date
- `src/components/utils/filterUtils.jsx` — religiousAffiliation/genderPolicy
- `src/components/utils/tierEngine.jsx` — ~6 refs
- `src/components/utils/shortlistNudges.jsx` — dayTuition/curriculumType/schoolType
- `src/components/utils/sendSchoolEmail.jsx` — claimStatus
- `src/components/utils/DebugPanel.jsx` — created_date
- `src/components/hooks/useSchoolFiltering.jsx` — highestGrade/dayTuition
- `src/components/hooks/useDataLoader.jsx` — created_date
- `src/components/admin/AdminSubmissions.jsx` — claimStatus/provinceState + created_date
- `src/components/admin/AdminSchools.jsx` — schoolTier
- `src/components/admin/AdminClaims.jsx` — claimStatus + created_date
- `src/components/admin/AdminDisputes.jsx` — created_date
- `src/components/admin/AdminAnalytics.jsx` — created_date
- `src/components/admin/AdminUsers.jsx` — created_date
- `src/pages/SharedShortlistView.jsx` — provinceState

## Special Handling Required

### 1. `curriculumType` → `curriculum` (STRING → ARRAY)
Every `=== 'IB'` or `=== 'Montessori'` must become `.includes('IB')` etc.
Every `.toLowerCase()` string comparison must become array-aware.

### 2. `created_date` → `created_at`
Used as sort params like `'-created_date'` in Base44 `.list()` calls — must update sort strings too.

### 3. `religiousAffiliation` → `faith_based` (semantic rename)
Not just a case change — meaning shift from affiliation string to boolean/enum.

### 4. `schoolType` → `school_type_label` (semantic rename)
Update all property accesses and form field references.

### 5. `applicationDeadline` → `day_admission_deadline` (semantic rename)
Update all property accesses.

## Execution Order
1. Backend functions (data layer first)
2. Frontend hooks/utils (shared logic)
3. Frontend components (display layer)
4. Frontend pages (top-level)
5. Verify no remaining V1 references with grep
