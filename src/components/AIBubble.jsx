import { DynamicChart } from './charts/DynamicChart'
import { relativeTime } from '../utils/relativeTime'

const STATUS_LABELS = {
  analyzing:  'Analyzing…',
  querying:   'Querying data…',
  explaining: 'Writing…',
}

function TypingIndicator({ status }) {
  return (
    <div role="status" aria-live="polite" aria-label={STATUS_LABELS[status] ?? 'Loading'}>
      <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 inline-flex items-center gap-1">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
      </div>
      {STATUS_LABELS[status] && (
        <p aria-hidden="true" className="text-xs text-slate-400 mt-1 ml-1">{STATUS_LABELS[status]}</p>
      )}
    </div>
  )
}

export function AIBubble({ reply, onReply, postId }) {
  const isLoading = reply.status in STATUS_LABELS
  const isError   = reply.status === 'error'

  return (
    <div className="space-y-2">
      {/* Bubble row */}
      <div className="flex justify-start items-end gap-2">
        {/* Octopus avatar */}
        <div aria-hidden="true" className="shrink-0 h-6 w-6 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <img src="/octopus.svg" alt="" className="h-full w-full object-contain p-0.5" />
        </div>

        <div className="max-w-[80%]">
          {isLoading ? (
            <TypingIndicator status={reply.status} />
          ) : isError ? (
            <div role="alert" className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-red-400 leading-relaxed">
              {reply.error ?? 'Something went wrong.'}
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-sm leading-relaxed">
                {reply.analysisText}
              </div>
              <p className="text-xs text-slate-400 mt-1">{relativeTime(reply.createdAt)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chart — full width, below bubble, indented to align with bubble */}
      {reply.chartData?.length > 0 && (
        <div className="ml-8">
          <DynamicChart
            intent={reply.intent}
            chartData={reply.chartData}
            chartKeys={reply.chartKeys}
          />
        </div>
      )}

      {/* Clarify chips — inline below bubble */}
      {reply.clarifyOptions?.length > 0 && (
        <div className="flex flex-wrap gap-2 ml-8">
          {reply.clarifyOptions.map((option, i) => (
            <button
              key={`${i}-${option}`}
              type="button"
              onClick={() => onReply(postId, option)}
              className="rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:border-accent hover:text-accent transition-colors"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
