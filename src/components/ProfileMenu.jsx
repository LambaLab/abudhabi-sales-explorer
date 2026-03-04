import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { initials }    from '../utils/initials'

/**
 * ProfileMenu — avatar button → dropdown with name, email, profile link, sign-out.
 *
 * Props:
 *   user       — Supabase user object
 *   onSignOut  — callback
 */
export function ProfileMenu({ user, onSignOut }) {
  const [open, setOpen]         = useState(false)
  const [imgError, setImgError] = useState(false)
  const wrapperRef = useRef(null)
  const navigate   = useNavigate()

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const name      = user?.user_metadata?.full_name ?? ''
  const email     = user?.email ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url ?? ''
  const userId    = user?.id ?? ''

  return (
    <div ref={wrapperRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden ring-2 ring-transparent hover:ring-accent/40 focus:outline-none focus-visible:ring-accent transition-shadow"
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="h-full w-full flex items-center justify-center bg-accent text-white text-xs font-semibold select-none">
            {initials(name) || '?'}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{email}</p>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); navigate(`/profile/${userId}`) }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
            >
              Profile
            </button>
            <button
              onClick={() => { setOpen(false); onSignOut() }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
