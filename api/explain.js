import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const GROUNDING_CLAUSE = `

CRITICAL: Only cite numbers that appear verbatim in the KEY DATA section below. Do not draw on your training knowledge of Abu Dhabi real estate prices, volumes, or market trends. Every AED figure, percentage, and transaction count you write must come directly from the provided data. If a number is not in the data, do not mention it.`

const SHORT_PROMPT = `You are a real estate market analyst specializing in Abu Dhabi property.
Write exactly 1 sentence with the single most important insight and the key number.
No headers, no bullets, flowing prose only.${GROUNDING_CLAUSE}`

const FULL_PROMPT = `You are a real estate market analyst specializing in Abu Dhabi property.
Write clear, accessible analysis for sophisticated investors.
Rules:
- Write exactly 2-3 paragraphs of flowing prose — NO headers, NO bullet points, NO markdown
- Lead with the single most important insight
- Use specific numbers and percentages from the data
- Compare and contrast when multiple series exist
- End with a brief forward-looking observation if the data supports one
- Keep language accessible to non-experts while remaining precise${GROUNDING_CLAUSE}`

const CLARIFY_FALLBACK = {
  question: 'What data interests you?',
  options: ['Price trends', 'Transaction volumes', 'District comparison'],
}

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
 */
function formatSummaryStats(stats, queryType) {
  if (!stats) return 'No data available.'

  const lines = ['KEY DATA (cite only these numbers, do not use any other figures):']

  if (stats.dateRange?.from || stats.dateRange?.to) {
    const from = stats.dateRange.from ?? 'start'
    const to   = stats.dateRange.to   ?? 'present'
    lines.push(`• Date range: ${from} to ${to}`)
  }

  // volume_trend
  if (stats.totalTransactions !== undefined) {
    lines.push(`• Total transactions in period: ${Number(stats.totalTransactions).toLocaleString()}`)
    if (stats.avgMonthly)  lines.push(`• Monthly average: ${Number(stats.avgMonthly).toLocaleString()}`)
    if (stats.peakMonth && stats.peakCount != null) lines.push(`• Peak month: ${stats.peakMonth} with ${Number(stats.peakCount).toLocaleString()} transactions`)
    return lines.join('\n')
  }

  // multi-series (project_comparison, district_comparison, layout_distribution)
  if (stats.series?.length > 1) {
    for (const s of stats.series) {
      lines.push(`\nSeries: ${s.name}`)
      lines.push(`  • Starting value: AED ${Number(s.first).toLocaleString()}`)
      lines.push(`  • Latest value:   AED ${Number(s.last).toLocaleString()}`)
      lines.push(`  • Change:         ${s.pctChange > 0 ? '+' : ''}${s.pctChange}% over the period`)
      if (s.peak)    lines.push(`  • Peak:           AED ${Number(s.peak).toLocaleString()} (${s.peakMonth})`)
      if (s.txCount) lines.push(`  • Transactions in period: ${Number(s.txCount).toLocaleString()}`)
    }
    return lines.join('\n')
  }

  // single-series (price_trend / rate_trend)
  if (stats.series?.length === 1) {
    const s    = stats.series[0]
    const unit = queryType === 'rate_trend' ? 'AED/sqm' : 'AED'
    lines.push(`• Starting value: ${unit} ${Number(s.first).toLocaleString()}`)
    lines.push(`• Latest value:   ${unit} ${Number(s.last).toLocaleString()}`)
    lines.push(`• Change:         ${s.pctChange > 0 ? '+' : ''}${s.pctChange}% over the period`)
    if (s.peak)    lines.push(`• Peak:           ${unit} ${Number(s.peak).toLocaleString()} (${s.peakMonth})`)
    if (s.txCount) lines.push(`• Total transactions in period: ${Number(s.txCount).toLocaleString()}`)
  }

  if (stats.series !== undefined && stats.series.length === 0) {
    lines.push('• No series data available.')
  }

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
          const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
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

  const systemPrompt = mode === 'short' ? SHORT_PROMPT : FULL_PROMPT
  const maxTokens    = mode === 'short' ? 80 : 600

  const userMessage = `Original question: "${prompt}"

Query type: ${intent.queryType}
Filters applied: ${JSON.stringify(intent.filters)}

${formatSummaryStats(summaryStats, intent.queryType)}

Write the analyst commentary now.`

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
