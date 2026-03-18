import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// 3-day inactivity session persistence
const INACTIVITY_LIMIT_MS = 3 * 24 * 60 * 60 * 1000 // 3 days in ms
const INACTIVITY_LIMIT_SECONDS = 3 * 24 * 60 * 60    // 3 days in seconds
const ACTIVITY_COOKIE = 'ns_last_activity'

const PROTECTED_PREFIXES = [
  '/consultant',
  '/dashboard',
  '/admin',
  '/school-admin',
  '/claim-school',
  '/submit-school',
]

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Create a response we can modify (for session refresh cookies)
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Refresh the Supabase session (sets cookies on response)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Also set on the response (for the browser)
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // Check inactivity timeout
    const lastActivity = request.cookies.get(ACTIVITY_COOKIE)?.value
    if (lastActivity) {
      const elapsed = Date.now() - Number(lastActivity)
      if (elapsed > INACTIVITY_LIMIT_MS) {
        // Inactive for too long — sign out
        await supabase.auth.signOut()
        response.cookies.set(ACTIVITY_COOKIE, '', { maxAge: 0, path: '/' })
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/login'
        loginUrl.searchParams.set('returnTo', pathname)
        return NextResponse.redirect(loginUrl)
      }
    }
    // Reset activity timer on every navigation
    response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
      maxAge: INACTIVITY_LIMIT_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  } else {
    // No user — clear activity cookie if present
    if (request.cookies.has(ACTIVITY_COOKIE)) {
      response.cookies.set(ACTIVITY_COOKIE, '', { maxAge: 0, path: '/' })
    }
  }

  // Protect routes: redirect unauthenticated users to login
  if (!user && isProtectedRoute(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files.
     * _next/static and _next/image are excluded by Next.js default,
     * but we also skip them explicitly above for clarity.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
