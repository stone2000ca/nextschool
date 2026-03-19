'use client'

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  full_name?: string
  role?: string
  subscription_plan?: string
  token_balance?: number
  max_sessions?: number
  stripe_customer_id?: string
  last_signed_on?: string
  profile_region?: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

interface AuthContextType {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoadingAuth: boolean
  isLoadingPublicSettings: boolean
  authError: { type: string; message: string } | null
  appPublicSettings: any
  logout: (shouldRedirect?: boolean) => Promise<void>
  navigateToLogin: (returnTo?: string) => void
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, metadata?: any) => Promise<void>
  updateMe: (updates: Record<string, any>) => Promise<void>
  checkAppState: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false)
  const [authError, setAuthError] = useState<{ type: string; message: string } | null>(null)
  const [appPublicSettings, setAppPublicSettings] = useState<any>(null)

  const supabase = createClient()

  // Track whether a logout was explicitly requested by the user (vs. an
  // automatic SIGNED_OUT from a failed token refresh).
  const explicitLogoutRef = useRef(false)

  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error || !data) {
      // Profile might not exist yet (trigger delay); return basic info
      return {
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name,
        role: 'user',
        token_balance: 3,
        max_sessions: 3,
      }
    }

    // Return snake_case fields directly from DB
    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      subscription_plan: data.subscription_plan,
      token_balance: data.token_balance,
      max_sessions: data.max_sessions,
      stripe_customer_id: data.stripe_customer_id,
      last_signed_on: data.last_signed_on,
      profile_region: data.profile_region,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }
  }, [supabase])

  const checkAppState = useCallback(async () => {
    try {
      setIsLoadingAuth(true)
      setAuthError(null)

      // Use getUser() to validate session server-side and avoid stale token races
      const { data: { user: authUser }, error } = await supabase.auth.getUser()

      if (authUser && !error) {
        const profile = await fetchUserProfile(authUser)
        setUser(profile)
        setIsAuthenticated(true)
      } else {
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (error: any) {
      console.error('Auth check failed:', error)
      setAuthError({
        type: 'unknown',
        message: error.message || 'Auth check failed',
      })
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoadingAuth(false)
    }
  }, [supabase, fetchUserProfile])

  const refreshUser = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const profile = await fetchUserProfile(authUser)
      setUser(profile)
    }
  }, [supabase, fetchUserProfile])

  useEffect(() => {
    // Set up auth state listener FIRST, then check current state.
    // Handle ALL events: INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT.
    // This ensures auth persists across navigations when middleware refreshes tokens.
    // IMPORTANT: This callback must NOT be async.  In supabase-js v2.64+,
    // signInWithPassword() internally awaits all onAuthStateChange callbacks
    // via _notifyAllSubscribers().  If this callback is async and the awaited
    // work (e.g. fetchUserProfile DB query) stalls, signInWithPassword() hangs
    // forever — which is the root cause of the "Logging in…" infinite spinner.
    // Instead, we fire-and-forget the async profile fetch so the callback
    // returns synchronously and never blocks the auth flow.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') &&
          session?.user
        ) {
          // Set authenticated immediately (synchronous) so the UI updates fast.
          // Profile fetch happens in the background.
          setIsAuthenticated(true)
          setIsLoadingAuth(false)
          fetchUserProfile(session.user)
            .then((profile) => { if (profile) setUser(profile) })
            .catch((err) => console.error('Failed to fetch user profile:', err))
        } else if (event === 'INITIAL_SESSION' && !session) {
          // No session on initial load — user is unauthenticated
          setUser(null)
          setIsAuthenticated(false)
          setIsLoadingAuth(false)
        } else if (event === 'SIGNED_OUT') {
          if (explicitLogoutRef.current) {
            // User clicked "Logout" — honour immediately
            setUser(null)
            setIsAuthenticated(false)
            setIsLoadingAuth(false)
            explicitLogoutRef.current = false
          } else {
            // Automatic SIGNED_OUT (e.g. failed token refresh).  Before
            // wiping auth state, double-check whether cookies still hold a
            // valid session.  Fire-and-forget to avoid blocking the callback.
            supabase.auth.getUser()
              .then(({ data: { user: recovered } }) => {
                if (recovered) {
                  setIsAuthenticated(true)
                  setIsLoadingAuth(false)
                  fetchUserProfile(recovered)
                    .then((profile) => { if (profile) setUser(profile) })
                    .catch((err) => console.error('Failed to fetch recovered profile:', err))
                } else {
                  setUser(null)
                  setIsAuthenticated(false)
                  setIsLoadingAuth(false)
                }
              })
              .catch(() => {
                // getUser also failed — session is truly gone
                setUser(null)
                setIsAuthenticated(false)
                setIsLoadingAuth(false)
              })
          }
        } else {
          // Fallback: for any unhandled event (USER_UPDATED, PASSWORD_RECOVERY, etc.)
          // always ensure loading resolves so the UI never gets stuck
          setIsLoadingAuth(false)
        }
      }
    )

    // The onAuthStateChange listener above handles INITIAL_SESSION, SIGNED_IN,
    // TOKEN_REFRESHED, and SIGNED_OUT — so we do NOT call checkAppState() here.
    // Previously, checkAppState() was called alongside the listener, but it
    // re-sets isLoadingAuth to true (line 93) AFTER the listener already set it
    // to false, causing a race that left protected pages stuck on a spinner.
    // The INITIAL_SESSION event from the listener is sufficient for initial load.

    // Safety timeout: guarantee isLoadingAuth resolves within 5 seconds
    // so the UI never gets stuck in an infinite spinner
    const safetyTimeout = setTimeout(() => {
      setIsLoadingAuth((current) => {
        if (current) {
          console.warn('Auth loading safety timeout triggered — forcing isLoadingAuth to false')
        }
        return false
      })
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
    }
  }, [])

  // Auth state is fully managed by the onAuthStateChange listener above.
  // We intentionally do NOT re-sync on pathname changes.  The previous
  // implementation called getSession() on every navigation, but in
  // @supabase/supabase-js v2.64+ getSession() triggers a token refresh
  // when the access token is expired.  On heavy pages like /consultant,
  // this refresh races with concurrent Supabase queries (entity fetches),
  // causing the refresh token to be consumed twice — the second attempt
  // fails, gotrue-js fires SIGNED_OUT, deletes all auth cookies, and the
  // recovery handler cannot restore the session because the cookies are
  // already gone.  Removing this effect lets gotrue-js be the sole owner
  // of the refresh cycle (via its internal auto-refresh timer and the
  // onAuthStateChange listener), which eliminates the race.

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signup = async (email: string, password: string, metadata?: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) throw error
  }

  const logout = async (shouldRedirect = true) => {
    explicitLogoutRef.current = true
    await supabase.auth.signOut()
    setUser(null)
    setIsAuthenticated(false)
    if (shouldRedirect) {
      window.location.href = '/'
    }
  }

  const navigateToLogin = (returnTo?: string) => {
    const returnPath = returnTo || window.location.href
    window.location.href = `/login?returnTo=${encodeURIComponent(returnPath)}`
  }

  const updateMe = async (updates: Record<string, any>) => {
    if (!user) throw new Error('Not authenticated')

    // Updates should already use snake_case keys matching DB columns
    const dbUpdates = { ...updates, updated_at: new Date().toISOString() }

    const { error } = await supabase
      .from('user_profiles')
      .update(dbUpdates)
      .eq('id', user.id)

    if (error) throw error

    // Refresh local user state
    setUser((prev) => (prev ? { ...prev, ...updates } : prev))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        login,
        signup,
        updateMe,
        checkAppState,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
