import { useState } from 'react'
import { DynamicChart } from './charts/DynamicChart'
import { buildShareUrl } from '../utils/deeplink'

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

export function PostCard({ post, onRemove }) {
  const [copied, setCopied] = useState(false)

  const isLoading = !post.analysisText && post.isStreaming !== false

  async function handleShare() {
    const url = buildShareUrl(post)
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const timeAgo = (() => {
    const diff = Date.now() - post.createdAt
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(post.createdAt).toLocaleDateString()
  })()

  return (
    <article className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 mb-1">{timeAgo}</p>
          <h2 className="text-base font-semibold text-white leading-snug">
            {post.title || post.prompt}
          </h2>
          {post.title && post.title !== post.prompt && (
            <p className="mt-0.5 text-xs text-slate-500 italic truncate">"{post.prompt}"</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
          {onRemove && (
            <button
              onClick={() => onRemove(post.id)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-700 hover:text-slate-300 transition-colors"
              title="Remove post"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Analyst text */}
          {post.analysisText ? (
            <div className="text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-wrap">
              {post.analysisText}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No analysis available.</p>
          )}

          {/* Chart */}
          {post.chartData?.length > 0 ? (
            <div className="mt-2">
              <DynamicChart
                intent={post.intent}
                chartData={post.chartData}
                chartKeys={post.chartKeys}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-600 text-center py-4">No chart data returned.</p>
          )}
        </>
      )}

      {/* Streaming indicator */}
      {post.isStreaming && post.analysisText && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex gap-0.5">
            <span className="animate-bounce [animation-delay:0ms]">·</span>
            <span className="animate-bounce [animation-delay:150ms]">·</span>
            <span className="animate-bounce [animation-delay:300ms]">·</span>
          </span>
          analysing…
        </div>
      )}
    </article>
  )
}
