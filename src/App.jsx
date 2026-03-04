/* global __APP_VERSION__ */
import { Routes, Route, NavLink, useMatch, useNavigate } from 'react-router-dom'
import { useDuckDB }    from './hooks/useDuckDB'
import { useAppData }   from './hooks/useAppData'
import { useAnalysis }  from './hooks/useAnalysis'
import { useFeed }      from './hooks/useFeed'
import { useAuth }      from './hooks/useAuth'
import { useTheme }     from './hooks/useTheme'
import { useSettings }  from './hooks/useSettings'
import { ProfileMenu }  from './components/ProfileMenu'
import FeedPage         from './pages/FeedPage'
import ChartsPage       from './pages/ChartsPage'
import ProfilePage      from './pages/ProfilePage'

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { settings, updateSettings, getDateRangeHint } = useSettings()
  const isProfile = useMatch('/profile/:userId')
  const navigate  = useNavigate()

  const { ready, error: dbError } = useDuckDB()
  const { meta }                  = useAppData(ready)

  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const store = useFeed({ user })
  const { posts, addPost, removePost, getPost, patchPost, addReply, patchReply } = store

  const { analyze, analyzeReply, analyzeDeep, activePostId, cancel } = useAnalysis(meta, {
    addPost, patchPost, addReply, patchReply, getPost,
  })

  // Shared context passed to child pages via ctx prop
  const outletContext = {
    ready, dbError, meta,
    user, authLoading, signInWithGoogle, signOut,
    posts, addPost, removePost,
    analyze, analyzeReply, analyzeDeep, activePostId, cancel,
    settings, updateSettings, getDateRangeHint,
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 bg-white/80 dark:bg-[#0f172a]/95 backdrop-blur z-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">

          {/* Octopus logo */}
          <div className="flex items-center gap-2 shrink-0">
            <img
              src="/octopus.png"
              alt="Octopus"
              className="h-8 w-8 object-contain"
              onError={e => {
                e.currentTarget.style.display = 'none'
                const sibling = e.currentTarget.nextSibling
                if (sibling) sibling.style.display = 'inline'
              }}
            />
            <span style={{ display: 'none' }} className="text-2xl select-none">🐙</span>
            {dbError && <span className="text-xs text-red-400 hidden sm:inline">DB error: {dbError}</span>}
            {!ready && !dbError && <span className="text-xs text-slate-400 animate-pulse hidden sm:inline">Loading…</span>}
          </div>

          {/* Center: Back button (profile routes) OR Feed/Charts nav */}
          {isProfile ? (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Go back"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Back
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 p-1">
              {[
                { to: '/',       label: 'Feed',   end: true },
                { to: '/charts', label: 'Charts', end: false },
              ].map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          )}

          {/* Version + Theme + Profile */}
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono hidden sm:inline select-none">
              v {__APP_VERSION__}
            </span>
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              )}
            </button>
            {!authLoading && (
              user
                ? <ProfileMenu user={user} onSignOut={signOut} />
                : (
                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Sign in
                  </button>
                )
            )}
          </div>
        </div>
      </header>

      {/* ── Routes ── */}
      <Routes>
        <Route path="/"        element={<FeedPage    ctx={outletContext} />} />
        <Route path="/charts"  element={<ChartsPage  ctx={outletContext} />} />
        <Route path="/profile/:userId" element={<ProfilePage ctx={outletContext} />} />
      </Routes>

    </div>
  )
}
