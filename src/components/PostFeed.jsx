import { PostCard } from './PostCard'

const GUEST_LIMIT = 3

export function PostFeed({ posts, onReply, activePostId, onCancel, onDeepAnalysis, chartType, user, onDelete }) {
  if (!posts.length) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-slate-400 dark:text-slate-500 text-sm">No analyses yet.</p>
        <p className="text-slate-400 dark:text-slate-600 text-xs">Pick a topic or type your own question below.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post, i) => {
        const isBlurred = !user && i >= GUEST_LIMIT
        return (
          <div
            key={post.id}
            className={isBlurred ? 'pointer-events-none select-none blur-sm opacity-40' : ''}
            aria-hidden={isBlurred || undefined}
          >
            <PostCard
              post={post}
              onReply={onReply}
              isActive={post.id === activePostId}
              onCancel={onCancel}
              onDeepAnalysis={onDeepAnalysis}
              chartType={chartType}
              onDelete={post.userId === user?.id ? onDelete : undefined}
              currentUser={user}
            />
          </div>
        )
      })}
    </div>
  )
}
