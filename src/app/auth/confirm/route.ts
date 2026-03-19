import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Handles Supabase email confirmation links.
 * Supabase sends links like: /auth/confirm?token_hash=...&type=signup
 * This route verifies the token and redirects to the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = (searchParams.get('type') as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change') || 'signup'
  const returnTo = searchParams.get('returnTo') || '/dashboard'

  if (token_hash) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(new URL(returnTo, request.url))
    }
  }

  // If verification fails, redirect to login with an error hint
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('error', 'confirmation_failed')
  return NextResponse.redirect(loginUrl)
}
