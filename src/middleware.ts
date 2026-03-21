import { NextResponse, type NextRequest } from 'next/server'

// 3-day inactivity session persistence
const INACTIVITY_LIMIT_MS = 3 * 24 * 60 * 60 * 1000 // 3 days in ms
const INACTIVITY_LIMIT_SECONDS = 3 * 24 * 60 * 60   // 3 days in seconds
const ACTIVITY_COOKIE = 'ns_last_activity'

const PROTECTED_PREFIXES = [
  '/consultant',
  '/dashboard',
  '/admin',
  '/school-admin',
  '/claim-school',
  '/submit-school',
  '/schooladmin',
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

  let response = NextResponse.next({
    request,
  })

  // Detect whether a Supabase auth session exists by checking cookies
  // directly — WITHOUT creating a Supabase client or calling any auth method.
  //
  // Why: Both getUser() and getSession() can trigger a server-side token
  // refresh when the access token is expired.  This consumes the refresh
  // token (R1 → R2) and writes new cookies via Set-Cookie.  However, the
  // browser's gotrue-js singleton still holds R1 in memory.  When it later
  // attempts its own refresh it uses the consumed R1, which fails.  GoTrue
  // then fires SIGNED_OUT and — critically — *deletes all auth cookies from
  // storage*, including the fresh R2 the middleware just wrote.  The recovery
  // handler in AuthContext calls getUser() but the cookies are gone, so
  // recovery fails and the user is logged out.
  //
  // The middleware only needs to know IF a session cookie exists (for route
  // protection and activity tracking).  Actual token validation and refresh
  // are handled exclusively by the browser's gotrue-js client, which is the
  // sole owner of the refresh cycle.
  const hasSession = request.cookies.getAll().some(
    ({ name }) => name.startsWith('sb-') && name.includes('-auth-token')
  )

  function redirectToLogin(returnPath: string) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('returnTo', returnPath)
    return NextResponse.redirect(loginUrl)
  }

  if (hasSession) {
    // Check inactivity timeout
    const lastActivity = request.cookies.get(ACTIVITY_COOKIE)?.value
    if (lastActivity) {
      const elapsed = Date.now() - Number(lastActivity)
      if (elapsed > INACTIVITY_LIMIT_MS) {
        // Inactive for too long — clear all auth cookies directly instead of
        // calling signOut() (which needs a valid access token that may be expired)
        request.cookies.getAll().forEach(({ name }) => {
          if (name.startsWith('sb-')) {
            response.cookies.set(name, '', { maxAge: 0, path: '/' })
          }
        })
        response.cookies.set(ACTIVITY_COOKIE, '', { maxAge: 0, path: '/' })
        return redirectToLogin(pathname)
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
  if (!hasSession && isProtectedRoute(pathname)) {
    return redirectToLogin(pathname)
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
