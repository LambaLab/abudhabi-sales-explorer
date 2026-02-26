import { DynamicChart } from './charts/DynamicChart'

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded bg-slate-700/50 ${className}`} />
}

/**
 * Compact reply card rendered inside a PostCard thread.
 * Left-border accent, smaller text, no share button.
 */
export function ReplyCard({ reply }) {
  const isLoading = reply.status === 'analyzing' || reply.status === 'querying' || reply.status === 'explaining'
  const isStreaming = reply.status === 'explaining'

  return (
    <div className="ml-2 pl-3 border-l-2 border-slate-700 space-y-2">
      {/* Follow-up prompt label */}
      <p className="text-xs text-slate-400 font-medium">
        ↳ <span className="text-slate-300">{reply.prompt}</span>
      </p>

      {/* Content */}
      {reply.error ? (
        <p className="text-xs text-red-400">{reply.error}</p>
      ) : isLoading && !reply.analysisText ? (
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ) : (
        <>
          {reply.analysisText ? (
            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
              {reply.analysisText}
            </div>
          ) : null}

          {reply.chartData?.length > 0 && (
            <div className="mt-2">
              <DynamicChart
                intent={reply.intent}
                chartData={reply.chartData}
                chartKeys={reply.chartKeys}
              />
            </div>
          )}
        </>
      )}

      {/* Streaming dot */}
      {isStreaming && reply.analysisText && (
        <span className="inline-flex gap-0.5 text-slate-500">
          <span className="animate-bounce [animation-delay:0ms]">·</span>
          <span className="animate-bounce [animation-delay:150ms]">·</span>
          <span className="animate-bounce [animation-delay:300ms]">·</span>
        </span>
      )}
    </div>
  )
}
