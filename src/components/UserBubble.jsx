import { useState } from 'react'
import { Link }          from 'react-router-dom'
import { relativeTime } from '../utils/relativeTime'
import { stripHint }    from '../utils/stripHint'
import { initials }     from '../utils/initials'

export function UserBubble({ prompt, createdAt, author, userId }) {
  const [imgError, setImgError] = useState(false)

  const avatarUrl   = author?.avatar_url ?? ''
  const displayName = author?.display_name ?? ''
  const showImg     = avatarUrl && !imgError

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex justify-end items-end gap-2">
        <div className="rounded-xl bg-accent text-white px-3.5 py-2.5 text-sm leading-relaxed max-w-[80%]">
          {stripHint(prompt)}
        </div>
        <div className="shrink-0 h-7 w-7 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          {showImg ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 select-none">
              {initials(displayName) || (
                <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              )}
            </span>
          )}
        </div>
      </div>
      <p className="flex justify-end items-center gap-1 text-xs text-slate-400">
        {userId && displayName && (
          <>
            <Link
              to={`/profile/${userId}`}
              className="font-medium text-accent hover:underline"
            >
              {displayName}
            </Link>
            <span aria-hidden="true">·</span>
          </>
        )}
        {relativeTime(createdAt)}
      </p>
    </div>
  )
}
