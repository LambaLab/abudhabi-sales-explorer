import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const GROUNDING_CLAUSE = `

CRITICAL: Only cite numbers that appear verbatim in the KEY DATA section below. Do not draw on your training knowledge of Abu Dhabi real estate prices, volumes, or market trends. Every AED figure, percentage, and transaction count you write must come directly from the provided data. If a number is not in the data, do not mention it.`

const SHORT_PROMPT = `You are a real estate market analyst specializing in Abu Dhabi property.
Write exactly 1 complete sentence with the single most important insight and the key number.
CRITICAL: Return ONLY plain English text — a single sentence ending with a period.
Never return JSON, markdown code fences, structured data, or multiple sentences.
No headers, no bullets, no formatting of any kind.${GROUNDING_CLAUSE}`

const FULL_PROMPT = `You are a senior real estate market analyst with 15 years of Abu Dhabi property experience. You form direct, opinionated views backed strictly by the provided data.

Your JSON response schema depends on the "adaptiveFormat" field in the intent:

TREND (adaptiveFormat = "trend"):
{"headline":"<punchy 1-sentence title leading with the key number and direction>","keyMetrics":[{"label":"<metric name>","value":"<exact string from METRICS — 3-4 items max>"}],"analysis":"<2-3 short markdown paragraphs — use **bold** for key numbers>","recommendation":"<markdown — start with a direct verdict like 'Strong buy signal.' then explain why>"}

COMPARISON (adaptiveFormat = "comparison"):
{"headline":"<punchy summary of who leads and by how much>","ranking":[{"rank":1,"name":"<series name>","metric":"<key number from METRICS>","note":"<5 words max characterizing this entry>"}],"analysis":"<2-3 short markdown paragraphs>","recommendation":"<markdown — name the winner and explain why an investor should care>"}

INVESTMENT (adaptiveFormat = "investment"):
{"headline":"<direct phrase answering the investment question>","summary":"<1 sentence direct answer>","marketData":"<markdown — what the data shows, with specific numbers>","riskFactors":"<markdown — honest caveats from the data only, not generic warnings>","recommendation":"<markdown — your direct opinion, never hedge, always commit to a view>"}

FACTUAL (adaptiveFormat = "factual"):
{"headline":"<the answer itself as the headline, e.g. '4,821 transactions in 2024'>","answer":"<plain text direct answer>","context":"<optional 1-paragraph markdown — only if useful context exists, otherwise omit>"}

Global rules:
- Every AED figure, percentage, and count must appear verbatim in METRICS or RAW DATA below — never calculate or estimate
- Write as a confident analyst — not "it may be worth considering" but "this is the strongest growth story in Abu Dhabi right now"
- keyMetrics: 3-4 items maximum, copy values exactly as they appear in METRICS strings
- Use **bold** for key numbers in markdown prose sections
- recommendation must start with a clear verdict statement (e.g. "Strong buy.", "Avoid for now.", "Best value play in the market.")
- Return ONLY valid JSON — no markdown fences, no text outside the JSON object${GROUNDING_CLAUSE}`

const CLARIFY_FALLBACK = {
  question: 'What data interests you?',
  options: ['Price trends', 'Transaction volumes', 'District comparison'],
}
/**
 * Returns true if summaryStats contains at least one meaningful data point.
 * Used to decide whether to return suggestions instead of a plain-text sentence.
 */
function hasData(summaryStats) {
  if (!summaryStats) return false
  if (Number(summaryStats.totalTransactions) > 0) return true
  if (summaryStats.series?.some(s =>
    s.txCount > 0 || s.first !== undefined || s.latestValueFormatted
  )) return true
  return false
}

/**
 * Used in short mode when the query returned no data.
 * Returns minimal JSON with headline + 2 alternative suggestions.
 * Haiku is sufficient — this is a routing/suggestion task, not analysis.
 */
const SHORT_NODATA_PROMPT = `You are a real estate data assistant for the Abu Dhabi property market.
The user queried data that does not exist in the current dataset.

Return a JSON object with exactly these keys:
- "headline": a concise explanation of why data is unavailable (max 12 words, no trailing period)
- "analysis": one sentence explaining what was missing (plain text, no markdown)
- "suggestions": an array of EXACTLY 2 objects, each with:
    - "label": 2-5 word display label (used as the query chip text)
    - "query": the exact query string the user should run next (natural language, 4-10 words)
    - "reason": a brief, friendly explanation of what this query will show (max 8 words, plain English, no technical jargon — e.g. "Available for all districts in 2024")

Suggestions MUST be queries this system can actually answer:
price trends, price-per-sqm trends, transaction volumes, project comparisons, district comparisons, layout breakdowns.

Example for "Ready vs Off-Plan Price Gap Since 2021":
{"headline":"No Ready vs Off-Plan comparison data since 2021","analysis":"No dual-series transaction records found for this combination.","suggestions":[{"label":"Ready price trend 2021-2025","query":"Ready property price trend since 2021","reason":"Single sale type records exist where dual-series comparison data is absent"},{"label":"Off-plan volume by district","query":"Off-plan transaction volume by district 2021 to 2025","reason":"Volume data for off-plan properties covers the full requested timeframe"}]}

Rules:
- Return ONLY valid JSON — no markdown fences, no text outside the JSON object
- headline must be factual, not apologetic ("No X data" not "Unfortunately...")
- suggestions must be genuinely useful alternatives, not rephrasing the same broken query`

