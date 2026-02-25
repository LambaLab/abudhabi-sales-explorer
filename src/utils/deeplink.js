import LZString from 'lz-string'

/**
 * Compress and base64url-encode a post object for use in URL query params.
 * Example: ?post=abc123&d=<encodePost(post)>
 */
export function encodePost(post) {
  if (!post) return ''
  return LZString.compressToEncodedURIComponent(JSON.stringify(post))
}

/**
 * Decode a previously encoded post. Returns null if input is invalid.
 */
export function decodePost(encoded) {
  if (!encoded) return null
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Build a shareable URL for a post.
 * Encodes the full post in the URL so it works on any device without a backend.
 */
export function buildShareUrl(post) {
  if (!post?.id) throw new Error('buildShareUrl: post must have an id')
  const base = window.location.origin + window.location.pathname
  const params = new URLSearchParams({ post: post.id, d: encodePost(post) })
  return `${base}?${params.toString()}`
}

/**
 * Parse a post from the current URL (for deeplink landing).
 * Returns { postId, post } where post may be null if no 'd' param.
 */
export function parseShareUrl() {
  const params = new URLSearchParams(window.location.search)
  const postId = params.get('post')
  const d      = params.get('d')
  const post   = d ? decodePost(d) : null
  return { postId, post }
}
