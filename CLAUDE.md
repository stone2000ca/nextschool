# CLAUDE.md — NextSchool Codebase Guide

## Quick Reference

```bash
npm run dev         # Start dev server (Next.js)
npm run build       # Production build
npm run start       # Run production server
npm run lint        # ESLint (components + pages only)
npm run typecheck   # TypeScript check (tsc --noEmit)
```

No test framework is configured. Validate with `npm run typecheck` and `npm run build`.

## Project Overview

NextSchool is an AI-powered school discovery platform for Canadian families. Built with **Next.js 16 (App Router)**, **React 18**, **Supabase** (PostgreSQL + Auth), and **Tailwind CSS**.

Recently migrated from Base44 to Supabase. Legacy `@base44/sdk` and `@base44/vite-plugin` remain in `package.json` but are being phased out.

## Architecture

```
src/
├── app/                       # Next.js App Router (routes)
│   ├── api/                   # 42+ API routes (thin wrappers)
│   ├── [route]/page.tsx       # Page route → imports from page-components/
│   └── layout.tsx             # Root layout (AuthProvider + Toaster)
├── page-components/           # Top-level page logic (JSX)
├── components/
│   ├── ui/                    # shadcn/ui (auto-generated, DO NOT edit by hand)
│   ├── navigation/            # Navbar, IconRail
│   ├── chat/                  # Consultant chat UI
│   ├── schools/               # School cards, grids, detail panels
│   ├── admin/                 # Admin-specific components
│   ├── dashboard/             # Dashboard widgets
│   ├── dialogs/               # Modals/dialogs
│   └── hooks/                 # Custom React hooks
├── lib/
│   ├── functions/             # Backend business logic (42+ functions)
│   ├── functions.ts           # Client-side function invoker
│   ├── entities.ts            # Client-side data access (Supabase, respects RLS)
│   ├── entities-server.ts     # Server-side data access (admin, bypasses RLS)
│   ├── integrations.ts        # OpenRouter LLM + SendGrid email
│   ├── AuthContext.tsx         # Supabase auth context + hooks
│   └── supabase/
│       ├── client.ts          # Browser Supabase client
│       ├── server.ts          # Server component Supabase client
│       └── admin.ts           # Service role client (server-only)
├── hooks/                     # Additional hooks
└── utils/                     # Utility functions

middleware.ts                  # Supabase session refresh (route protection WIP)
supabase/migrations/           # Database schema (4 migration files)
```

## Core Architecture Rule

**Backend makes the magic. Frontend just presents.**

- All business logic, data transformation, state computation,
  and AI orchestration lives in `/lib/functions/*.ts` (server-side)
- Frontend components and hooks receive data and render it —
  they do not compute, transform, or re-derive business state
- If you find yourself writing logic in a `.jsx` file that could
  live in a Cloud Function, move it to the backend

### What belongs where

| Concern | Location |
|---|---|
| AI orchestration | `orchestrate.ts` |
| School search + ranking | `searchSchools.ts` / `handleResults.ts` |
| Data transformation | `/lib/functions/*.ts` |
| Supabase writes | `/lib/functions/*.ts` via admin client |
| Supabase reads (session restore) | `.jsx` via browser client + JSONB fallback |
| Rendering, view state, UI transitions | `.jsx` components/hooks |

### Non-negotiables

- Never add business logic to `Consultant.jsx`, `useMessageHandler.jsx`,
  or `SessionRestorer.jsx` — these are presentation/coordination layers
- New Supabase writes always go through the admin client server-side
- Frontend never calls Supabase directly to write data
- `orchestrate.ts` return shape is a contract — never change it without
  explicit approval

## Key Patterns

### Page routing

Every route follows this pattern:
```
src/app/[route]/page.tsx  →  imports  →  src/page-components/[Component].jsx
```

Page files are thin wrappers. All logic lives in `page-components/`.

### API routes

All API routes are thin wrappers calling functions from `lib/functions/`:
```typescript
// src/app/api/search-schools/route.ts
import { searchSchools } from '@/lib/functions/searchSchools'
export async function POST(req: NextRequest) {
  const params = await req.json()
  const result = await searchSchools(params)
  return NextResponse.json(result)
}
```

Client-side calls use the `invokeFunction` helper:
```typescript
import { invokeFunction } from '@/lib/functions'
const results = await invokeFunction('searchSchools', { query: 'montessori toronto' })
```

The function name maps to an API route via `ROUTE_MAP` in `lib/functions.ts` (e.g., `searchSchools` → `/api/search-schools`).

### Entity/data access

Two layers wrap Supabase queries:
- **`entities.ts`** (client): Uses browser Supabase client, respects RLS
- **`entities-server.ts`** (server): Uses service role, bypasses RLS

Both provide `.filter()`, `.create()`, `.update()`, `.delete()` methods. Entity names map to table names (e.g., `School` → `schools`, `FamilyProfile` → `family_profiles`, `ChatHistory` → `conversations`).

### Auth

