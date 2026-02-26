import { useState, useCallback } from 'react'

const STORAGE_KEY = 'ad_posts_v3'  // bumped: schema changed (shortText, fullText, isExpanded, summaryStats)

function loadPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePosts(posts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  } catch (err) {
    console.warn('[usePostStore] localStorage write failed:', err)
  }
}

export function usePostStore() {
  const [posts, setPosts] = useState(() => loadPosts())

  // Append to END — feed is oldest-at-top, newest-at-bottom
  const addPost = useCallback((post) => {
    setPosts(prev => {
      // Upsert: remove any existing entry with the same id, then append at end.
      // This ensures in-progress posts can be created once and not duplicated
      // if addPost is accidentally called twice with the same id.
      const next = [...prev.filter(p => p.id !== post.id), post]
      savePosts(next)
      return next
    })
  }, [])

  const removePost = useCallback((id) => {
    setPosts(prev => {
      const next = prev.filter(p => p.id !== id)
      savePosts(next)
      return next
    })
  }, [])

  // NOTE: getPost closes over `posts` and is recreated on every mutation.
  // This is intentional — it always returns current state. Consumers should
  // not memoize getPost or pass it to stable callbacks without acknowledging
  // it changes on every posts update.
  const getPost = useCallback((id) => {
    return posts.find(p => p.id === id)
  }, [posts])

  // Merge partial fields into a top-level post by id
  const patchPost = useCallback((id, partial) => {
    setPosts(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...partial } : p)
      savePosts(next)
      return next
    })
  }, [])

  // Push a new reply onto post.replies
  const addReply = useCallback((postId, reply) => {
    setPosts(prev => {
      const next = prev.map(p =>
        p.id === postId
          ? { ...p, replies: [...(p.replies ?? []), reply] }
          : p
      )
      savePosts(next)
      return next
    })
  }, [])

  // Merge partial fields into a reply nested inside a post
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
      savePosts(next)
      return next
    })
  }, [])

  return { posts, addPost, removePost, getPost, patchPost, addReply, patchReply }
}
