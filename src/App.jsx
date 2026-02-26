import { useEffect, useRef } from 'react'
import { useDuckDB }    from './hooks/useDuckDB'
import { useAppData }   from './hooks/useAppData'
import { useAnalysis }  from './hooks/useAnalysis'
import { usePostStore } from './hooks/usePostStore'
import { ChatInput }    from './components/ChatInput'
import { SmartTopics }  from './components/SmartTopics'
import { PostFeed }     from './components/PostFeed'
import { PostCard }     from './components/PostCard'
import { parseShareUrl } from './utils/deeplink'

export default function App() {
  const { ready, error: dbError } = useDuckDB()
  const { meta }                  = useAppData(ready)

  const store = usePostStore()
  const { posts, addPost, removePost, getPost, patchPost, addReply, patchReply } = store

  const { analyze, analyzeReply, activePostId } = useAnalysis(meta, {
    addPost, patchPost, addReply, patchReply, getPost,
  })

  const isLoading  = activePostId !== null
  const feedEndRef = useRef(null)
  const prevCount  = useRef(posts.length)

  // Auto-scroll to bottom when a new top-level post is added
  useEffect(() => {
    if (posts.length > prevCount.current) {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevCount.current = posts.length
  }, [posts.length])

  // Handle deeplink: if URL has ?post=... show that single post
  const { postId: deeplinkPostId, post: urlPost } = parseShareUrl()
  const deeplinkPost = deeplinkPostId ? (getPost(deeplinkPostId) ?? urlPost) : null

  useEffect(() => {
    if (urlPost && !getPost(urlPost.id)) addPost(urlPost)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: runs
    // once on mount to seed the store from a deeplink URL. addPost/getPost are
    // stable references; urlPost is from window.location (immutable after mount).
  }, [])

  // ── Deeplink view ──────────────────────────────────────────────────────────
  if (deeplinkPost) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100">
        <header className="border-b border-slate-800 px-6 py-4">
          <div className="mx-auto max-w-2xl flex items-center justify-between">
            <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Back to explorer
            </a>
            <span className="text-xs text-slate-600">Abu Dhabi Sales Explorer</span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-6 py-8">
          <PostCard post={deeplinkPost} />
        </main>
      </div>
    )
  }

  // ── Main view: h-screen flex column ───────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#0f172a] text-slate-100 overflow-hidden">

      {/* ── Sticky header ── */}
      <header className="shrink-0 border-b border-slate-800 px-6 py-3 backdrop-blur bg-[#0f172a]/95 z-10">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">Abu Dhabi Sales Explorer</h1>
            <p className="text-xs text-slate-500 mt-0.5">104,848 transactions · 2019–2026</p>
          </div>
          <div className="flex items-center gap-3">
            {dbError && (
              <span className="text-xs text-red-400">DB error: {dbError}</span>
            )}
            {!ready && !dbError && (
              <span className="text-xs text-slate-500 animate-pulse">Loading data…</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Scrollable feed (oldest at top → newest at bottom) ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
          <PostFeed
            posts={posts}
            onRemove={removePost}
            onReply={(postId, prompt) => analyzeReply(postId, prompt)}
          />
          {/* Sentinel element — scrolled into view when a new post is added */}
          <div ref={feedEndRef} />
        </div>
      </main>

      {/* ── Sticky bottom input bar ── */}
      <div className="shrink-0 border-t border-slate-800 bg-[#0f172a]/95 backdrop-blur px-4 py-3 z-10">
        <div className="mx-auto max-w-2xl space-y-2">
          <SmartTopics onSelect={analyze} isLoading={isLoading || !ready} />
          <ChatInput   onSubmit={analyze} isLoading={isLoading || !ready} />
        </div>
      </div>

    </div>
  )
}
