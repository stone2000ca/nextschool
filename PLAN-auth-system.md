# Auth System Implementation Plan

## Current State
- **Auth backend**: Supabase Auth (email/password) — already wired up
- **AuthContext**: Fully functional (`login`, `signup`, `logout`, `navigateToLogin`, `updateMe`) at `/src/lib/AuthContext.tsx`
- **Middleware**: Only refreshes sessions, does NOT enforce route protection
- **Login/Signup pages**: **Do not exist** — `navigateToLogin()` redirects to `/login` which 404s
- **Route protection**: Done ad-hoc inside each component (fragile, inconsistent)

## What Needs to Be Built

### Phase 1: Login & Signup Pages

**1a. Create `/src/app/login/page.tsx`** + **`/src/page-components/Login.jsx`**
- Email/password form using existing `useAuth().login()`
- Read `?returnTo=` query param, redirect there after successful login
- Link to signup page
- Error handling (invalid credentials, network errors)
- Clean, minimal UI matching existing design (Tailwind + Radix/shadcn components)

**1b. Create `/src/app/signup/page.tsx`** + **`/src/page-components/Signup.jsx`**
- Email/password + full name form using existing `useAuth().signup()`
- Pass `{ full_name }` as metadata to Supabase signup
- Read `?returnTo=` query param, redirect after signup
- Link to login page
- Password requirements display (min 6 chars — Supabase default)

### Phase 2: Middleware Route Protection

**2a. Update `/middleware.ts`** to enforce auth on protected routes
- Define protected route patterns:
  - `/consultant` — requires any authenticated user
  - `/dashboard` — requires any authenticated user
  - `/admin`, `/admin/*` — requires authenticated user (role check stays in component)
  - `/school-admin` — requires authenticated user (admin record check stays in component)
  - `/claim-school` — requires authenticated user
  - `/submit-school` — requires authenticated user
- If no valid session → redirect to `/login?returnTo={requested_path}`
- If valid session → allow through (role checks remain component-level since they need DB queries)
- Public routes pass through unchanged

**2b. Keep component-level role checks as-is**
- Admin page checks `role === 'admin'` → stays (middleware can't efficiently check DB roles)
- SchoolAdmin page checks for SchoolAdmin record → stays
- These are authorization (role-based), not authentication — correct layer is the component

### Phase 3: Auth Gate Component (for `/consultant`)

**3a. Create `/src/components/auth/AuthGate.jsx`**
- Reusable wrapper component that checks `useAuth().isAuthenticated`
- While loading: show spinner/skeleton
- If not authenticated: show a compelling login prompt (not a redirect — consultant page should show value before gating)
- Props: `children`, `fallback?` (custom unauthenticated UI), `redirect?` (boolean — if true, redirect to login instead of showing fallback)

**3b. Wire AuthGate into Consultant page**
- Replace the ad-hoc `showLoginGate` state with AuthGate
- Gate the actual consultant interaction (chat, school results) behind auth
- Allow unauthenticated users to see the welcome/onboarding UI but require login before full usage
- Preserve `?returnTo=/consultant` flow

### Phase 4: Clean Up Component-Level Auth

**4a. Remove redundant auth redirects from page components**
- Dashboard: Replace manual `navigateToLogin()` call — middleware now handles it
- ClaimSchool: Same
- SubmitSchool: Same
- SchoolDirectory: Keep as-is (it's a public page with optional auth features)

**4b. Consultant page cleanup**
- Remove the local `showLoginGate` state
- Remove the local `isAuthenticated` shadow state (line 67) — use `authIsAuthenticated` directly from useAuth
- The middleware + AuthGate handles the rest

## File Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `/src/app/login/page.tsx` | Login route wrapper |
| CREATE | `/src/page-components/Login.jsx` | Login form UI |
| CREATE | `/src/app/signup/page.tsx` | Signup route wrapper |
| CREATE | `/src/page-components/Signup.jsx` | Signup form UI |
| CREATE | `/src/components/auth/AuthGate.jsx` | Reusable auth gate component |
| EDIT   | `/middleware.ts` | Add route protection logic |
| EDIT   | `/src/page-components/Consultant.jsx` | Wire AuthGate, remove ad-hoc auth |
| EDIT   | `/src/page-components/Dashboard.jsx` | Remove redundant navigateToLogin |
| EDIT   | `/src/page-components/ClaimSchool.jsx` | Remove redundant navigateToLogin |
| EDIT   | `/src/page-components/SubmitSchool.jsx` | Remove redundant navigateToLogin |

## Architecture Decisions

1. **Middleware for authentication, components for authorization** — Middleware checks "is logged in?", components check "has the right role?"
2. **Consultant gets special treatment** — It's the core product; unauthenticated users should see enough to want to sign up, then hit the gate. Other protected routes just redirect.
3. **No new dependencies** — Uses existing Supabase Auth, existing UI components (shadcn), existing AuthContext
4. **No API route protection yet** — API routes are server-side functions; they should validate auth via Supabase RLS (already in place via `002_rls.sql`). Can be added later if needed.
