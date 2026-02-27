import { DynamicChart } from './charts/DynamicChart'
import { ThinkingLabel } from './ThinkingLabel'

/**
 * Reply card rendered inside a PostCard thread.
 * Left-border indent, same text size as main post, block-quote prompt.
 */
export function ReplyCard({ reply }) {
  const isLoading = reply.status === 'analyzing' || reply.status === 'querying' || reply.status === 'explaining'

  return (
    <div className="ml-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-3">
      {/* Follow-up prompt — block-quote style, softer accent */}
      <div className="rounded-md bg-slate-50 dark:bg-slate-800/40 border-l-2 border-accent/60 px-2.5 py-1.5">
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">"{reply.prompt}"</p>
      </div>

      {/* Content */}
      {reply.error ? (
        <p className="text-sm text-red-400">{reply.error}</p>
      ) : isLoading && !reply.analysisText ? (
        <ThinkingLabel />
      ) : (
        <>
          {reply.analysisText ? (
            <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
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
    </div>
  )
}
