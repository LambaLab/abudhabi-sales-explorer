import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useAuth — wraps Supabase Auth for Google OAuth.
 * Returns: { user, loading, signInWithGoogle, signOut }
 */
export function useAuth() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Hydrate user from any existing session on mount (e.g. after OAuth redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Subscribe to auth state changes (sign-in after OAuth redirect, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_IN' && session?.user) {
        const u = session.user
        supabase
          .from('profiles')
          .upsert(
            {
              id:           u.id,
              display_name: u.user_metadata?.full_name  ?? '',
              avatar_url:   u.user_metadata?.avatar_url ?? '',
            },
            { onConflict: 'id' }
          )
          .then(null, err => console.error('[useAuth] profile upsert failed:', err))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  function signInWithGoogle() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  function signOut() {
    supabase.auth.signOut()
  }

  return { user, loading, signInWithGoogle, signOut }
}
