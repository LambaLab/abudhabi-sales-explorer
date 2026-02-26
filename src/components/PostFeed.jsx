import { PostCard } from './PostCard'

export function PostFeed({ posts, onRemove, onReply }) {
  if (!posts.length) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-slate-500 text-sm">No analyses yet.</p>
        <p className="text-slate-600 text-xs">Pick a topic or type your own question below.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          onRemove={onRemove}
          onReply={onReply}
        />
      ))}
    </div>
  )
}
