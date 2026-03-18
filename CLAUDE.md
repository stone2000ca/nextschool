# CLAUDE.md — NextSchool

AI-powered school discovery platform helping Canadian families find, compare, and choose private schools. Built with Next.js App Router, Supabase, and OpenRouter LLM APIs.

## Tech Stack

- **Frontend:** React 18 + Next.js 16 (App Router), Tailwind CSS 3.4, shadcn/ui (Radix primitives)
- **Backend:** Next.js API routes + Supabase (PostgreSQL with RLS)
- **Auth:** Supabase Auth with JWT, React Context (`useAuth()`)
- **State:** React Context (auth) + TanStack React Query (server state)
- **LLM:** OpenRouter API (Gemini 3 Flash → GPT-4.1-mini → Gemini 2.5 Flash fallback chain)
- **Payments:** Stripe checkout sessions
- **Icons:** Lucide React
- **Deployment:** Vercel

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server on localhost:3000
npm run build        # Production build
npm run typecheck    # TypeScript checking (no emit)
npm run lint         # ESLint
```

No test suite exists yet.

## Directory Structure

```
src/
├── app/                    # Next.js App Router routes
│   ├── api/                # API route handlers (35+ endpoints)
│   ├── admin/              # Admin dashboard
│   ├── school/             # School profile pages
│   ├── school-admin/       # School admin panel
│   ├── consultant/         # Main chat consultant
│   ├── dashboard/          # User dashboard/sessions
│   ├── blog/[slug]/        # Blog posts
│   ├── shared/             # Shared shortlists
│   ├── layout.tsx          # Root layout with AuthProvider
│   └── page.tsx            # Home page
├── components/             # React components (~135 files)
│   ├── ui/                 # shadcn/ui primitives (30+)
│   ├── admin/              # Admin components
│   ├── school-admin/       # School admin components
│   ├── navigation/         # Navbar, Footer
│   ├── dashboard/          # Dashboard UI
│   ├── chat/               # Chat interface
│   ├── schools/            # School display
│   ├── dialogs/            # Modals
│   └── claim/              # School claim flow
├── page-components/        # Page-level components (23+)
│   ├── Home.jsx
│   ├── Dashboard.jsx
│   ├── Consultant.jsx      # Main chat interface
│   ├── SchoolProfile.jsx
│   └── SchoolAdmin.jsx
├── lib/                    # Core utilities & business logic
│   ├── supabase/
│   │   ├── client.ts       # Browser Supabase client
│   │   ├── server.ts       # Server Supabase client (cookie-based)
│   │   └── admin.ts        # Service role client (bypasses RLS)
│   ├── entities.ts         # Client-side entity access (35+ entities)
│   ├── entities-server.ts  # Server-side entity access (admin client)
│   ├── AuthContext.tsx      # Auth provider & useAuth hook
│   ├── functions.ts        # invokeFunction() client helper
│   ├── integrations.ts     # OpenRouter LLM + SendGrid email
│   ├── functions/           # Business logic (orchestrate, search, etc.)
│   ├── stateMachineConfig.jsx  # Conversation state machine
│   ├── query-client.js     # TanStack React Query config
│   └── utils.js            # cn() classname utility
├── hooks/                  # Custom hooks (use-mobile, etc.)
└── globals.css             # Global styles & CSS variables
supabase/
└── migrations/             # Database migration files
middleware.ts               # Auth session refresh middleware
```

## Entity Models

The project uses a convention-based entity system. Entity clients auto-convert between camelCase (JS) and snake_case (DB).

### Core Entities

| Entity | Table | Description |
|--------|-------|-------------|
| `ChatHistory` | conversations | Chat messages |
| `ChatSession` | chat_sessions | Conversation sessions |
| `ChatShortlist` | chat_shortlists | Saved school shortlists |
| `ConversationSummary` | conversation_summaries | AI-generated summaries |
| `User` | user_profiles | User accounts (token_balance, subscription_plan) |
| `UserMemory` | user_memories | Persistent user preferences |
| `FamilyProfile` | family_profiles | Family preferences & requirements |
| `School` | schools | Main school database |
| `SchoolAnalysis` | school_analyses | AI analysis of schools |
| `SchoolEvent` | school_events | Open houses, tours |
| `SchoolClaim` | school_claims | School ownership claims |
| `SchoolAdmin` | school_admins | School admin users |
| `SchoolInquiry` | school_inquiries | Parent inquiries |
| `FamilyJourney` | family_journeys | User journey tracking |
| `SchoolJourney` | school_journeys | School interaction tracking |
| `GeneratedArtifact` | generated_artifacts | AI-generated reports |
| `TokenTransaction` | token_transactions | Token usage audit log |
| `SharedShortlist` | shared_shortlists | Shareable shortlist links |
| `Blog` / `BlogPost` | blog_posts | Blog content |
| `Feedback` | feedback | User feedback |
| `LLMLog` | llm_logs | LLM call logging |
| `SearchLog` | search_logs | Search query logging |
| `TourRequest` | tour_requests | Tour booking requests |

### Entity Access Pattern

```typescript
// Client-side (src/lib/entities.ts)
import { School } from '@/lib/entities'
const schools = await School.filter({ region: 'Ontario' }, '-tuition', 50)
const school = await School.get(id)
await School.update(id, { name: 'New Name' })
await School.create({ name: '...', region: '...' })
await School.delete(id)

