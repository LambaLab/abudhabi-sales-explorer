import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a real estate data query interpreter for Abu Dhabi property transactions.
Given a user's question and lists of available values, return ONLY a valid JSON object with the structured query intent.
Rules:
- Match project names, districts, and layouts EXACTLY from the provided lists (fuzzy match: "Noya" → "Noya - Phase 1")
- For relative dates ("last year", "since 2022", "last 3 years") resolve to absolute YYYY-MM strings
- "last year" means the 12 months before today
- "since 2022" means dateFrom = "2022-01"
- chartType must be "line" for trends, "bar" for counts/distributions, "multiline" for comparisons
- queryType options: price_trend, rate_trend, volume_trend, project_comparison, district_comparison, layout_distribution
- If comparing specific named projects → project_comparison
- If comparing districts → district_comparison
- If comparing bedroom types/layouts → layout_distribution
- title must be under 60 characters`

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { prompt, meta } = body
  if (!prompt || !meta) {
    return new Response(JSON.stringify({ error: 'Missing prompt or meta' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { projects, districts, layouts, minDate, maxDate } = meta
  if (!Array.isArray(projects) || !Array.isArray(districts) || !Array.isArray(layouts) || !minDate || !maxDate) {
    return new Response(JSON.stringify({ error: 'meta must include projects, districts, layouts, minDate, maxDate' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const today = new Date().toISOString().split('T')[0]

  const userMessage = `Question: "${prompt}"

Available data values:
- Projects (sample of first 60): ${projects.slice(0, 60).join(', ')}
- Districts: ${districts.join(', ')}
- Layouts: ${layouts.join(', ')}
- Data covers: ${minDate} to ${maxDate}
- Today's date: ${today}

Return ONLY this JSON structure (no markdown, no explanation):
{
  "queryType": "<price_trend|rate_trend|volume_trend|project_comparison|district_comparison|layout_distribution>",
  "filters": {
    "projects": [],
    "districts": [],
    "layouts": [],
    "saleTypes": [],
    "dateFrom": "<YYYY-MM or null>",
    "dateTo": "<YYYY-MM or null>"
  },
  "chartType": "<line|bar|multiline>",
  "title": "<max 60 chars>"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = message.content[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Could not parse intent from Claude response' }), { status: 422, headers: { 'Content-Type': 'application/json' } })
    }

    try {
      JSON.parse(jsonMatch[0])
    } catch {
      return new Response(JSON.stringify({ error: 'Claude response was not valid JSON' }), { status: 422, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(jsonMatch[0], {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Claude API error' }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }
}
