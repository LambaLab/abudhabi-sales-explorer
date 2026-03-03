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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
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
