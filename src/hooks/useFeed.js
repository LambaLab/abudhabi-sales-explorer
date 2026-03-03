import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase }  from '../lib/supabase'
import { fromDbPost, fromDbReply, toDbPost, toDbReply } from '../lib/feedMappers'

const POST_SELECT = `
  *,
  author:profiles(display_name, avatar_url),
  replies(*, author:profiles(display_name, avatar_url))
`

/**
 * useFeed — drop-in replacement for usePostStore.
 * Identical API: { posts, addPost, removePost, getPost, patchPost, addReply, patchReply }
 *
 * Persistence: posts/replies written to Supabase only when status === 'done'.
 * Intermediate streaming states (analyzing/querying/explaining) stay in local state.
 *
 * @param {{ user: object|null }} props
 */
export function useFeed({ user }) {
  const [posts, setPosts] = useState([])
  const userRef           = useRef(user)

  // Keep userRef current without recreating callbacks
  useEffect(() => { userRef.current = user }, [user])

  // Load from Supabase on mount + real-time subscriptions
  useEffect(() => {
    supabase
      .from('posts')
      .select(POST_SELECT)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setPosts(data.map(fromDbPost))
      })

    const ch = supabase
      .channel('public:posts+replies')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const incomingId = payload.new.id
          // Secondary fetch to get author + replies join
          const { data } = await supabase
            .from('posts')
            .select(POST_SELECT)
            .eq('id', incomingId)
            .single()
          if (!data) return
          setPosts(prev => {
            if (prev.some(p => p.id === incomingId)) return prev // dedup own posts echoing back
            return [...prev, fromDbPost(data)]
          })
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id))
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'replies' },
        async (payload) => {
          const { data } = await supabase
            .from('replies')
            .select('*, author:profiles(display_name, avatar_url)')
            .eq('id', payload.new.id)
            .single()
          if (!data) return
          const reply = fromDbReply(data)
          setPosts(prev => prev.map(p => {
            if (p.id !== reply.postId) return p
            if ((p.replies ?? []).some(r => r.id === reply.id)) return p // dedup
            return { ...p, replies: [...(p.replies ?? []), reply] }
          }))
        })
      .subscribe()

    // Clear stale localStorage on mount
    try { localStorage.removeItem('ad_posts_v3') } catch { /* ignore */ }

    return () => supabase.removeChannel(ch)
  }, [])

  const addPost = useCallback((post) => {
    const u = userRef.current
    const enriched = {
      ...post,
      userId: u?.id ?? null,
      author: u ? {
        display_name: u.user_metadata?.full_name  ?? '',
        avatar_url:   u.user_metadata?.avatar_url ?? '',
      } : null,
    }
    setPosts(prev => [...prev.filter(p => p.id !== enriched.id), enriched])
  }, [])

  const patchPost = useCallback((id, partial) => {
    setPosts(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...partial } : p)
      if (partial.status === 'done' && userRef.current) {
        const post = next.find(p => p.id === id)
        if (post) {
          supabase.from('posts').upsert(toDbPost(post, userRef.current.id))
        }
      }
      return next
    })
  }, [])

  const removePost = useCallback((id) => {
    setPosts(prev => prev.filter(p => p.id !== id))
    supabase.from('posts').delete().eq('id', id)
  }, [])

  const getPost = useCallback((id) => posts.find(p => p.id === id), [posts])

  const addReply = useCallback((postId, reply) => {
    const u = userRef.current
    const enriched = {
      ...reply,
      userId: u?.id ?? null,
      author: u ? {
        display_name: u.user_metadata?.full_name  ?? '',
        avatar_url:   u.user_metadata?.avatar_url ?? '',
      } : null,
    }
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, replies: [...(p.replies ?? []), enriched] }
        : p
    ))
  }, [])

  const patchReply = useCallback((postId, replyId, partial) => {
    setPosts(prev => {
      const next = prev.map(p => {
        if (p.id !== postId) return p
        return {
          ...p,
          replies: (p.replies ?? []).map(r =>
            r.id === replyId ? { ...r, ...partial } : r
          ),
        }
      })
      if (partial.status === 'done' && userRef.current) {
        const post  = next.find(p => p.id === postId)
        const reply = post?.replies?.find(r => r.id === replyId)
        if (reply) {
          supabase.from('replies').upsert(toDbReply(reply, postId, userRef.current.id))
        }
      }
      return next
    })
  }, [])

  return { posts, addPost, removePost, getPost, patchPost, addReply, patchReply }
}
