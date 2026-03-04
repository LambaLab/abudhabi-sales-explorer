# Profile Page + Routing Design

**Date:** 2026-03-03
**Status:** Approved

---

## Goal

Add react-router URL routing, a public X-style profile page, move "My Feed" filtering to the profile page, fix chat bubble alignment, fix missing user avatar in chat bubbles, and add author profile links in PostCard.

---

## Decisions

| Topic | Decision |
|---|---|
| Routing | react-router-dom, all tabs become routes |
| Profile visibility | Public, but requires sign-in to view |
| Profile data | Read-only (Google OAuth data) |
| Banner | Removed for now |
| My Feed tab | Removed — replaced by own profile Posts tab |
| Author click | Both avatar + name in PostCard link to /profile/:userId |
| Profile data hook | Dedicated `useProfileFeed(userId)` |
| Replies tab | Compact summary card: post title + user's reply bubbles |

---

## Routes

| URL | Page | Auth required |
|---|---|---|
| `/` | Feed | No |
| `/charts` | Charts | No |
| `/profile/:userId` | ProfilePage | Yes (redirect to / + SignInModal if not signed in) |

---

## Architecture

### New files
- `src/pages/FeedPage.jsx` — extracts current feed content from App.jsx
- `src/pages/ChartsPage.jsx` — wraps ChartTab
- `src/pages/ProfilePage.jsx` — profile header + Posts/Replies tabs
- `src/hooks/useProfileFeed.js` — fetches posts/replies for a given userId

### Modified files
- `src/main.jsx` — wrap with `<BrowserRouter>`
- `src/App.jsx` — becomes layout shell with `<Outlet>`, adds route definitions, header buttons become `<Link>`
- `src/components/ProfileMenu.jsx` — add "Profile" item that navigates to `/profile/:userId`
- `src/components/FeedTabs.jsx` — **deleted** (My Feed filter removed)
- `src/components/PostCard.jsx` — author avatar + name wrapped in `<Link to="/profile/:userId">`
- `src/components/UserBubble.jsx` — fix alignment (items-end), add imgError fallback for avatar

---

## ProfilePage layout

```
┌─────────────────────────────────────┐
│  ← Back to Feed (header)            │
├─────────────────────────────────────┤
│                                     │
│   ┌──────┐  Nagi Salloum            │
│   │      │  nagi@example.com        │
│   │ 🐙   │  12 posts                │
│   └──────┘                          │
│                                     │
│  [ Posts ]  [ Replies ]             │
├─────────────────────────────────────┤
│  Posts tab: full PostCards          │
│  (newest first, user's own only)    │
│                                     │
│  Replies tab: compact summary       │
│  ┌──────────────────────────────┐   │
│  │ Post title (muted)           │   │
│  │ User reply bubble(s)         │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## useProfileFeed hook

```js
// src/hooks/useProfileFeed.js
export function useProfileFeed(userId) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data ? data.map(fromDbPost) : [])
        setLoading(false)
      })
  }, [userId])

  // Replies: posts where at least one reply.user_id === userId
  const replyPosts = posts // loaded from parent useFeed or separate query

  return { posts, loading }
}
```

For the Replies tab: fetch posts from Supabase where any reply has `user_id = userId`:
```js
supabase
  .from('posts')
  .select(POST_SELECT)
  .filter('replies.user_id', 'eq', userId)
```
(Or fetch posts that contain replies authored by userId — may need a raw query or RPC.)

---

## ProfileMenu changes

```
─────────────────
Nagi Salloum
nagi@example.com
─────────────────
Profile          ← navigates to /profile/:userId
Sign out
```

---

## Chat bubble alignment fix (UserBubble)

Current (broken): avatar is inside the column with timestamp, causing center-alignment.
Fix: avatar is a sibling of the column (not inside it), outer row uses `items-end`.

```jsx
// Fixed UserBubble
<div className="flex justify-end items-end gap-2">
  <div className="flex flex-col items-end max-w-[80%]">
    <BubbleText />
    <Timestamp />   {/* below bubble only */}
  </div>
  <Avatar />        {/* bottom-aligned with bubble */}
</div>
```

Also add `imgError` state + `onError` fallback → show initials from `author.display_name` (same pattern as ProfileMenu).

---

## Author link in PostCard

```jsx
// PostCard author bar — wrap in Link when userId is known
import { Link } from 'react-router-dom'

{post.userId && (
  <Link to={`/profile/${post.userId}`} className="flex items-center gap-2 hover:opacity-80">
    <Avatar />
    <AuthorName />
  </Link>
)}
```

---

## Auth guard for ProfilePage

```jsx
// ProfilePage.jsx
const { user, loading } = useAuth()
const [showSignIn, setShowSignIn] = useState(false)

useEffect(() => {
  if (!loading && !user) setShowSignIn(true)
}, [loading, user])

if (showSignIn) return (
  <>
    <SignInModal open onClose={() => navigate('/')} onSignIn={signInWithGoogle} />
  </>
)
```

---

## Version bump

Bump `package.json` version to `1.11` with this batch.
