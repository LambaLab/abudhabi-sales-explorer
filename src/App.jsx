import { useEffect } from 'react'
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
  const { posts, addPost, removePost, getPost } = usePostStore()
  const { analyze, status, error: analysisError, pendingPost } = useAnalysis(meta)

  const isLoading = ['analyzing', 'querying', 'explaining'].includes(status)

  // Handle deeplink: if URL has ?post=... show that single post
  const { postId, post: urlPost } = parseShareUrl()
  const deeplinkPost = postId ? (getPost(postId) ?? urlPost) : null

  // If we landed on a deeplink and the post isn't in localStorage yet, save it
  useEffect(() => {
    if (urlPost && !getPost(urlPost.id)) {
      addPost(urlPost)
    }
  }, []) // run once on mount

  // Deeplink view: show single post
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

  // Main view
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 sticky top-0 z-10 backdrop-blur bg-[#0f172a]/90">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Abu Dhabi Sales Explorer</h1>
            <p className="text-xs text-slate-500 mt-0.5">104,848 transactions · 2019–2026</p>
          </div>
          {dbError && (
            <span className="text-xs text-red-400">DB error: {dbError}</span>
          )}
          {!ready && !dbError && (
            <span className="text-xs text-slate-500 animate-pulse">Loading data…</span>
          )}
        </div>
      </header>

      {/* Chat area */}
      <main className="mx-auto max-w-2xl px-6 py-6 space-y-6">
        {/* Input section */}
        <section className="space-y-3">
          <SmartTopics onSelect={analyze} isLoading={isLoading || !ready} />
          <ChatInput onSubmit={analyze} isLoading={isLoading || !ready} />
          {analysisError && (
            <p className="text-xs text-red-400 px-1">{analysisError}</p>
          )}
        </section>

        {/* Post feed */}
        <PostFeed
          posts={posts}
          pendingPost={pendingPost}
          onRemove={removePost}
        />
      </main>
    </div>
  )
}
