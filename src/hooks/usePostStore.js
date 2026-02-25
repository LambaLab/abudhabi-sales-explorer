import { useState, useCallback } from 'react'

const STORAGE_KEY = 'ad_posts_v1'

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
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

export function usePostStore() {
  const [posts, setPosts] = useState(() => loadPosts())

  const addPost = useCallback((post) => {
    setPosts(prev => {
      const next = [post, ...prev.filter(p => p.id !== post.id)]
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

  const getPost = useCallback((id) => {
    return loadPosts().find(p => p.id === id)
  }, [])

  return { posts, addPost, removePost, getPost }
}