// Server-side (src/lib/entities-server.ts) — bypasses RLS
import { School } from '@/lib/entities-server'
```

## Key Architectural Patterns

### 1. Function-Based Backend

Business logic lives in `src/lib/functions/`. Each function is exposed via a matching API route and called from the frontend with `invokeFunction()`.

```typescript
// Frontend call
import { invokeFunction } from '@/lib/functions'
const result = await invokeFunction('searchSchools', { region: 'ON' })

// Maps to: POST /api/search-schools
// Logic in: src/lib/functions/searchSchools.ts
```

Key functions: `orchestrate.ts` (main chat), `searchSchools.ts`, `extractEntities.ts`, `handleResults.ts`, `handleDeepDive.ts`, `generateComparison.ts`, `exportShortlist.ts`.

### 2. Conversation State Machine

States: `WELCOME → DISCOVERY → BRIEF → RESULTS → DEEP_DIVE`

Orchestrated in `orchestrate.ts`. State persisted in `FamilyProfile` and `FamilyJourney` entities.

### 3. LLM Integration

```typescript
import { invokeLLM } from '@/lib/integrations'

const response = await invokeLLM({
  prompt: '...',
  model: 'gpt-4o',  // optional, defaults to gpt-4.1-mini
  response_json_schema: { /* optional structured output */ }
})
```

Model waterfall: Gemini 3 Flash → GPT-4.1-mini → Gemini 2.5 Flash. All calls logged to `LLMLog`.

### 4. Token-Based Rate Limiting

Free users: 3 tokens, 3 max sessions. Tokens consumed per conversation state change. Upgrades via Stripe. Audited in `TokenTransaction`.

## Conventions

### Naming
- **Components:** PascalCase files (`SchoolCard.jsx`)
- **Utilities/functions:** camelCase files (`searchSchools.ts`)
- **DB fields:** snake_case in Supabase, camelCase in JS (auto-converted)
- **Logs:** `console.log('[CONTEXT] message')` with bracket prefixes

### Imports
```typescript
import { Button } from "@/components/ui/button"   // shadcn/ui
import { useAuth } from "@/lib/AuthContext"         // Auth
import { School } from "@/lib/entities"             // Entities
import { invokeFunction } from "@/lib/functions"    // Backend calls
```

### Components
- Add `'use client'` directive for components using hooks
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes
- Tailwind-only styling (no CSS modules or inline styles)
- Color tokens: `bg-background`, `text-foreground`, `bg-card`, `bg-primary`, etc.

### API Routes
```typescript
// src/app/api/[route]/route.ts
export const maxDuration = 60  // for long-running routes

export async function POST(req: NextRequest) {
  const params = await req.json()
  const result = await functionNameLogic(params)
  return NextResponse.json(result)
}
```

### Error Handling
- Functions throw errors with `.statusCode` property
- API routes catch and return `{ error: message }` with status code
- Components show user-friendly messages via `setError()`

## Auth Flow

1. `middleware.ts` refreshes Supabase session on every request
2. `AuthContext.tsx` provides `useAuth()` hook: `{ user, isAuthenticated, login, signup, logout }`
3. User profile stored in `user_profiles` table (created on signup)
4. Server-side: use `entities-server.ts` (service role) for admin operations

## Environment Variables

```
OPENROUTER_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SENDGRID_API_KEY=SG....          # optional, for email
FROM_EMAIL=noreply@nextschool.ca
STRIPE_SECRET_KEY=sk_...         # for payments
```
