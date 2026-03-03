import { useState, useEffect } from 'react'

/**
 * FeedTabs — "All Posts" and "My Feed" filter tabs.
 * Only renders when user is signed in.
 * Calls onPostsChange with filtered posts whenever tab or posts change.
 */
export function FeedTabs({ posts, user, onPostsChange }) {
  const [tab, setTab] = useState('all')

  useEffect(() => {
    if (!user) {
      onPostsChange(posts)
      return
    }
    if (tab === 'all') {
      onPostsChange(posts)
    } else {
      onPostsChange(
        posts.filter(p =>
          p.userId === user.id ||
          (p.replies ?? []).some(r => r.userId === user.id)
        )
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, posts, user])

  if (!user) return null

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 p-1 mb-3">
      {[['all', 'All Posts'], ['my', 'My Feed']].map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={tab === id}
          onClick={() => setTab(id)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            tab === id
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
