# Shared Feed & Multi-User Persistence — Design

**Date:** 2026-03-03
**Version target:** 1.9
**Status:** Approved

---

## Overview

Replace the current localStorage-only feed with a real-time, multi-user shared feed backed by Supabase. Any visitor can browse the public feed; signed-in users can create posts, add replies to any post, and delete their own content. Guest users see a limited preview (3 posts) before a blur/sign-in wall.

---

## Architecture

**Approach A — Supabase Direct Client SDK (chosen)**

- `@supabase/supabase-js` client used directly from the browser
- Row Level Security (RLS) policies enforce auth at the database layer
- Supabase Auth handles Google OAuth — no server-side auth code needed
- Real-time updates via Supabase Postgres channel subscriptions (no polling)
- Supabase anon key is intentionally public; RLS is the security boundary

---

## Data Model

### `profiles`
Auto-created on first sign-in via a Postgres trigger (`on auth.users insert`).

| Column        | Type        | Notes                    |
|---------------|-------------|--------------------------|
| id            | UUID PK     | = auth.uid()             |
| email         | text        |                          |
| display_name  | text        | From Google profile      |
| avatar_url    | text        | Google profile photo URL |
| created_at    | timestamptz | default now()            |

### `posts`
One row per user-submitted query + AI analysis.

| Column         | Type        | Notes                         |
|----------------|-------------|-------------------------------|
| id             | UUID PK     | gen_random_uuid()             |
| user_id        | UUID FK     | → profiles.id                 |
| created_at     | timestamptz | default now()                 |
| prompt         | text        | User's original query         |
| title          | text?       | AI-generated title            |
| status         | text        | default 'done'                |
| analysis_text  | text?       | Short AI summary              |
| full_text      | text?       | Full AI analysis              |
| intent         | text?       | Detected query intent         |
| chart_data     | jsonb?      | Chart series data             |
| chart_keys     | jsonb?      | Chart axis keys               |
| summary_stats  | jsonb?      | Key statistics object         |
| clarify_options| jsonb?      | Clarifying chip suggestions   |
| is_expanded    | boolean     | default false                 |

### `replies`
One row per follow-up exchange within a post.

| Column         | Type        | Notes                         |
|----------------|-------------|-------------------------------|
| id             | UUID PK     | gen_random_uuid()             |
| post_id        | UUID FK     | → posts.id (cascade delete)   |
| user_id        | UUID FK     | → profiles.id                 |
| created_at     | timestamptz | default now()                 |
| prompt         | text        | User's follow-up query        |
| status         | text        | default 'done'                |
| analysis_text  | text?       |                               |
| full_text      | text?       |                               |
| intent         | text?       |                               |
| chart_data     | jsonb?      |                               |
| chart_keys     | jsonb?      |                               |
| summary_stats  | jsonb?      |                               |
| clarify_options| jsonb?      |                               |

### RLS Policies
Applied to both `posts` and `replies`:
- `SELECT`: public (anon + authenticated)
- `INSERT`: authenticated only
- `DELETE`: `WHERE user_id = auth.uid()`

---

## Frontend Components & State

### New hooks

| Hook       | Purpose                                                                 |
|------------|-------------------------------------------------------------------------|
| `useAuth`  | Wraps Supabase Auth session. Exposes `user`, `signInWithGoogle()`, `signOut()` |
| `useFeed`  | Replaces `usePosts`. Fetches posts from Supabase; subscribes to real-time INSERT + DELETE events |
| `usePost`  | Fetches single post's replies; subscribes to real-time reply INSERT events filtered by `post_id` |

### Changed components

| Component    | Change                                                                 |
|--------------|------------------------------------------------------------------------|
| `PostCard`   | Receives `authorInfo` prop (avatar + display_name). Shows delete button only when `user.id === post.user_id`. Reads replies via `usePost`. |
| `UserBubble` | Receives `authorInfo`. Shows Google profile photo + display_name instead of generic icon when available. |
| `Header`     | Adds: Google avatar + name (signed in), "Sign in with Google" button (guest). |

### New components

| Component    | Purpose                                                                 |
|--------------|-------------------------------------------------------------------------|
| `GuestWall`  | Wraps feed. Renders posts 0–2 normally; blurs post 3+; shows centred sign-in modal overlay. |
| `FeedTabs`   | "All Posts" tab + "My Feed" tab. My Feed query: posts where `user_id = me` OR `id IN (SELECT post_id FROM replies WHERE user_id = me)`. |
| `AuthModal`  | Sign-in modal with Google OAuth button. Triggered by GuestWall or header. |

---

## Auth Flow

1. User clicks "Sign in with Google"
2. `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } })`
3. Google consent screen → redirect back to app
4. Supabase sets session cookie; `useAuth` picks it up via `onAuthStateChange`
5. Postgres trigger creates `profiles` row on first sign-in
6. `useFeed` re-fetches with authenticated session (no page reload needed)

---

## Guest Wall

- Purely presentational — all posts are fetched from Supabase regardless of auth state (public SELECT)
- Posts 0–2 render normally
- Post index 3 and beyond: `filter: blur(4px); opacity: 0.4; pointer-events: none`
- Centred modal overlay: "Sign in to see all posts and join the conversation" + Google sign-in button
- If user scrolls past post 2 and is not signed in, modal auto-appears

---

## Real-time Feed

```js
// useFeed — live new posts from any user
supabase
  .channel('public:posts')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'posts' },
    (payload) => appendPost(payload.new))
  .on('postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'posts' },
    (payload) => removePost(payload.old.id))
  .subscribe()

// usePost — live replies for one post
supabase
  .channel(`post:${postId}:replies`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'replies',
      filter: `post_id=eq.${postId}` },
    (payload) => appendReply(payload.new))
  .subscribe()
```

**Streaming nuance:** In-progress reply state (status: analyzing → querying → explaining) lives only in local React state. Supabase is written to once, when status reaches `'done'`. Remote users see the completed bubble appear; they do not see the intermediate streaming states.

---

## Feed Ordering

Oldest first: `order('created_at', { ascending: true })`. New posts append at the bottom. Users scroll down to see latest content.

---

## Error Handling

| Scenario                              | Handling                                              |
|---------------------------------------|-------------------------------------------------------|
| Supabase unreachable on load          | Toast "Could not load feed — check your connection" + retry button |
| Google OAuth popup blocked            | Toast "Sign-in was blocked — please allow popups"     |
| Delete fails (RLS denied)             | Toast "Couldn't delete post", keep post in UI         |
| Real-time subscription drops          | Supabase client auto-reconnects; no user-visible impact |
| Guest tries to post (input is hidden) | Input is hidden behind auth gate; no 403 handler needed |

---

## Testing Strategy

- Mock `@supabase/supabase-js` with `vi.mock()` in all hook tests
- `useAuth`: sign-in, sign-out, session change events
- `useFeed`: initial fetch, real-time INSERT append, DELETE removal, My Feed filter
- `usePost`: initial fetch, real-time reply append
- `GuestWall`: posts 0–2 visible, post 3 blurred, modal rendered
- `Header`: sign-in button (no session), avatar + name (with session)
- `FeedTabs`: tab switching changes visible posts
- Target: ~25 new tests on top of existing 86 (total ≈ 111)

---

## Migration

On app load: if `localStorage.getItem('ad_posts_v3')` exists, silently discard it regardless of auth state. No migration to Supabase — the shared feed starts clean. Local test/exploration data has no user attribution and would pollute the public feed.

---

## Out of Scope (v1.9)

- Reactions / likes
- Moderation / reporting
- Rate limiting (credit system planned for a future version)
- Deep-link URLs per post
- Push notifications