const CLARIFY_PROMPT = `You are a friendly real estate data assistant for the Abu Dhabi property market.
The user asked a question this system cannot directly answer. This system can show: price trends, price-per-sqm trends, transaction volumes, project comparisons, district comparisons, and layout breakdowns.

Based on the user's question, return a JSON object with exactly two keys:
- "question": A short, warm clarifying question that steers toward what data would help (max 10 words, no trailing period, no markdown)
- "options": An array of 2–3 short strings (max 5 words each) that are real data queries the system can run

Good chips: "Price growth by project", "Most active projects", "By district volume"
Bad chips: "Try different wording", "Ask something else", "Rephrase your question"

Example for "Which project should I buy?":
{"question":"What data would help most?","options":["Price growth by project","Transaction volume","Price per sqm"]}

Rules:
- Never mention SQL, databases, or technical errors
- Options must be data requests, not meta-responses about rephrasing
- Return ONLY valid JSON — no markdown fences, no explanation text, nothing else`

/**
 * Render summaryStats as a labelled plain-text block so the model
 * can parse the numbers reliably without needing to read JSON.
 * Uses enriched fields from computeSummaryStats when available, falls back to legacy.
 */
function formatSummaryStats(stats, queryType) {
  if (!stats) return 'No data available.'

  const lines = ['KEY DATA (cite only these numbers, do not use any other figures):']

  if (stats.dateRange?.from || stats.dateRange?.to) {
    const from = stats.dateRange.from ?? 'start'
    const to   = stats.dateRange.to   ?? 'present'
    lines.push(`Date range: ${from} to ${to}`)
  }

  // ── volume_trend ──────────────────────────────────────────────────────────
  if (stats.totalTransactions !== undefined) {
    lines.push('\nMETRICS:')
    lines.push(`• Total transactions: ${Number(stats.totalTransactions).toLocaleString()}`)
    if (stats.avgMonthly) lines.push(`• Monthly average: ${Number(stats.avgMonthly).toLocaleString()} transactions`)
    if (stats.peakMonth && stats.peakCount != null) {
      lines.push(`• Peak month: ${stats.peakMonth} — ${Number(stats.peakCount).toLocaleString()} transactions`)
    }
    if (stats.rawSeries?.length) {
      lines.push('\nRAW DATA (monthly counts):')
      for (const pt of stats.rawSeries) {
        lines.push(`  ${pt.label}: ${Number(pt.value).toLocaleString()} transactions`)
      }
    }
    return lines.join('\n')
  }

  // ── multi-series ──────────────────────────────────────────────────────────
  if (stats.series?.length > 1) {
    lines.push('\nMETRICS:')
    for (const s of stats.series) {
      lines.push(`\nSeries: ${s.name}`)
      if (s.latestValueFormatted) {
        lines.push(`  • Latest value:   ${s.latestValueFormatted}${s.latestMonth ? ` (${s.latestMonth})` : ''}`)
        lines.push(`  • Overall change: ${s.overallChangeFormatted} (${s.overallChangeAbsFormatted})`)
        if (s.cagrFormatted)      lines.push(`  • CAGR:           ${s.cagrFormatted}`)
        lines.push(`  • Peak:           ${s.peakValueFormatted}${s.peakMonth ? ` (${s.peakMonth})` : ''}`)
        lines.push(`  • Trough:         ${s.troughValueFormatted}${s.troughMonth ? ` (${s.troughMonth})` : ''}`)
      } else {
        // legacy fallback
        lines.push(`  • Starting value: AED ${Number(s.first).toLocaleString()}`)
        lines.push(`  • Latest value:   AED ${Number(s.last).toLocaleString()}`)
        lines.push(`  • Change:         ${s.pctChange > 0 ? '+' : ''}${s.pctChange}% over the period`)
        if (s.peak) lines.push(`  • Peak:           AED ${Number(s.peak).toLocaleString()} (${s.peakMonth})`)
      }
      if (s.txCount) lines.push(`  • Transactions:   ${Number(s.txCount).toLocaleString()}`)
    }
    return lines.join('\n')
  }

  // ── single-series ─────────────────────────────────────────────────────────
  if (stats.series?.length === 1) {
    const s    = stats.series[0]
    const unit = queryType === 'rate_trend' ? 'AED/sqm' : 'AED'
    lines.push('\nMETRICS:')
    if (s.latestValueFormatted) {
      lines.push(`• Latest value:   ${s.latestValueFormatted}${s.latestMonth ? ` (${s.latestMonth})` : ''}`)
      lines.push(`• Overall change: ${s.overallChangeFormatted} (${s.overallChangeAbsFormatted})`)
      if (s.yoyChangeFormatted) lines.push(`• YoY change:     ${s.yoyChangeFormatted}`)
      if (s.cagrFormatted)      lines.push(`• CAGR:           ${s.cagrFormatted}`)
      lines.push(`• Peak:           ${s.peakValueFormatted}${s.peakMonth ? ` (${s.peakMonth})` : ''}`)
      lines.push(`• Trough:         ${s.troughValueFormatted}${s.troughMonth ? ` (${s.troughMonth})` : ''}`)
    } else {
      // legacy fallback
      lines.push(`• Starting value: ${unit} ${Number(s.first).toLocaleString()}`)
      lines.push(`• Latest value:   ${unit} ${Number(s.last).toLocaleString()}`)
      lines.push(`• Change:         ${s.pctChange > 0 ? '+' : ''}${s.pctChange}% over the period`)
      if (s.peak) lines.push(`• Peak:           ${unit} ${Number(s.peak).toLocaleString()} (${s.peakMonth})`)
    }
    if (s.txCount) lines.push(`• Transactions:   ${Number(s.txCount).toLocaleString()}`)
    if (stats.rawSeries?.length) {
      lines.push(`\nRAW DATA (all ${stats.rawSeries.length} data points):`)
      for (const pt of stats.rawSeries) {
        lines.push(`  ${pt.label}: ${unit} ${Number(pt.value).toLocaleString()}`)
      }
    }
  }

  if (!stats.series?.length) lines.push('• No series data available.')

  return lines.join('\n')
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  let prompt, intent, summaryStats, mode
  try {
    const body = await req.json()
    prompt       = body.prompt
    intent       = body.intent
    summaryStats = body.summaryStats
    mode         = body.mode ?? 'full'
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing required field: prompt' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  if (mode !== 'clarify' && (!intent || !summaryStats)) {
    return new Response(JSON.stringify({ error: 'Missing required fields: intent, summaryStats' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  if (mode === 'clarify') {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        system: CLARIFY_PROMPT,
        messages: [{ role: 'user', content: `The user asked: "${prompt}"` }],
      })
      const rawText = msg?.content?.[0]?.text
      let parsed
      if (!rawText) {
        console.warn('[explain] clarify: empty content from Anthropic API')
        parsed = CLARIFY_FALLBACK
      } else {
        try {
          const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```\n?$/, '').trim()
          parsed = JSON.parse(cleaned)
        } catch {
          console.warn('[explain] clarify: JSON.parse failed on:', rawText)
          parsed = CLARIFY_FALLBACK
        }
      }
      return Response.json(parsed)
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[explain] clarify: Anthropic API error:', err.message)
      }
      return Response.json(CLARIFY_FALLBACK)
    }
  }


  // ── Short-mode no-data: return suggestions JSON instead of a 1-sentence summary ──
  if (mode === 'short' && !hasData(summaryStats)) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 350,
        system: SHORT_NODATA_PROMPT,
        messages: [{
          role: 'user',
          content: `The user asked: "${prompt}"\nQuery type: ${intent.queryType}\nFilters: ${JSON.stringify(intent.filters)}`,
        }],
      })
      const rawText = msg?.content?.[0]?.text ?? '{}'
      // Clean fences just in case
      const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\n?$/, '').trim()
      return new Response(cleaned, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    } catch (err) {
      console.warn('[explain] nodata suggestions failed:', err.message)
      // Fall through to normal short-mode path — better than crashing
    }
  }

  const systemPrompt = mode === 'short' ? SHORT_PROMPT : FULL_PROMPT
  const maxTokens    = mode === 'short' ? 80 : 1000

  const userMessage = `Original question: "${prompt}"

Query type: ${intent.queryType}
Adaptive format: ${intent.adaptiveFormat ?? 'trend'}
Filters applied: ${JSON.stringify(intent.filters)}

${formatSummaryStats(summaryStats, intent.queryType)}

${mode === 'short' ? 'Write your one-sentence insight now.' : 'Write the analyst JSON now.'}`

  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-5',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
