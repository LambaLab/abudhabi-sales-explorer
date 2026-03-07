import { useState, useRef, useEffect } from 'react'
import { Link }            from 'react-router-dom'
import { AnalysisBlock }   from './AnalysisBlock'
import { ChartSwitcher }   from './ChartSwitcher'
import { ReplyCard }       from './ReplyCard'
import { buildShareUrl }   from '../utils/deeplink'
import { stripHint }       from '../utils/stripHint'
import { ThinkingLabel }   from './ThinkingLabel'
import { SignInModal }     from './SignInModal'
import { initials }        from '../utils/initials'

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded bg-slate-700/50 ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-56 w-full mt-4" />
    </div>
  )
}

/** Inline follow-up input that lives at the bottom of each PostCard */
function ReplyInput({ postId, onSubmit, disabled, label = 'Ask a follow-up' }) {
  const [open, setOpen]   = useState(false)
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)
  const wrapperRef  = useRef(null)
  useEffect(() => {
    if (open) textareaRef.current?.focus()
  }, [open])

  // Collapse when clicking outside the expanded form
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!wrapperRef.current?.contains(e.target)) {
        setOpen(false)
        setValue('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(postId, trimmed)
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="text-sm text-slate-400 dark:text-slate-500 hover:text-accent dark:hover:text-accent transition-colors flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {label === 'Ask a follow-up' ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          )}
        </svg>
        {label}
      </button>
    )
  }

  return (
    <div ref={wrapperRef}>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 shadow-sm px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-colors"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e)
            if (e.key === 'Escape') { setOpen(false); setValue('') }
          }}
          placeholder="Ask a follow-up…"
          rows={1}
          disabled={disabled}
          style={{ resize: 'none', minHeight: '44px', maxHeight: '120px', overflowY: 'auto' }}
          className="flex-1 bg-transparent py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="shrink-0 my-2 mr-1 flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-30 hover:opacity-80 transition-opacity"
          aria-label="Submit follow-up"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </form>
    </div>
  )
}

/** Small circular author avatar with initials fallback */
function AuthorAvatar({ avatarUrl, displayName, imgError, onError }) {
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={displayName ?? 'User'}
        className="h-5 w-5 rounded-full object-cover shrink-0"
        onError={onError}
      />
    )
  }
  const abbr = initials(displayName ?? '')
  return (
    <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
      <span className="text-[9px] font-bold text-accent select-none leading-none">
        {abbr || '?'}
      </span>
    </div>
  )
}