- **Provider**: Supabase Auth (email/password)
- **Context**: `AuthContext.tsx` wraps the app in `layout.tsx`
- **Hook**: `useAuth()` returns `{ user, isAuthenticated, isLoadingAuth, login, signup, logout, navigateToLogin, updateMe, refreshUser }`
- **User profile**: `user_profiles` table extends `auth.users` with role, subscription_plan, token_balance, etc.
- **Roles**: `'user'`, `'admin'`, `'school_admin'`
- **Login/signup pages**: Being built (see `PLAN-auth-system.md`)
- **Middleware**: Currently only refreshes sessions; route protection is WIP

### State management

- **Auth state**: React Context (`AuthContext`)
- **Server state**: `@tanstack/react-query`
- **No Redux/Zustand** — component state + context only

## Database

**PostgreSQL via Supabase** with 33 tables. Key tables:
- `schools` — School profiles (public read)
- `user_profiles` — Extends auth.users (user-scoped)
- `conversations` — Chat sessions with AI consultant
- `family_profiles`, `family_journeys`, `school_journeys` — User journey data
- `chat_shortlists`, `generated_artifacts` — User-generated content
- `school_claims`, `school_admins` — School ownership
- `token_transactions` — Usage tracking

**RLS policies** (`supabase/migrations/002_rls.sql`):
- Public read: `schools`, `blog_posts` (published), `school_events`, `testimonials`
- User-scoped: Users access only their own data
- Service role: Full access for backend functions

**Migrations**: `supabase/migrations/001-004`. Push with `supabase db push`.

**Primary keys**: TEXT type, `DEFAULT gen_random_uuid()::TEXT`.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY=        # Service role key (server-only)
OPENROUTER_API_KEY=               # LLM access (OpenRouter)
STRIPE_SECRET_KEY=                # Stripe backend
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= # Stripe frontend
```

Optional:
```
SENDGRID_API_KEY=                 # Email (falls back to console.log)
FROM_EMAIL=                       # Sender email for SendGrid
```

## Code Conventions

### Language
- **App router pages**: `.tsx`
- **Components**: Mix of `.jsx` and `.tsx` (gradual TypeScript adoption)
- **Lib/functions**: `.ts`
- **TypeScript strictness**: Lenient (`strict: false`, `strictNullChecks: false`)

### Naming
- Files: kebab-case (`school-admin.ts`, `family-profiles.ts`)
- Components: PascalCase (`SchoolCard.tsx`, `Navbar.jsx`)
- DB columns: snake_case → converted to camelCase in frontend
- Constants: UPPER_SNAKE_CASE

### Imports
- Use `@/` path alias (maps to `src/`)
- Client components must have `'use client'` directive

### Linting
- ESLint 9 flat config (`eslint.config.js`)
- Scope: `src/components/**/*.{js,jsx}`, `src/pages/**/*.{js,jsx}`, `src/Layout.jsx`
- Ignores: `src/lib/**/*`, `src/components/ui/**/*`
- Key rules: no unused imports (error), React Hooks rules (error), no prop-types
- No Prettier config

### UI
- **Tailwind CSS** with CSS variables (HSL-based)
- **shadcn/ui** components in `src/components/ui/` (do not edit manually)
- **Lucide React** icons
- **Sonner** for toast notifications
- **Framer Motion** for animations
- Dark mode supported (class-based)

## Protected Routes (Auth System WIP)

Routes that require authentication:
- `/consultant` — Core product (AI school consultant)
- `/dashboard` — User dashboard
- `/admin`, `/admin/*` — Admin panel (also needs `role === 'admin'`)
- `/schooladmin/:id` — School management duo-pane UI (needs SchoolAdmin record)
- `/school-admin` — Legacy redirect to `/schooladmin/:id`
- `/claim-school`, `/submit-school` — School ownership

Public routes: `/`, `/home`, `/about`, `/schools`, `/pricing`, `/contact`, `/guides`, `/blog/*`, `/school/[slug]`, `/shared/*`, `/portal`, `/feedback`, `/for-schools`, `/how-it-works`, `/terms`, `/privacy`

## Key Integrations

- **LLM**: OpenRouter API (`openai/gpt-4.1-mini` default, `openai/gpt-4.1` for complex tasks)
- **Payments**: Stripe (checkout sessions, webhooks at `/api/stripe-webhook`)
- **Email**: SendGrid (optional, degrades to console logging)
- **Maps**: React Leaflet

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.
Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

## PR Workflow

When asked to create a PR, just verify the latest commit was pushed to the remote branch. No additional steps needed — the user will handle merging on GitHub directly.

## Things to Watch Out For

1. **`src/components/ui/`** is auto-generated by shadcn — don't edit these files directly
2. **`entities.ts`** field mapping converts snake_case ↔ camelCase — check both when debugging
3. **`ChatHistory` entity maps to `conversations` table** (not `chat_history`)
4. **No test suite** — validate changes with `npm run typecheck` and `npm run build`
5. **Base44 legacy code** still exists (`@base44/sdk`, `src/api/base44Client.js`, `src/lib/app-params.js`) — avoid using it, will be removed
6. **Middleware** currently only refreshes auth sessions — does NOT enforce route protection yet
7. **`layout.tsx`** is marked `'use client'` — the entire app renders client-side under AuthProvider
8. **Entity existence checks** — When writing new functions that call entities, always verify the entity/table exists in Supabase first (use the Supabase MCP tools to check). If it doesn't exist, create the table or update the schema before writing the function code.
