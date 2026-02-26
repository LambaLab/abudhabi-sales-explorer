import { useState, useRef, useEffect } from 'react'
import { DynamicChart }    from './charts/DynamicChart'
import { InlineDateRange } from './charts/InlineDateRange'
import { ReplyCard }       from './ReplyCard'
import { buildShareUrl }   from '../utils/deeplink'
import { ThinkingLabel }   from './ThinkingLabel'

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
function ReplyInput({ postId, onSubmit, disabled }) {
  const [open, setOpen]   = useState(false)
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)
  useEffect(() => {
    if (open) textareaRef.current?.focus()
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
        className="text-sm text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        Ask a follow-up
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 ml-2 pl-3 border-l-2 border-accent/40"
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
        className="flex-1 resize-none bg-transparent border-b border-slate-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-400 py-1"
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="text-sm text-accent disabled:opacity-30 pb-1 hover:opacity-80 transition-opacity"
      >
        →
      </button>
    </form>
  )
}

export function PostCard({ post, onReply, isActive, onCancel, onDeepAnalysis, chartType = 'bar' }) {
  const [copied, setCopied] = useState(false)
  const [dateRange, setDateRange] = useState({ dateFrom: '', dateTo: '' })

  const isBodyLoading = post.status === 'analyzing' || post.status === 'querying' || post.status === 'explaining'
  const isStreaming   = post.status === 'explaining'
  const isDone        = post.status === 'done'
  const isError       = post.status === 'error'

  // Filter chartData by local dateRange selection (client-side, no re-query)
  const filteredChartData = (() => {
    const data = post.chartData
    if (!data?.length) return data
    const { dateFrom, dateTo } = dateRange
    if (!dateFrom && !dateTo) return data
    return data.filter(row => {
      const m = row.month ?? ''
      if (dateFrom && m < dateFrom) return false
      if (dateTo   && m > dateTo)   return false
      return true
    })
  })()

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

  const timeAgo = (() => {
    const diff = Date.now() - post.createdAt
    if (diff < 60_000)      return 'just now'
    if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(post.createdAt).toLocaleDateString()
  })()

  return (
    <article className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/30 p-5 space-y-4 shadow-sm dark:shadow-none">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{timeAgo}</p>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
            {post.title || post.prompt}
          </h2>
          {post.title && post.title !== post.prompt && (
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 italic truncate">"{post.prompt}"</p>
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
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {post.isExpanded && post.fullText ? post.fullText : post.analysisText}
              </div>

              {/* Deeper analysis link */}
              {(isDone || post.status === 'deepening') && onDeepAnalysis && (
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
              )}
            </>
          ) : (
            !isStreaming && <p className="text-sm text-slate-500 italic">No analysis available.</p>
          )}

          {post.chartData?.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="flex justify-end">
                <InlineDateRange value={dateRange} onChange={setDateRange} />
              </div>
              <DynamicChart
                intent={post.intent}
                chartData={filteredChartData}
                chartKeys={post.chartKeys}
                chartType={chartType}
              />
            </div>
          )}
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
        <div className="space-y-4 pt-1 border-t border-slate-700/40">
          {post.replies.map(reply => (
            <ReplyCard key={reply.id} reply={reply} />
          ))}
        </div>
      )}

      {/* ── Inline reply input (only when post is done and onReply provided) ── */}
      {onReply && isDone && (
        <div className="pt-1">
          <ReplyInput postId={post.id} onSubmit={onReply} disabled={hasActiveReply} />
        </div>
      )}
    </article>
  )
}