export function PostCard({ post, onReply, isActive, onCancel, onDeepAnalysis, chartType = 'bar', onDelete, currentUser, user, onSignIn }) {
  const [copied, setCopied] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [authorImgError, setAuthorImgError] = useState(false)
  const [unseenCount, setUnseenCount] = useState(0)
  const bottomRef         = useRef(null)
  const scrollRef         = useRef(null)
  const didMountRef       = useRef(false)
  const isAtBottomRef     = useRef(true)
  const prevReplyCountRef = useRef(-1)   // -1 = "not yet initialised"

  function requireAuth(fn) {
    if (user) return fn()
    setShowSignIn(true)
  }

  // Unified reply-change handler: scroll on own reply, pill for others, skip initial mount
  useEffect(() => {
    const currentCount = post.replies?.length ?? 0
    if (prevReplyCountRef.current === -1) {
      // First run — initialise without scrolling
      prevReplyCountRef.current = currentCount
      return
    }
    const prevCount = prevReplyCountRef.current
    prevReplyCountRef.current = currentCount
    if (currentCount <= prevCount) return  // deletion or no change

    const newReplies = (post.replies ?? []).slice(prevCount)
    // !r.userId covers optimistic inserts that haven't yet received a userId from the DB
    const hasOwnReply = newReplies.some(r => !r.userId || r.userId === user?.id)

    if (hasOwnReply) {
      // Own reply just added — scroll after React paints so the node exists
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    } else if (isAtBottomRef.current) {
      // Other user's reply, user is already at bottom — just scroll
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      // Other user's reply, user is scrolled up — show pill
      setUnseenCount(c => c + newReplies.length)
    }
  }, [post.replies, user?.id])

  // Also scroll when streaming finishes (done status), only if user is at bottom
  const lastReply = post.replies?.at(-1)
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return }
    if (lastReply?.status === 'done' && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [lastReply?.status])

  const isBodyLoading = post.status === 'analyzing' || post.status === 'querying' || post.status === 'explaining'
  const isStreaming   = post.status === 'explaining'
  const isDone        = post.status === 'done'
  const isError       = post.status === 'error'

  // A reply is "in flight" if any reply does not have status 'done' or 'error'
  const hasActiveReply = post.replies?.some(
    r => r.status === 'analyzing' || r.status === 'querying' || r.status === 'explaining'
  ) ?? false

  async function handleShare() {
    try {
      const url = buildShareUrl(post)
      await navigator.clipboard.writeText(url).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* buildShareUrl may throw if post has no id */ }
  }

  function handleReplyScroll() {
    const el = scrollRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    if (isAtBottomRef.current) setUnseenCount(0)
  }

  const timeAgo = (() => {
    const diff = Date.now() - post.createdAt
    if (diff < 60_000)      return 'just now'
    if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(post.createdAt).toLocaleDateString()
  })()

  return (
    <article className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/30 p-5 space-y-4 shadow-sm dark:shadow-none">
      {/* Author bar */}
      {post.author && (
        <div className="flex items-center gap-2 mb-2">
          {post.userId ? (
            <Link
              to={`/profile/${post.userId}`}
              className="flex items-center gap-2 min-w-0 hover:opacity-75 transition-opacity"
              onClick={e => e.stopPropagation()}
            >
              <AuthorAvatar
                avatarUrl={post.author.avatar_url}
                displayName={post.author.display_name}
                imgError={authorImgError}
                onError={() => setAuthorImgError(true)}
              />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {post.author.display_name}
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <AuthorAvatar
                avatarUrl={post.author.avatar_url}
                displayName={post.author.display_name}
                imgError={authorImgError}
                onError={() => setAuthorImgError(true)}
              />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {post.author.display_name}
              </span>
            </div>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(post.id)}
              className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors shrink-0"
              aria-label="Delete post"
            >
              Delete
            </button>
          )}
        </div>
      )}
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{timeAgo}</p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
            {post.title || stripHint(post.prompt)}
          </h2>
          {post.title && post.title !== post.prompt && (
            <div className="mt-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border-l-2 border-accent px-3 py-2">
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">"{stripHint(post.prompt)}"</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isActive && onCancel && (
            <button
              onClick={() => onCancel(post.id)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
              title="Cancel analysis"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
          {isDone && (
            <button
              onClick={handleShare}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-white transition-colors"
              title="Copy shareable link"
            >
              {copied ? (
                <svg className="h-4 w-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {isError ? (
        <p className="text-sm text-red-400">{post.error ?? 'Something went wrong.'}</p>
      ) : isBodyLoading ? (
        <ThinkingLabel />
      ) : (
        <>
          {post.analysisText ? (
            <>
              <AnalysisBlock
                text={post.isExpanded && post.fullText ? post.fullText : post.analysisText}
                adaptiveFormat={post.intent?.adaptiveFormat}
              />

              {/* Deeper analysis / Explore alternatives */}
              {(isDone || post.status === 'deepening') && (
                post.noData ? (
                  post.suggestions?.length > 0 && onReply && (
                    <button
                      onClick={() => requireAuth(() => onReply(post.id, post.suggestions[0].query))}
                      className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-accent dark:hover:text-accent transition-colors mt-1"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.346.346a7.5 7.5 0 01-2.121 2.121 5 5 0 01-7.072 0l-.346-.346a5 5 0 010-7.072z"/>
                      </svg>
                      Explore alternatives
                    </button>
                  )
                ) : (
                  onDeepAnalysis && (
                    <button
                      onClick={() => onDeepAnalysis(post.id)}
                      disabled={post.status === 'deepening'}
                      className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-accent dark:hover:text-accent transition-colors disabled:opacity-40 mt-1"
                    >
                      {post.status === 'deepening' ? (
                        <>
                          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3"/>
                          </svg>
                          Loading deeper analysis…
                        </>
                      ) : post.isExpanded ? (
                        <>
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/>
                          </svg>
                          Less
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                          </svg>
                          Deeper analysis
                        </>
                      )}
                    </button>
                  )
                )
              )}
            </>
          ) : (
            !isStreaming && <p className="text-sm text-slate-500 italic">No analysis available.</p>
          )}

          <ChartSwitcher post={post} />
        </>
      )}

      {/* Streaming indicator */}
      {isStreaming && post.analysisText && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex gap-0.5">
            <span className="animate-bounce [animation-delay:0ms]">·</span>
            <span className="animate-bounce [animation-delay:150ms]">·</span>
            <span className="animate-bounce [animation-delay:300ms]">·</span>
          </span>
          analysing…
        </div>
      )}

      {/* ── Thread: replies ── */}
      {post.replies?.length > 0 && (
        <div className="relative border-t border-slate-200 dark:border-slate-700/40 pt-2">
          <div
            ref={scrollRef}
            onScroll={handleReplyScroll}
            className={`max-h-[420px] overflow-y-auto scroll-smooth space-y-3 pr-1${unseenCount > 0 ? ' pb-8' : ''}`}
          >
            {post.replies.map(reply => (
              <ReplyCard key={reply.id} reply={reply} onReply={onReply} postId={post.id} />
            ))}
            <div ref={bottomRef} />
          </div>
          {unseenCount > 0 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
              <button
                onClick={() => {
                  bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                  setUnseenCount(0)
                }}
                className="pointer-events-auto bg-accent text-white text-xs font-medium rounded-full px-3 py-1.5 shadow-md flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                ↓ {unseenCount} new {unseenCount === 1 ? 'reply' : 'replies'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── No-data suggestion rows ── */}
      {onReply && isDone && post.noData && post.suggestions?.length > 0 && !post.replies?.length && (
        <div className="flex flex-col gap-1.5 pt-1">
          {post.suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => requireAuth(() => onReply(post.id, s.query))}
              disabled={hasActiveReply}
              className="flex items-center gap-2.5 w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              {s.label}
            </button>
          ))}
          {/* "Something else…" — last item, expands to reply input inline */}
          <ReplyInput
            postId={post.id}
            onSubmit={onReply}
            disabled={hasActiveReply}
            label="Something else…"
          />
        </div>
      )}

      {/* ── Clarification chips (shown when clarifyOptions exist and no replies yet) ── */}
      {onReply && isDone && post.clarifyOptions?.length > 0 && !post.replies?.length && (
        <div className="flex flex-wrap gap-2 pt-1">
          {post.clarifyOptions.map((option, i) => (
            <button
              key={`${i}-${option}`}
              type="button"
              onClick={() => requireAuth(() => onReply(post.id, option))}
              disabled={hasActiveReply}
              className="rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {/* ── Inline reply input (hidden while no-data suggestions are visible) ── */}
      {onReply && isDone && !(post.noData && !post.replies?.length) && (
        <div className="pt-1">
          {user ? (
            <ReplyInput postId={post.id} onSubmit={onReply} disabled={hasActiveReply} />
          ) : (
            <button
              onClick={() => setShowSignIn(true)}
              className="text-sm text-slate-400 dark:text-slate-500 hover:text-accent dark:hover:text-accent transition-colors flex items-center gap-1.5"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              Ask a follow-up
            </button>
          )}
        </div>
      )}

      <SignInModal
        open={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSignIn={() => { setShowSignIn(false); onSignIn?.() }}
      />
    </article>
  )
}
