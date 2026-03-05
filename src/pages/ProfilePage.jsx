import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProfileFeed }  from '../hooks/useProfileFeed'
import { SignInModal }     from '../components/SignInModal'
import { PostCard }        from '../components/PostCard'
import { ChatInput }       from '../components/ChatInput'
import { UserBubble }      from '../components/UserBubble'
import { stripHint }       from '../utils/stripHint'
import { initials }        from '../utils/initials'
import { supabase }        from '../lib/supabase'

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
  const {
    user, authLoading, signInWithGoogle,
    analyze, getDateRangeHint, activePostId, cancel, ready,
    settings, updateSettings,
  } = ctx
  const { profile, posts, replyPosts, loading, error } = useProfileFeed(userId)
  const [tab, setTab]   = useState('posts')
  const [imgError, setImgError] = useState(false)
  const [localAvatarUrl, setLocalAvatarUrl] = useState(null)
  const [uploading, setUploading]           = useState(false)
  const fileInputRef = useRef(null)
  const [uploadError, setUploadError] = useState(null)

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

  const avatarUrl    = localAvatarUrl ?? profile?.avatar_url ?? ''
  const displayName  = profile?.display_name ?? ''
  const showImg      = avatarUrl && !imgError
  const postCount    = posts.length
  const isOwnProfile = user?.id === userId

  async function handleAvatarUpload(e) {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setUploadError('Image must be under 5 MB.'); return }
    setUploading(true)
    const ext  = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('avatars').upload(path, file, { upsert: true })
    if (uploadErr) { console.error('[ProfilePage] avatar upload:', uploadErr); setUploadError('Upload failed. Please try again.'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: profileErr } = await supabase
      .from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    if (profileErr) {
      console.error('[ProfilePage] profile update:', profileErr)
      setUploadError('Could not save profile. Please try again.')
      setUploading(false)
      return
    }
    setLocalAvatarUrl(publicUrl)
    setImgError(false)
    setUploading(false)
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {/* Back button — top-left, like X/Twitter profile */}
      <div className="absolute top-3 left-3 z-10">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 pt-6 pb-24">

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* ── Profile header ── */}
          <div className="flex flex-col items-center gap-3 mb-6">
            {/* Avatar + upload button */}
            <div className="relative">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-2 ring-slate-200 dark:ring-slate-700">
                {uploading ? (
                  <div className="flex items-center justify-center h-full w-full bg-black/30">
                    <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  </div>
                ) : showImg ? (
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
              {isOwnProfile && (
                <>
                  <button
                    type="button"
                    aria-label="Change profile picture"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-slate-700 border-2 border-white dark:border-slate-900 flex items-center justify-center hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleAvatarUpload}
                  />
                </>
              )}
            </div>
              {uploadError && (
                <p className="text-xs text-red-500 mt-1 text-center">{uploadError}</p>
              )}

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

      {/* ChatInput — own profile only, now outside main */}
      {isOwnProfile && !loading && (
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 z-10 bg-slate-50/75 dark:bg-[#0f172a]/75 backdrop-blur-md">
          <div className="mx-auto max-w-2xl">
            <ChatInput
              onSubmit={prompt => {
                analyze(prompt + (getDateRangeHint?.() ?? ''))
                navigate('/')
              }}
              onStop={cancel}
              isLoading={activePostId !== null || !ready}
              settings={settings ?? { chartType: 'bar' }}
              onSettingsChange={updateSettings ?? (() => {})}
            />
          </div>
        </div>
      )}
    </div>
  )
}
