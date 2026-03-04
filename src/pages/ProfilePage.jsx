import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProfileFeed }  from '../hooks/useProfileFeed'
import { SignInModal }     from '../components/SignInModal'
import { PostCard }        from '../components/PostCard'
import { UserBubble }      from '../components/UserBubble'
import { stripHint }       from '../utils/stripHint'
import { initials }        from '../utils/initials'

/** Compact card for Replies tab: post context + user's reply bubbles */
function ReplyContextCard({ post, userId, user, onSignIn }) {
  const [expanded, setExpanded] = useState(false)
  const userReplies = (post.replies ?? []).filter(r => r.userId === userId)
  if (!userReplies.length) return null

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/30 overflow-hidden shadow-sm">
      {/* Clickable title header with chevron */}
      <button
        type="button"
        aria-label={expanded ? 'Collapse post' : 'Expand post'}
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors text-left"
      >
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2 flex-1 mr-2">
          {post.title || stripHint(post.prompt)}
        </p>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6"/>
        </svg>
      </button>

      {/* Expanded: full PostCard (read-only) */}
      {expanded && (
        <div className="border-b border-slate-100 dark:border-slate-700/40">
          <PostCard
            post={post}
            onReply={null}
            isActive={false}
            onCancel={null}
            onDeepAnalysis={null}
            user={user}
            onSignIn={onSignIn}
          />
        </div>
      )}

      {/* User's reply bubbles */}
      <div className="px-4 py-3 space-y-2">
        {userReplies.map(reply => (
          <UserBubble
            key={reply.id}
            prompt={reply.prompt}
            createdAt={reply.createdAt}
            author={reply.author}
          />
        ))}
      </div>
    </div>
  )
}

export default function ProfilePage({ ctx }) {
  const { userId }      = useParams()
  const navigate        = useNavigate()
  const { user, authLoading, signInWithGoogle } = ctx
  const { profile, posts, replyPosts, loading, error } = useProfileFeed(userId)
  const [tab, setTab]   = useState('posts')
  const [imgError, setImgError] = useState(false)

  // Auth guard
  if (!authLoading && !user) {
    return (
      <main className="flex-1 overflow-y-auto flex items-center justify-center">
        <SignInModal
          open
          onClose={() => navigate('/')}
          onSignIn={signInWithGoogle}
        />
      </main>
    )
  }

  const avatarUrl    = profile?.avatar_url ?? ''
  const displayName  = profile?.display_name ?? ''
  const showImg      = avatarUrl && !imgError
  const postCount    = posts.length
  const isOwnProfile = user?.id === userId

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-16">

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* ── Profile header ── */}
        <div className="flex flex-col items-center gap-3 mb-6">
          {/* Avatar */}
          <div className="h-20 w-20 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-2 ring-slate-200 dark:ring-slate-700">
            {showImg ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-2xl font-bold text-slate-600 dark:text-slate-300 select-none">
                {initials(displayName) || '?'}
              </span>
            )}
          </div>

          {/* Name + meta */}
          <div className="text-center space-y-0.5">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {loading ? '…' : displayName || 'Unknown user'}
            </h1>
            {isOwnProfile && user?.email && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            )}
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {postCount} {postCount === 1 ? 'post' : 'posts'}
            </p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div role="tablist" className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
          {[['posts', 'Posts'], ['replies', 'Replies']].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm animate-pulse">Loading…</div>
        ) : tab === 'posts' ? (
          posts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">No posts yet.</div>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReply={null}
                  isActive={false}
                  onCancel={null}
                  onDeepAnalysis={null}
                  user={user}
                  onSignIn={signInWithGoogle}
                />
              ))}
            </div>
          )
        ) : (
          replyPosts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">No replies yet.</div>
          ) : (
            <div className="space-y-4">
              {replyPosts.map(post => (
                <ReplyContextCard key={post.id} post={post} userId={userId} user={user} onSignIn={signInWithGoogle} />
              ))}
            </div>
          )
        )}
      </div>
    </main>
  )
}
