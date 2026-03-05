import { useEffect, useRef, useState } from 'react'
import { PostFeed }  from '../components/PostFeed'
import { ChatInput } from '../components/ChatInput'
import { GuestWall } from '../components/GuestWall'

export default function FeedPage({ ctx }) {
  const {
    ready, user, signInWithGoogle,
    posts, removePost,
    analyze, analyzeReply, analyzeDeep, activePostId, cancel,
    settings, updateSettings, getDateRangeHint,
  } = ctx

  const isLoading  = activePostId !== null
  const feedEndRef = useRef(null)
  const mainRef    = useRef(null)
  const prevCount  = useRef(posts.length)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [newPostCount, setNewPostCount] = useState(0)

  // Auto-scroll to bottom when new post added
  useEffect(() => {
    if (posts.length > prevCount.current) {
      const newestPost = posts[posts.length - 1]
      if (newestPost?.userId === user?.id) {
        // Own post — auto-scroll as before
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      } else {
        // Remote post — show badge instead
        setNewPostCount(n => n + (posts.length - prevCount.current))
      }
    }
    prevCount.current = posts.length
  }, [posts.length, user?.id])

  // Scroll-to-bottom button visibility
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    function onScroll() {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
      setShowScrollDown(!nearBottom)
      if (nearBottom) setNewPostCount(0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function analyzeWithSettings(prompt) {
    return analyze(prompt + getDateRangeHint())
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 pt-4 pb-24 space-y-4">
          <PostFeed
            posts={posts}
            onReply={(postId, prompt) => analyzeReply(postId, prompt + getDateRangeHint())}
            activePostId={activePostId}
            onCancel={cancel}
            onDeepAnalysis={analyzeDeep}
            chartType={settings.chartType}
            user={user}
            onSignIn={signInWithGoogle}
            onDelete={removePost}
          />
          <GuestWall
            user={user}
            postsCount={posts.length}
            onSignIn={signInWithGoogle}
          />
          <div ref={feedEndRef} />
        </div>
      </main>

      {/* Scroll-to-latest button */}
      {showScrollDown && (
        <div className="absolute bottom-20 inset-x-0 flex justify-center z-20 pointer-events-none">
          <button
            type="button"
            onClick={() => feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white text-xs font-medium shadow-lg hover:opacity-90 transition-opacity"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
            Jump to latest
          </button>
        </div>
      )}

      {/* New posts badge — remote posts arrive while scrolled up */}
      {newPostCount > 0 && (
        <div className="absolute bottom-20 inset-x-0 flex justify-center z-20 pointer-events-none">
          <button
            type="button"
            aria-label={`${newPostCount} new post${newPostCount > 1 ? 's' : ''}`}
            onClick={() => {
              feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
              setNewPostCount(0)
            }}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white text-xs font-medium shadow-lg hover:opacity-90 transition-opacity"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/>
            </svg>
            {newPostCount} new post{newPostCount > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Only signed-in users can submit queries */}
      {user && (
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 z-10 bg-slate-50/75 dark:bg-[#0f172a]/75 backdrop-blur-md">
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
      )}
    </div>
  )
}
