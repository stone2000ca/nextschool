'use client'

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  full_name?: string
  role?: string
  subscriptionPlan?: string
  tokenBalance?: number
  maxSessions?: number
  stripeCustomerId?: string
  lastSignedOn?: string
  profileRegion?: string
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
        tokenBalance: 3,
        maxSessions: 3,
      }
    }

    // Convert snake_case DB row to camelCase for frontend compat
    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      fullName: data.full_name,
      role: data.role,
      subscriptionPlan: data.subscription_plan,
      tokenBalance: data.token_balance,
      maxSessions: data.max_sessions,
      stripeCustomerId: data.stripe_customer_id,
      lastSignedOn: data.last_signed_on,
      profileRegion: data.profile_region,
      created_date: data.created_date,
      updated_date: data.updated_date,
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') &&
          session?.user
        ) {
          const profile = await fetchUserProfile(session.user)
          setUser(profile)
          setIsAuthenticated(true)
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
            // valid session.  A stale gotrue-js in-memory refresh token can
            // trigger a spurious SIGNED_OUT even though the middleware just
            // set fresh cookies.
            try {
              const { data: { user: recovered } } = await supabase.auth.getUser()
              if (recovered) {
                // Cookies are still valid — re-establish auth state
                const profile = await fetchUserProfile(recovered)
                setUser(profile)
                setIsAuthenticated(true)
                setIsLoadingAuth(false)
                return
              }
            } catch {
              // getUser also failed — session is truly gone
            }
            setUser(null)
            setIsAuthenticated(false)
            setIsLoadingAuth(false)
          }
        }
      }
    )

    // Also run an explicit check with getUser() for server-validated session
    checkAppState()

    return () => subscription.unsubscribe()
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

    // Convert camelCase to snake_case for DB
    const snakeUpdates: Record<string, any> = {}
    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)
      snakeUpdates[snakeKey] = value
    }
    snakeUpdates.updated_date = new Date().toISOString()

    const { error } = await supabase
      .from('user_profiles')
      .update(snakeUpdates)
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
