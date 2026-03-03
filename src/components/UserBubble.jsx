import { relativeTime } from '../utils/relativeTime'
import { stripHint }    from '../utils/stripHint'

export function UserBubble({ prompt, createdAt }) {
  return (
    <div className="flex justify-end items-end gap-2">
      <div className="flex flex-col items-end max-w-[80%]">
        <div className="rounded-xl bg-accent text-white px-3.5 py-2.5 text-sm leading-relaxed">
          {stripHint(prompt)}
        </div>
        <p className="text-xs text-slate-400 mt-1">{relativeTime(createdAt)}</p>
      </div>
      {/* Avatar */}
      <div aria-hidden="true" className="shrink-0 h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
        <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
      </div>
    </div>
  )
}
