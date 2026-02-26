import { DynamicChart } from './charts/DynamicChart'
import { ThinkingLabel } from './ThinkingLabel'

/**
 * Compact reply card rendered inside a PostCard thread.
 * Left-border accent, smaller text, no share button.
 */
export function ReplyCard({ reply }) {
  const isLoading = reply.status === 'analyzing' || reply.status === 'querying' || reply.status === 'explaining'

  return (
    <div className="ml-2 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-2">
      {/* Follow-up prompt label */}
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
        ↳ <span className="text-slate-700 dark:text-slate-300">{reply.prompt}</span>
      </p>

      {/* Content */}
      {reply.error ? (
        <p className="text-xs text-red-400">{reply.error}</p>
      ) : isLoading && !reply.analysisText ? (
        <ThinkingLabel />
      ) : (
        <>
          {reply.analysisText ? (
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
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
