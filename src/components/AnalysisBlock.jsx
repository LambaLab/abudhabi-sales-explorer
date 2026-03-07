import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

/** Shared markdown renderer with Tailwind prose styles */
function Md({ children }) {
  if (!children) return null
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeSanitize]}
      components={{
        p: ({ children }) => (
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-2 last:mb-0">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="text-sm text-slate-700 dark:text-slate-300 list-disc pl-4 space-y-1 mb-2">
            {children}
          </ul>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

/** Accent-coloured recommendation block shared by all formats */
function Recommendation({ text }) {
  if (!text) return null
  return (
    <div className="rounded-lg bg-accent/10 dark:bg-accent/20 border-l-2 border-accent px-3 py-2 mt-3">
      <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Recommendation</p>
      <Md>{text}</Md>
    </div>
  )
}

/** Trend format: headline → keyMetric pills → analysis → recommendation */
function TrendBlock({ data }) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
        {data.headline}
      </h3>
      {data.keyMetrics?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.keyMetrics.map((m, i) => (
            <div key={i} className="rounded-lg bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{m.label}</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{m.value}</p>
            </div>
          ))}
        </div>
      )}
      {data.analysis && <Md>{data.analysis}</Md>}
      <Recommendation text={data.recommendation} />
    </div>
  )
}

/** Comparison format: headline → ranked list → analysis → recommendation */
function ComparisonBlock({ data }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
        {data.headline}
      </h3>
      {data.ranking?.length > 0 && (
        <ul className="space-y-1.5 list-none" role="list">
          {data.ranking.map(r => (
            <li
              key={r.rank}
              role="listitem"
              aria-label={`Rank ${r.rank}: ${r.name}, ${r.metric}${r.note ? `, ${r.note}` : ''}`}
              className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
            >
              <span className="text-base shrink-0" aria-hidden="true">
                {medals[r.rank - 1] ?? (
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {r.rank}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white flex-1 min-w-0 truncate">
                {r.name}
              </span>
              <span className="text-sm font-mono font-medium text-accent shrink-0">{r.metric}</span>
              {r.note && (
                <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{r.note}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.analysis && <Md>{data.analysis}</Md>}
      <Recommendation text={data.recommendation} />
    </div>
  )
}

/** Investment format: headline → summary → marketData → riskFactors → recommendation */
function InvestmentBlock({ data }) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
        {data.headline}
      </h3>
      {data.summary && (
        <p className="text-sm text-slate-600 dark:text-slate-300 italic">{data.summary}</p>
      )}
      {data.marketData && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Market Data
          </p>
          <Md>{data.marketData}</Md>
        </div>
      )}
      {data.riskFactors && (
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Risk Factors
          </p>
          <Md>{data.riskFactors}</Md>
        </div>
      )}
      <Recommendation text={data.recommendation} />
    </div>
  )
}

/** Factual format: large headline answer → plain answer → optional context */
function FactualBlock({ data }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
        {data.headline}
      </h3>
      {data.answer && (
        <p className="text-sm text-slate-700 dark:text-slate-300">{data.answer}</p>
      )}
      {data.context && <Md>{data.context}</Md>}
    </div>
  )
}

/**
 * AnalysisBlock — renders the text from post.analysisText or post.fullText.
 *
 * - If text is valid JSON (full-mode structured response), renders rich UI.
 * - If text is plain string (short-mode or legacy), renders as plain <p>.
 * - adaptiveFormat drives which rich layout to use.
 *
 * JSON extraction is deliberately robust:
 * 1. Strips optional markdown fences (```json … ```) Claude sometimes adds
 * 2. Extracts the first { … } substring to handle any preamble/postamble text
 * This mirrors what /api/explain's clarify mode already does client-side.
 */
export function AnalysisBlock({ text, adaptiveFormat }) {
  if (!text) return null

  let parsed = null

  // Strip markdown code fences if present, then find the first JSON object
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  const jsonStart = stripped.indexOf('{')
  const jsonEnd   = stripped.lastIndexOf('}')

  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      const obj = JSON.parse(stripped.slice(jsonStart, jsonEnd + 1))
      if (typeof obj === 'object' && !Array.isArray(obj)) parsed = obj
    } catch {
      // not valid JSON in the extracted slice — fall through to plain text
    }
  }

  if (!parsed) {
    return (
      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    )
  }

  switch (adaptiveFormat) {
    case 'comparison': return <ComparisonBlock data={parsed} />
    case 'investment': return <InvestmentBlock data={parsed} />
    case 'factual':    return <FactualBlock data={parsed} />
    default:           return <TrendBlock data={parsed} />
  }
}
