import { useState, useEffect } from 'react'
import { supabase }     from '../lib/supabase'
import { fromDbPost }   from '../lib/feedMappers'

const POST_SELECT = `
  *,
  author:profiles(display_name, avatar_url),
  replies(*, author:profiles(display_name, avatar_url))
`

/**
 * useProfileFeed — fetch a user's profile info, posts, and reply-posts.
 *
 * @param {string|null} userId — auth user ID (from URL params)
 * @returns {{ profile, posts, replyPosts, loading, error }}
 */
export function useProfileFeed(userId) {
  const [profile,    setProfile]    = useState(null)
  const [posts,      setPosts]      = useState([])
  const [replyPosts, setReplyPosts] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Parallel: profile info + user's posts + reply posts
    Promise.all([
      // 1. Profile info
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', userId)
        .single()
        .then(({ data, error: err }) => {
          if (err) { setError(err.message ?? 'Failed to load profile'); return }
          setProfile(data ?? null)
        }),

      // 2. Posts authored by this user
      supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .then(({ data, error: err }) => {
          if (err) { setError(err.message ?? 'Failed to load posts'); return }
          setPosts(data ? data.map(fromDbPost) : [])
        }),

      // 3. Posts this user has replied to (two-step)
      supabase
        .from('replies')
        .select('post_id')
        .eq('user_id', userId)
        .then(({ data: replyRows, error: err }) => {
          if (err) { setError(err.message ?? 'Failed to load replies'); return }
          if (!replyRows?.length) { setReplyPosts([]); return }
          const postIds = [...new Set(replyRows.map(r => r.post_id))]
          return supabase
            .from('posts')
            .select(POST_SELECT)
            .in('id', postIds)
            .order('created_at', { ascending: false })
            .then(({ data, error: err2 }) => {
              if (err2) { setError(err2.message ?? 'Failed to load reply posts'); return }
              setReplyPosts(data ? data.map(fromDbPost) : [])
            })
        }),
    ]).finally(() => setLoading(false))
  }, [userId])

  return { profile, posts, replyPosts, loading, error }
}
