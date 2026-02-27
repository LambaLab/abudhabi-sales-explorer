/* global __APP_VERSION__ */
import { useEffect, useRef, useState } from 'react'
import { useDuckDB }    from './hooks/useDuckDB'
import { useAppData }   from './hooks/useAppData'
import { useAnalysis }  from './hooks/useAnalysis'
import { usePostStore } from './hooks/usePostStore'
import { useTheme }     from './hooks/useTheme'
import { useSettings }  from './hooks/useSettings'
import { ChatInput }    from './components/ChatInput'
import { PostFeed }     from './components/PostFeed'
import { PostCard }     from './components/PostCard'
import { ChartTab }     from './components/ChartTab'
import { parseShareUrl } from './utils/deeplink'

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { settings, updateSettings, getDateRangeHint } = useSettings()

  const { ready, error: dbError } = useDuckDB()
  const { meta }                  = useAppData(ready)

  const store = usePostStore()
  const { posts, addPost, removePost, getPost, patchPost, addReply, patchReply } = store

  const { analyze, analyzeReply, analyzeDeep, activePostId, cancel } = useAnalysis(meta, {
    addPost, patchPost, addReply, patchReply, getPost,
  })

  const [activeTab, setActiveTab] = useState('feed') // 'feed' | 'chart'

  const isLoading  = activePostId !== null
  const feedEndRef = useRef(null)
  const prevCount  = useRef(posts.length)

  // Auto-scroll to bottom when a new post is added
  useEffect(() => {
    if (posts.length > prevCount.current) {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevCount.current = posts.length
  }, [posts.length])

  // Inject default date range hint into analyze prompt
  function analyzeWithSettings(prompt) {
    return analyze(prompt + getDateRangeHint())
  }

  // Handle deeplink
  const { postId: deeplinkPostId, post: urlPost } = parseShareUrl()
  const deeplinkPost = deeplinkPostId ? (getPost(deeplinkPostId) ?? urlPost) : null

  useEffect(() => {
    if (urlPost && !getPost(urlPost.id)) addPost(urlPost)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: runs
    // once on mount; addPost/getPost are stable references; urlPost is immutable
  }, [])

  // ── Deeplink view ──────────────────────────────────────────────────────────
  if (deeplinkPost) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100">
        <header className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="mx-auto max-w-2xl flex items-center justify-between">
            <a href="/" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Back to explorer
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-6 py-8">
          <PostCard post={deeplinkPost} />
        </main>
      </div>
    )
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 bg-white/80 dark:bg-[#0f172a]/95 backdrop-blur z-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">

          {/* Octopus logo */}
          <div className="flex items-center gap-2 shrink-0">
            <img
              src="/octopus.png"
              alt="Octopus"
              className="h-8 w-8 object-contain"
              onError={e => {
                e.currentTarget.style.display = 'none'
                const sibling = e.currentTarget.nextSibling
                if (sibling) sibling.style.display = 'inline'
              }}
            />
            <span style={{ display: 'none' }} className="text-2xl select-none">🐙</span>
            {dbError && <span className="text-xs text-red-400 hidden sm:inline">DB error: {dbError}</span>}
            {!ready && !dbError && <span className="text-xs text-slate-400 animate-pulse hidden sm:inline">Loading…</span>}
          </div>

          {/* Feed / Chart tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 p-1">
            {['feed', 'charts'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Version + Theme toggle */}
          <div className="shrink-0 flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono hidden sm:inline select-none">
            v {__APP_VERSION__}
          </span>
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            )}
          </button>
          </div>
        </div>
      </header>

      {/* ── Feed tab ── */}
      {activeTab === 'feed' && (
        <>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
              <PostFeed
                posts={posts}
                onReply={(postId, prompt) => analyzeReply(postId, prompt + getDateRangeHint())}
                activePostId={activePostId}
                onCancel={cancel}
                onDeepAnalysis={analyzeDeep}
                chartType={settings.chartType}
              />
              <div ref={feedEndRef} />
            </div>
          </main>

          <div className="shrink-0 px-4 py-3 z-10">
            <div className="mx-auto max-w-2xl">
              <ChatInput
                onSubmit={analyzeWithSettings}
                onStop={cancel}
                isLoading={isLoading || !ready}
                settings={settings}
                onSettingsChange={updateSettings}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Charts tab ── */}
      {activeTab === 'charts' && (
        <main className="flex-1 overflow-y-auto">
          <ChartTab meta={meta} defaultDateRange={settings.defaultDateRange} />
        </main>
      )}

    </div>
  )
}
