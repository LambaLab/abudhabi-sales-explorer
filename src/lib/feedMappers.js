/**
 * Convert a Supabase posts row (snake_case) to the app's camelCase post shape.
 * The row may include joined `author` (profiles) and `replies` arrays.
 */
export function fromDbPost(row) {
  return {
    id:             row.id,
    userId:         row.user_id,
    createdAt:      new Date(row.created_at).getTime(),
    prompt:         row.prompt,
    title:          row.title        ?? '',
    status:         row.status       ?? 'done',
    analysisText:   row.analysis_text ?? '',
    shortText:      row.analysis_text ?? '',
    fullText:       row.full_text    ?? null,
    intent:         row.intent       ?? null,
    chartData:      row.chart_data   ?? null,
    chartKeys:      row.chart_keys   ?? null,
    summaryStats:   row.summary_stats ?? null,
    clarifyOptions: row.clarify_options ?? null,
    isExpanded:     row.is_expanded  ?? false,
    author:         row.author       ?? null,
    replies:        (row.replies ?? [])
                      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                      .map(fromDbReply),
  }
}

export function fromDbReply(row) {
  return {
    id:             row.id,
    postId:         row.post_id,
    userId:         row.user_id,
    createdAt:      new Date(row.created_at).getTime(),
    prompt:         row.prompt,
    status:         row.status       ?? 'done',
    analysisText:   row.analysis_text ?? '',
    fullText:       row.full_text    ?? null,
    intent:         row.intent       ?? null,
    chartData:      row.chart_data   ?? null,
    chartKeys:      row.chart_keys   ?? null,
    summaryStats:   row.summary_stats ?? null,
    clarifyOptions: row.clarify_options ?? null,
    author:         row.author       ?? null,
  }
}

export function toDbPost(post, userId) {
  return {
    id:              post.id,
    user_id:         userId,
    created_at:      new Date(post.createdAt).toISOString(),
    prompt:          post.prompt,
    title:           post.title       ?? null,
    status:          'done',
    analysis_text:   post.analysisText ?? post.shortText ?? null,
    full_text:       post.fullText     ?? null,
    intent:          post.intent       ?? null,
    chart_data:      post.chartData    ?? null,
    chart_keys:      post.chartKeys    ?? null,
    summary_stats:   post.summaryStats ?? null,
    clarify_options: post.clarifyOptions ?? null,
    is_expanded:     post.isExpanded   ?? false,
  }
}

export function toDbReply(reply, postId, userId) {
  return {
    id:              reply.id,
    post_id:         postId,
    user_id:         userId,
    created_at:      new Date(reply.createdAt).toISOString(),
    prompt:          reply.prompt,
    status:          'done',
    analysis_text:   reply.analysisText ?? null,
    full_text:       reply.fullText     ?? null,
    intent:          reply.intent       ?? null,
    chart_data:      reply.chartData    ?? null,
    chart_keys:      reply.chartKeys    ?? null,
    summary_stats:   reply.summaryStats ?? null,
    clarify_options: reply.clarifyOptions ?? null,
  }
}
