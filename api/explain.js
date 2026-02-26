import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SHORT_PROMPT = `You are a real estate market analyst specializing in Abu Dhabi property.
Write exactly 2-3 sentences summarizing the single most important insight with specific AED numbers.
No headers, no bullets, flowing prose only.`

const FULL_PROMPT = `You are a real estate market analyst specializing in Abu Dhabi property.
Write clear, accessible analysis for sophisticated investors.
Rules:
- Write exactly 2-3 paragraphs of flowing prose — NO headers, NO bullet points, NO markdown
- Lead with the single most important insight
- Use specific AED numbers and percentages
- Compare and contrast when multiple series exist
- End with a brief forward-looking observation if the data supports one
- Keep language accessible to non-experts while remaining precise`

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
  if (!prompt || !intent || !summaryStats) {
    return new Response(JSON.stringify({ error: 'Missing required fields: prompt, intent, summaryStats' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const systemPrompt = mode === 'short' ? SHORT_PROMPT : FULL_PROMPT
  const maxTokens    = mode === 'short' ? 150 : 600

  const userMessage = `Original question: "${prompt}"

Query type: ${intent.queryType}
Filters applied: ${JSON.stringify(intent.filters)}

Key data:
${JSON.stringify(summaryStats, null, 2)}

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
