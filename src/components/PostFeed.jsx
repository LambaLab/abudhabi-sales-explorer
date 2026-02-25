import { PostCard } from './PostCard'

export function PostFeed({ posts, pendingPost, onRemove }) {
  const allPosts = pendingPost ? [pendingPost, ...posts] : posts

  if (!allPosts.length) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-slate-500 text-sm">No analyses yet.</p>
        <p className="text-slate-600 text-xs">Pick a topic above or type your own question.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {allPosts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          onRemove={post.isStreaming ? undefined : onRemove}
        />
      ))}
    </div>
  )
}
