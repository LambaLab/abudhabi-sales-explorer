# Shared Feed & Multi-User Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace localStorage-only posts with a real-time Supabase-backed shared feed where any signed-in user can post and see everyone else's posts live.

**Architecture:** Supabase Direct Client SDK — `@supabase/supabase-js` talks directly to Supabase from the browser; RLS policies enforce auth at the DB layer. `useFeed` replaces `usePostStore`, preserving the identical API (`addPost`, `patchPost`, `addReply`, `patchReply`, `removePost`, `getPost`) so `useAnalysis` is untouched. Posts/replies are persisted to Supabase only when `status === 'done'`; intermediate streaming states live in local React state only.

**Tech Stack:** Vite + React 19, `@supabase/supabase-js`, Vitest + @testing-library/react, Tailwind v4

---

## Task 0: Supabase project setup (manual — do this before any code)

> **This task has no commits.** It's a one-time manual setup.

### Step 1: Create Supabase project
1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** from Project Settings → API

### Step 2: Run the database migration
In the Supabase dashboard → SQL Editor → New query, paste and run:

```sql
-- 1. profiles (auto-populated on first sign-in via trigger)
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trigger: create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. posts
CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  prompt          TEXT NOT NULL,
  title           TEXT,
  status          TEXT DEFAULT 'done',
  analysis_text   TEXT,
  full_text       TEXT,
  intent          JSONB,
  chart_data      JSONB,
  chart_keys      JSONB,
  summary_stats   JSONB,
  clarify_options JSONB,
  is_expanded     BOOLEAN DEFAULT FALSE
);

-- 4. replies
CREATE TABLE replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  prompt          TEXT NOT NULL,
  status          TEXT DEFAULT 'done',
  analysis_text   TEXT,
  full_text       TEXT,
  intent          JSONB,
  chart_data      JSONB,
  chart_keys      JSONB,
  summary_stats   JSONB,
  clarify_options JSONB
);

-- 5. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies  ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_all"  ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (auth.uid() = id);

-- posts
CREATE POLICY "posts_select_all"     ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_auth"    ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete_own"     ON posts FOR DELETE USING (auth.uid() = user_id);

-- replies
CREATE POLICY "replies_select_all"   ON replies FOR SELECT USING (true);
CREATE POLICY "replies_insert_auth"  ON replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "replies_delete_own"   ON replies FOR DELETE USING (auth.uid() = user_id);

-- 6. Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE replies;
```

### Step 3: Configure Google OAuth
1. Supabase dashboard → Authentication → Providers → Google → Enable
2. Follow the link to create a Google OAuth 2.0 client in Google Cloud Console
3. Set the authorised redirect URI to: `https://<project-ref>.supabase.co/auth/v1/callback`
4. Paste the Client ID and Client Secret back into Supabase
5. In Supabase → Authentication → URL Configuration, add:
   - Site URL: `http://localhost:5173` (dev) and `https://abudhabi-sales-explorer.vercel.app` (prod)
   - Redirect URLs: same two URLs

### Step 4: Create `.env.local`
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
Add `.env.local` to `.gitignore` (it should already be there).

### Step 5: Add to Vercel
In Vercel project → Settings → Environment Variables, add:
- `VITE_SUPABASE_URL` = your project URL
- `VITE_SUPABASE_ANON_KEY` = your anon key

---

## Task 1: Install `@supabase/supabase-js` and create the singleton

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/lib/supabase.js`

### Step 1: Install
```bash
npm install @supabase/supabase-js
```
Expected: package added, no errors.

### Step 2: Create singleton
Create `src/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabase] Missing env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(
  SUPABASE_URL      ?? '',
  SUPABASE_ANON_KEY ?? '',
)
```

### Step 3: Run existing tests to confirm nothing broke
```bash
npm test
```
Expected: all 86 tests pass.

### Step 4: Commit
```bash
git add src/lib/supabase.js package.json package-lock.json
git commit -m "feat: add @supabase/supabase-js singleton"
```

---

## Task 2: `useAuth` hook

**Files:**
- Create: `src/hooks/useAuth.js`
- Create: `src/hooks/useAuth.test.js`

### Step 1: Create the mock for supabase in test-setup
Add to `src/test-setup.js`:
```js
// Nothing needed here — each test file that uses supabase will vi.mock it locally
```

### Step 2: Write failing tests
Create `src/hooks/useAuth.test.js`:
```js
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase singleton BEFORE importing the hook
const mockGetSession       = vi.fn()
const mockSignInWithOAuth  = vi.fn()
const mockSignOut          = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockUnsubscribe      = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession:          () => mockGetSession(),
      signInWithOAuth:     (opts) => mockSignInWithOAuth(opts),
      signOut:             () => mockSignOut(),
      onAuthStateChange:   (cb) => mockOnAuthStateChange(cb),
    },
  },
}))

import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } })
  })

  it('user is null initially (no session)', async () => {
    const { result } = renderHook(() => useAuth())
    // loading is true on first render; user becomes null after session resolves
    await act(async () => {})
    expect(result.current.user).toBeNull()
  })

  it('user is populated when session exists', async () => {
    const fakeUser = { id: 'u1', user_metadata: { full_name: 'Ada', avatar_url: 'https://avatar' } }
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeUser } } })
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    expect(result.current.user).toEqual(fakeUser)
  })

  it('signInWithGoogle calls supabase.auth.signInWithOAuth with google provider', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    act(() => result.current.signInWithGoogle())
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    )
  })

  it('signOut calls supabase.auth.signOut', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    act(() => result.current.signOut())
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('user updates when onAuthStateChange fires', async () => {
    let capturedCb
    mockOnAuthStateChange.mockImplementation(cb => {
      capturedCb = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    const fakeUser = { id: 'u2', user_metadata: {} }
    act(() => capturedCb('SIGNED_IN', { user: fakeUser }))
    expect(result.current.user).toEqual(fakeUser)
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useAuth())
    await act(async () => {})
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
```

### Step 3: Run to confirm they fail
```bash
npm test src/hooks/useAuth.test.js
```
Expected: FAIL — "Cannot find module './useAuth'"

### Step 4: Implement `useAuth`
Create `src/hooks/useAuth.js`:
```js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useAuth — wraps Supabase Auth for Google OAuth.
 * Returns: { user, loading, signInWithGoogle, signOut }
 *   user: Supabase User object or null
 *   loading: true until initial session check resolves
 */
export function useAuth() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Subscribe to auth state changes (sign-in after OAuth redirect, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  function signInWithGoogle() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  function signOut() {
    supabase.auth.signOut()
  }

  return { user, loading, signInWithGoogle, signOut }
}
```

### Step 5: Run tests — confirm they pass
```bash
npm test src/hooks/useAuth.test.js
```
Expected: 6 tests pass.

### Step 6: Commit
```bash
git add src/hooks/useAuth.js src/hooks/useAuth.test.js
git commit -m "feat: add useAuth hook with Google OAuth via Supabase"
```

---

## Task 3: `useFeed` hook (replaces localStorage in `usePostStore`)

This is the central task. `useFeed` exposes the **identical API** as `usePostStore` so `useAnalysis` and the rest of the app need zero changes. Internally it:
1. Loads posts (with nested replies + author profiles) from Supabase on mount
2. Subscribes to real-time INSERT/DELETE for posts and replies
3. Persists posts/replies to Supabase when `status === 'done'`
4. Keeps all intermediate streaming states in local React state only

**Files:**
- Create: `src/hooks/useFeed.js`
- Create: `src/hooks/useFeed.test.js`
- Create: `src/lib/feedMappers.js`

### Step 1: Write mapper utilities
Create `src/lib/feedMappers.js`:
```js
/**
 * Convert a Supabase posts row (snake_case) to the app's camelCase post shape.
 * The row may include joined `author` (profiles) and `replies` arrays.
 */
export function fromDbPost(row) {
  return {
    id:             row.id,
    userId:         row.user_id,
    createdAt:      new Date(row.created_at).getTime(),
    prompt:         row.prompt,
    title:          row.title        ?? '',
    status:         row.status       ?? 'done',
    analysisText:   row.analysis_text ?? '',
    shortText:      row.analysis_text ?? '',
    fullText:       row.full_text    ?? null,
    intent:         row.intent       ?? null,
    chartData:      row.chart_data   ?? null,
    chartKeys:      row.chart_keys   ?? null,
    summaryStats:   row.summary_stats ?? null,
    clarifyOptions: row.clarify_options ?? null,
    isExpanded:     row.is_expanded  ?? false,
    author:         row.author       ?? null,  // { display_name, avatar_url }
    replies:        (row.replies ?? [])
                      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                      .map(fromDbReply),
  }
}

/**
 * Convert a Supabase replies row to the app's reply shape.
 */
export function fromDbReply(row) {
  return {
    id:             row.id,
    postId:         row.post_id,
    userId:         row.user_id,
    createdAt:      new Date(row.created_at).getTime(),
    prompt:         row.prompt,
    status:         row.status       ?? 'done',
    analysisText:   row.analysis_text ?? '',
    fullText:       row.full_text    ?? null,
    intent:         row.intent       ?? null,
    chartData:      row.chart_data   ?? null,
    chartKeys:      row.chart_keys   ?? null,
    summaryStats:   row.summary_stats ?? null,
    clarifyOptions: row.clarify_options ?? null,
    author:         row.author       ?? null,
  }
}

/**
 * Convert an app post object to Supabase insert/upsert shape.
 */
export function toDbPost(post, userId) {
  return {
    id:              post.id,
    user_id:         userId,
    created_at:      new Date(post.createdAt).toISOString(),
    prompt:          post.prompt,
    title:           post.title       ?? null,
    status:          'done',
    analysis_text:   post.analysisText ?? post.shortText ?? null,
    full_text:       post.fullText     ?? null,
    intent:          post.intent       ?? null,
    chart_data:      post.chartData    ?? null,
    chart_keys:      post.chartKeys    ?? null,
    summary_stats:   post.summaryStats ?? null,
    clarify_options: post.clarifyOptions ?? null,
    is_expanded:     post.isExpanded   ?? false,
  }
}

/**
 * Convert an app reply object to Supabase insert/upsert shape.
 */
export function toDbReply(reply, postId, userId) {
  return {
    id:              reply.id,
    post_id:         postId,
    user_id:         userId,
    created_at:      new Date(reply.createdAt).toISOString(),
    prompt:          reply.prompt,
    status:          'done',
    analysis_text:   reply.analysisText ?? null,
    full_text:       reply.fullText     ?? null,
    intent:          reply.intent       ?? null,
    chart_data:      reply.chartData    ?? null,
    chart_keys:      reply.chartKeys    ?? null,
    summary_stats:   reply.summaryStats ?? null,
    clarify_options: reply.clarifyOptions ?? null,
  }
}
```

### Step 2: Write failing tests
Create `src/hooks/useFeed.test.js`:
```js
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Supabase mock ---
const mockFrom         = vi.fn()
const mockChannel      = vi.fn()
const mockRemoveChannel = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from:          (...args) => mockFrom(...args),
    channel:       (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}))

// Chainable query builder factory
function makeQuery(resolvedValue = { data: [], error: null }) {
  const q = {
    select:  vi.fn().mockReturnThis(),
    order:   vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    single:  vi.fn().mockReturnThis(),
    upsert:  vi.fn().mockResolvedValue({ error: null }),
    delete:  vi.fn().mockReturnThis(),
    then:    (cb) => Promise.resolve(resolvedValue).then(cb),
  }
  return q
}

// Realttime channel factory; captures .on() callbacks for testing
function makeChannel() {
  const handlers = {}
  const ch = {
    on: vi.fn().mockImplementation((type, filter, cb) => {
      const key = `${filter.event}:${filter.table}`
      handlers[key] = cb
      return ch
    }),
    subscribe: vi.fn().mockReturnValue(undefined),
    _fire: (event, table, payload) => {
      const key = `${event}:${table}`
      handlers[key]?.(payload)
    },
    _handlers: handlers,
  }
  return ch
}

import { useFeed } from './useFeed'

describe('useFeed', () => {
  let query
  let channel

  beforeEach(() => {
    vi.clearAllMocks()
    query   = makeQuery({ data: [], error: null })
    channel = makeChannel()
    mockFrom.mockReturnValue(query)
    mockChannel.mockReturnValue(channel)
  })

  it('starts with empty posts and loads from Supabase on mount', async () => {
    query = makeQuery({ data: [
      { id: 'p1', user_id: 'u1', created_at: new Date().toISOString(),
        prompt: 'hello', title: 'Hello', status: 'done',
        analysis_text: 'test', author: { display_name: 'Ada', avatar_url: '' },
        replies: [] }
    ], error: null })
    mockFrom.mockReturnValue(query)

    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => expect(result.current.posts).toHaveLength(1))
    expect(result.current.posts[0].id).toBe('p1')
    expect(result.current.posts[0].analysisText).toBe('test')
  })

  it('addPost appends a post to local state', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => expect(result.current.posts).toHaveLength(0))

    act(() => result.current.addPost({ id: 'x1', prompt: 'p', status: 'analyzing', replies: [] }))
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].id).toBe('x1')
  })

  it('addPost dedupes — does not add same id twice', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => expect(result.current.posts).toHaveLength(0))

    act(() => result.current.addPost({ id: 'dup', prompt: 'a', status: 'analyzing', replies: [] }))
    act(() => result.current.addPost({ id: 'dup', prompt: 'b', status: 'analyzing', replies: [] }))
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].prompt).toBe('b') // last write wins
  })

  it('patchPost with status=done AND user → calls supabase.from(posts).upsert()', async () => {
    const fakeUser = { id: 'u1' }
    const { result } = renderHook(() => useFeed({ user: fakeUser }))
    await waitFor(() => {})

    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'analyzing', replies: [] }))
    act(() => result.current.patchPost('p1', { status: 'done', analysisText: 'done text' }))

    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(query.upsert).toHaveBeenCalled()
  })

  it('patchPost with status=done but NO user → does NOT call upsert', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => {})

    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'analyzing', replies: [] }))
    act(() => result.current.patchPost('p1', { status: 'done' }))

    expect(query.upsert).not.toHaveBeenCalled()
  })

  it('patchPost with status!=done → does NOT call upsert', async () => {
    const fakeUser = { id: 'u1' }
    const { result } = renderHook(() => useFeed({ user: fakeUser }))
    await waitFor(() => {})

    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'analyzing', replies: [] }))
    act(() => result.current.patchPost('p1', { status: 'querying' }))

    expect(query.upsert).not.toHaveBeenCalled()
  })

  it('removePost removes from local state and calls supabase delete', async () => {
    const fakeUser = { id: 'u1' }
    const { result } = renderHook(() => useFeed({ user: fakeUser }))
    await waitFor(() => {})

    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'done', replies: [] }))
    act(() => result.current.removePost('p1'))

    expect(result.current.posts).toHaveLength(0)
    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(query.delete).toHaveBeenCalled()
  })

  it('real-time INSERT for new post → appends to posts', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => {})

    const newRow = {
      id: 'rt1', user_id: 'u1', created_at: new Date().toISOString(),
      prompt: 'rt post', title: '', status: 'done', analysis_text: '',
      replies: [], author: { display_name: 'Bob', avatar_url: '' },
    }
    // Simulate real-time INSERT: channel fires, then secondary fetch returns full row
    query = makeQuery({ data: newRow, error: null })
    mockFrom.mockReturnValue(query)

    await act(async () => {
      channel._fire('INSERT', 'posts', { new: { id: 'rt1' } })
      // Wait for the secondary fetch promise
      await new Promise(r => setTimeout(r, 0))
    })

    expect(result.current.posts.some(p => p.id === 'rt1')).toBe(true)
  })

  it('real-time INSERT for already-known post id → dedupes (no duplicate)', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => {})

    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'done', replies: [] }))

    // channel fires an INSERT for same id (our own post echoing back)
    await act(async () => {
      channel._fire('INSERT', 'posts', { new: { id: 'p1' } })
      await new Promise(r => setTimeout(r, 0))
    })

    expect(result.current.posts).toHaveLength(1)
  })

  it('real-time DELETE → removes post from local state', async () => {
    const { result } = renderHook(() => useFeed({ user: null }))
    await waitFor(() => {})

    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'done', replies: [] }))
    act(() => channel._fire('DELETE', 'posts', { old: { id: 'p1' } }))

    expect(result.current.posts).toHaveLength(0)
  })

  it('patchReply with status=done AND user → calls supabase.from(replies).upsert()', async () => {
    const fakeUser = { id: 'u1' }
    const { result } = renderHook(() => useFeed({ user: fakeUser }))
    await waitFor(() => {})

    act(() => result.current.addPost({ id: 'p1', prompt: 'q', status: 'done', replies: [] }))
    act(() => result.current.addReply('p1', { id: 'r1', prompt: 'follow up', createdAt: Date.now(), status: 'analyzing' }))
    act(() => result.current.patchReply('p1', 'r1', { status: 'done', analysisText: 'reply done' }))

    expect(mockFrom).toHaveBeenCalledWith('replies')
    expect(query.upsert).toHaveBeenCalled()
  })
})
```

### Step 3: Run to confirm failure
```bash
npm test src/hooks/useFeed.test.js
```
Expected: FAIL — "Cannot find module './useFeed'"

### Step 4: Implement `useFeed`
Create `src/hooks/useFeed.js`:
```js
import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase }  from '../lib/supabase'
import { fromDbPost, fromDbReply, toDbPost, toDbReply } from '../lib/feedMappers'

const POST_SELECT = `
  *,
  author:profiles(display_name, avatar_url),
  replies(*, author:profiles(display_name, avatar_url))
`

/**
 * useFeed — drop-in replacement for usePostStore.
 * Exposes identical API: { posts, addPost, removePost, getPost, patchPost, addReply, patchReply }
 *
 * Persistence strategy:
 *   - Intermediate streaming states (analyzing → querying → explaining) live in local state only
 *   - When patchPost/patchReply is called with { status: 'done' }, the completed data is upserted to Supabase
 *   - Posts/replies from other users arrive via real-time subscriptions
 *
 * @param {{ user: import('@supabase/supabase-js').User|null }} props
 */
export function useFeed({ user }) {
  const [posts, setPosts] = useState([])
  const userRef           = useRef(user)

  // Keep userRef current without recreating callbacks
  useEffect(() => { userRef.current = user }, [user])

  // ── Load from Supabase on mount ────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('posts')
      .select(POST_SELECT)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setPosts(data.map(fromDbPost))
      })

    // ── Real-time: post INSERT ──────────────────────────────────────────────
    const ch = supabase
      .channel('public:posts+replies')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          // Secondary fetch to get author + replies join
          const { data } = await supabase
            .from('posts')
            .select(POST_SELECT)
            .eq('id', payload.new.id)
            .single()
          if (!data) return
          setPosts(prev => {
            if (prev.some(p => p.id === data.id)) return prev // dedup own posts
            return [...prev, fromDbPost(data)]
          })
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id))
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'replies' },
        async (payload) => {
          const { data } = await supabase
            .from('replies')
            .select('*, author:profiles(display_name, avatar_url)')
            .eq('id', payload.new.id)
            .single()
          if (!data) return
          const reply = fromDbReply(data)
          setPosts(prev => prev.map(p => {
            if (p.id !== reply.postId) return p
            if ((p.replies ?? []).some(r => r.id === reply.id)) return p // dedup
            return { ...p, replies: [...(p.replies ?? []), reply] }
          }))
        })
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [])

  // Clear localStorage on mount (old local-only data)
  useEffect(() => {
    try { localStorage.removeItem('ad_posts_v3') } catch { /* ignore */ }
  }, [])

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Add a new post to local state (called at start of analysis — status: 'analyzing').
   * Enriches post with author info from current user.
   */
  const addPost = useCallback((post) => {
    const u = userRef.current
    const enriched = {
      ...post,
      userId: u?.id ?? null,
      author: u ? {
        display_name: u.user_metadata?.full_name  ?? '',
        avatar_url:   u.user_metadata?.avatar_url ?? '',
      } : null,
    }
    setPosts(prev => [...prev.filter(p => p.id !== enriched.id), enriched])
  }, [])

  /**
   * Merge partial fields into a post.
   * If partial.status === 'done' and user is signed in, upserts to Supabase.
   */
  const patchPost = useCallback((id, partial) => {
    setPosts(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...partial } : p)
      if (partial.status === 'done' && userRef.current) {
        const post = next.find(p => p.id === id)
        if (post) {
          supabase.from('posts').upsert(toDbPost(post, userRef.current.id))
        }
      }
      return next
    })
  }, [])

  /** Remove a post from local state and delete from Supabase. */
  const removePost = useCallback((id) => {
    setPosts(prev => prev.filter(p => p.id !== id))
    supabase.from('posts').delete().eq('id', id)
  }, [])

  /** Always-current reference to a post by id (recreated on every posts change). */
  const getPost = useCallback((id) => posts.find(p => p.id === id), [posts])

  /**
   * Add a reply to a post's thread (called at start of reply analysis).
   * Enriches reply with author info from current user.
   */
  const addReply = useCallback((postId, reply) => {
    const u = userRef.current
    const enriched = {
      ...reply,
      userId: u?.id ?? null,
      author: u ? {
        display_name: u.user_metadata?.full_name  ?? '',
        avatar_url:   u.user_metadata?.avatar_url ?? '',
      } : null,
    }
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, replies: [...(p.replies ?? []), enriched] }
        : p
    ))
  }, [])

  /**
   * Merge partial fields into a reply.
   * If partial.status === 'done' and user signed in, upserts to Supabase.
   */
  const patchReply = useCallback((postId, replyId, partial) => {
    setPosts(prev => {
      const next = prev.map(p => {
        if (p.id !== postId) return p
        return {
          ...p,
          replies: (p.replies ?? []).map(r =>
            r.id === replyId ? { ...r, ...partial } : r
          ),
        }
      })
      if (partial.status === 'done' && userRef.current) {
        const post  = next.find(p => p.id === postId)
        const reply = post?.replies?.find(r => r.id === replyId)
        if (reply) {
          supabase.from('replies').upsert(toDbReply(reply, postId, userRef.current.id))
        }
      }
      return next
    })
  }, [])

  return { posts, addPost, removePost, getPost, patchPost, addReply, patchReply }
}
```

### Step 5: Run tests — confirm they pass
```bash
npm test src/hooks/useFeed.test.js
```
Expected: all 11 tests pass.

### Step 6: Run all tests to confirm nothing broke
```bash
npm test
```
Expected: 97+ tests pass, none failing.

### Step 7: Commit
```bash
git add src/lib/feedMappers.js src/hooks/useFeed.js src/hooks/useFeed.test.js
git commit -m "feat: add useFeed hook — Supabase-backed feed with real-time subscriptions"
```

---

## Task 4: `GuestWall` component + blur in `PostFeed`

**Files:**
- Create: `src/components/GuestWall.jsx`
- Create: `src/components/GuestWall.test.jsx`
- Modify: `src/components/PostFeed.jsx`

### Step 1: Write failing tests
Create `src/components/GuestWall.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GuestWall } from './GuestWall'

describe('GuestWall', () => {
  it('renders null when user is signed in', () => {
    const { container } = render(
      <GuestWall user={{ id: 'u1' }} postsCount={10} onSignIn={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders null when guest but 3 or fewer posts', () => {
    const { container } = render(
      <GuestWall user={null} postsCount={3} onSignIn={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders sign-in modal when guest and more than 3 posts', () => {
    render(<GuestWall user={null} postsCount={4} onSignIn={vi.fn()} />)
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
  })

  it('calls onSignIn when the sign-in button is clicked', () => {
    const onSignIn = vi.fn()
    render(<GuestWall user={null} postsCount={5} onSignIn={onSignIn} />)
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))
    expect(onSignIn).toHaveBeenCalledOnce()
  })
})
```

### Step 2: Run to confirm failure
```bash
npm test src/components/GuestWall.test.jsx
```
Expected: FAIL — "Cannot find module './GuestWall'"

### Step 3: Implement `GuestWall`
Create `src/components/GuestWall.jsx`:
```jsx
/** Guest wall: renders a sign-in modal overlay when a guest has seen 3+ posts. */
export function GuestWall({ user, postsCount, onSignIn }) {
  if (user || postsCount <= 3) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in required"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4">
        <div className="text-4xl select-none">🐙</div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Join the conversation
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sign in to see all posts and start exploring Abu Dhabi real-estate data.
        </p>
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
```

### Step 4: Modify `PostFeed` to blur posts beyond index 2 for guests
Read the current `src/components/PostFeed.jsx` and update it:
```jsx
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
```

### Step 5: Run all tests
```bash
npm test
```
Expected: all tests pass including 4 new GuestWall tests.

### Step 6: Commit
```bash
git add src/components/GuestWall.jsx src/components/GuestWall.test.jsx src/components/PostFeed.jsx
git commit -m "feat: add GuestWall modal and post blur for guests past limit"
```

---

## Task 5: `FeedTabs` component (All Posts / My Feed)

**Files:**
- Create: `src/components/FeedTabs.jsx`
- Create: `src/components/FeedTabs.test.jsx`

### Step 1: Write failing tests
Create `src/components/FeedTabs.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FeedTabs } from './FeedTabs'

const POSTS = [
  { id: 'p1', userId: 'u1', prompt: 'post 1', replies: [] },
  { id: 'p2', userId: 'u2', prompt: 'post 2', replies: [{ userId: 'u1' }] },
  { id: 'p3', userId: 'u3', prompt: 'post 3', replies: [] },
]
const USER = { id: 'u1' }

describe('FeedTabs', () => {
  it('renders "All Posts" and "My Feed" tabs when signed in', () => {
    render(<FeedTabs posts={POSTS} user={USER} onPostsChange={vi.fn()} />)
    expect(screen.getByRole('tab', { name: /all posts/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /my feed/i })).toBeInTheDocument()
  })

  it('does not render tabs when user is null', () => {
    render(<FeedTabs posts={POSTS} user={null} onPostsChange={vi.fn()} />)
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('"All Posts" tab passes all posts to onPostsChange', () => {
    const onPostsChange = vi.fn()
    render(<FeedTabs posts={POSTS} user={USER} onPostsChange={onPostsChange} />)
    fireEvent.click(screen.getByRole('tab', { name: /all posts/i }))
    expect(onPostsChange).toHaveBeenCalledWith(POSTS)
  })

  it('"My Feed" tab passes only posts created by or replied to by the user', () => {
    const onPostsChange = vi.fn()
    render(<FeedTabs posts={POSTS} user={USER} onPostsChange={onPostsChange} />)
    fireEvent.click(screen.getByRole('tab', { name: /my feed/i }))
    const result = onPostsChange.mock.lastCall[0]
    expect(result.map(p => p.id)).toEqual(['p1', 'p2']) // p3 not mine
  })
})
```

### Step 2: Run to confirm failure
```bash
npm test src/components/FeedTabs.test.jsx
```
Expected: FAIL

### Step 3: Implement `FeedTabs`
Create `src/components/FeedTabs.jsx`:
```jsx
import { useState, useEffect } from 'react'

/**
 * FeedTabs — "All Posts" and "My Feed" tabs.
 * Only rendered when user is signed in.
 * Calls onPostsChange with the filtered list whenever tab changes or posts update.
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
  }, [tab, posts, user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 p-1">
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
```

### Step 4: Run all tests
```bash
npm test
```
Expected: all tests pass including 4 new FeedTabs tests.

### Step 5: Commit
```bash
git add src/components/FeedTabs.jsx src/components/FeedTabs.test.jsx
git commit -m "feat: add FeedTabs with All Posts / My Feed filtering"
```

---

## Task 6: Author display in `PostCard` and `UserBubble`

**Files:**
- Modify: `src/components/PostCard.jsx`
- Modify: `src/components/UserBubble.jsx`
- Modify: `src/components/UserBubble.test.jsx`

### Step 1: Add author display test to UserBubble tests
Open `src/components/UserBubble.test.jsx` and add:
```jsx
it('shows Google profile image when author.avatar_url is provided', () => {
  const author = { display_name: 'Ada Lovelace', avatar_url: 'https://example.com/ada.jpg' }
  render(<UserBubble prompt="test" createdAt={Date.now()} author={author} />)
  const img = screen.getByRole('img', { name: /ada lovelace/i })
  expect(img).toBeInTheDocument()
  expect(img).toHaveAttribute('src', 'https://example.com/ada.jpg')
})

it('shows generic icon when author is null', () => {
  const { container } = render(<UserBubble prompt="test" createdAt={Date.now()} author={null} />)
  // Generic icon is aria-hidden; no named img
  expect(screen.queryByRole('img', { name: /./i })).toBeNull()
  expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
})
```

### Step 2: Run to confirm new tests fail
```bash
npm test src/components/UserBubble.test.jsx
```
Expected: 2 new tests FAIL

### Step 3: Update `UserBubble` to accept and show author info
Open `src/components/UserBubble.jsx` and replace its content with:
```jsx
import { relativeTime } from '../utils/relativeTime'
import { stripHint }    from '../utils/stripHint'

export function UserBubble({ prompt, createdAt, author }) {
  return (
    <div className="flex justify-end items-end gap-2">
      <div className="flex flex-col items-end max-w-[80%]">
        <div className="rounded-xl bg-accent text-white px-3.5 py-2.5 text-sm leading-relaxed">
          {stripHint(prompt)}
        </div>
        <p className="text-xs text-slate-400 mt-1">{relativeTime(createdAt)}</p>
      </div>
      {/* Avatar */}
      <div className="shrink-0 h-6 w-6 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
        {author?.avatar_url ? (
          <img
            src={author.avatar_url}
            alt={author.display_name ?? 'User'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="flex items-center justify-center w-full h-full">
            <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
```

### Step 4: Add author header to PostCard
In `src/components/PostCard.jsx`, find the card header section (the part showing the post title/prompt) and add an author line above it. Look for the first `<div>` or heading element in the card body and prepend:

```jsx
{/* Author info */}
{post.author && (
  <div className="flex items-center gap-2 mb-2">
    {post.author.avatar_url ? (
      <img
        src={post.author.avatar_url}
        alt={post.author.display_name ?? 'User'}
        className="h-5 w-5 rounded-full object-cover"
      />
    ) : (
      <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
    )}
    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
      {post.author.display_name}
    </span>
    {onDelete && (
      <button
        onClick={() => onDelete(post.id)}
        className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors"
        aria-label="Delete post"
      >
        Delete
      </button>
    )}
  </div>
)}
```

Also add `onDelete` and `currentUser` to the `PostCard` function signature:
```jsx
export function PostCard({ post, onReply, isActive, onCancel, onDeepAnalysis, chartType, onDelete, currentUser }) {
```

And thread `author` down to each `UserBubble` in `ReplyCard` → `UserBubble`. In `ReplyCard.jsx`:
```jsx
export function ReplyCard({ reply, onReply, postId }) {
  return (
    <div className="space-y-3">
      <UserBubble prompt={reply.prompt} createdAt={reply.createdAt} author={reply.author} />
      <AIBubble reply={reply} onReply={onReply} postId={postId} />
    </div>
  )
}
```

### Step 5: Run all tests
```bash
npm test
```
Expected: all tests pass (including 2 new UserBubble tests).

### Step 6: Commit
```bash
git add src/components/UserBubble.jsx src/components/UserBubble.test.jsx \
        src/components/PostCard.jsx src/components/ReplyCard.jsx
git commit -m "feat: show Google author photo + name on posts and reply bubbles"
```

---

## Task 7: Wire up `App.jsx`

This task connects all the new pieces: replaces `usePostStore` with `useFeed`, adds auth UI to the header, adds `FeedTabs`, adds `GuestWall`, and removes the dead deeplink `addPost` call (deeplinks need rethinking with a shared DB — skip for v1.9).

**Files:**
- Modify: `src/App.jsx`

### Step 1: Review `App.jsx` before editing
Read `src/App.jsx` fully to understand what's there before making changes.

### Step 2: Apply changes to `App.jsx`

Replace the import block at top — add `useAuth`, `useFeed`, `GuestWall`, `FeedTabs`; remove `usePostStore`:
```js
import { useEffect, useRef, useState } from 'react'
import { useDuckDB }    from './hooks/useDuckDB'
import { useAppData }   from './hooks/useAppData'
import { useAnalysis }  from './hooks/useAnalysis'
import { useFeed }      from './hooks/useFeed'
import { useAuth }      from './hooks/useAuth'
import { useTheme }     from './hooks/useTheme'
import { useSettings }  from './hooks/useSettings'
import { ChatInput }    from './components/ChatInput'
import { PostFeed }     from './components/PostFeed'
import { PostCard }     from './components/PostCard'
import { ChartTab }     from './components/ChartTab'
import { GuestWall }    from './components/GuestWall'
import { FeedTabs }     from './components/FeedTabs'
```

In the `App()` function body, replace `usePostStore` with:
```js
const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth()
const store = useFeed({ user })
const { posts, addPost, removePost, getPost, patchPost, addReply, patchReply } = store

// Posts to display (filtered by FeedTabs)
const [displayPosts, setDisplayPosts] = useState(posts)
// Keep displayPosts in sync when posts change and tabs haven't been touched
useEffect(() => { setDisplayPosts(posts) }, [posts])
```

Replace the header's right-side controls (the version + theme toggle section) to also include auth:
```jsx
{/* Auth + Version + Theme */}
<div className="shrink-0 flex items-center gap-2">
  {!authLoading && (
    user ? (
      <>
        <img
          src={user.user_metadata?.avatar_url}
          alt={user.user_metadata?.full_name ?? 'You'}
          className="h-7 w-7 rounded-full object-cover"
        />
        <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline max-w-[120px] truncate">
          {user.user_metadata?.full_name}
        </span>
        <button
          onClick={signOut}
          className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors hidden sm:inline"
        >
          Sign out
        </button>
      </>
    ) : (
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        Sign in
      </button>
    )
  )}
  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono hidden sm:inline select-none">
    v {__APP_VERSION__}
  </span>
  {/* ... existing theme toggle button ... */}
</div>
```

Replace the tab bar in the header (current `['feed', 'charts']` pills) to add `FeedTabs` below them, or integrate it inline. The simplest integration: keep the existing Feed/Charts tabs, and place `FeedTabs` just above the `PostFeed` inside the feed area:

In the feed tab section, inside the `<main>` element before `<PostFeed>`:
```jsx
<FeedTabs
  posts={posts}
  user={user}
  onPostsChange={setDisplayPosts}
/>
```

Update the `PostFeed` call to pass `user`, `onDelete`, and `displayPosts` instead of `posts`:
```jsx
<PostFeed
  posts={displayPosts}
  onReply={(postId, prompt) => analyzeReply(postId, prompt + getDateRangeHint())}
  activePostId={activePostId}
  onCancel={cancel}
  onDeepAnalysis={analyzeDeep}
  chartType={settings.chartType}
  user={user}
  onDelete={removePost}
/>
```

Add `GuestWall` just after `PostFeed` (still inside the `<main>` scroll area):
```jsx
<GuestWall
  user={user}
  postsCount={displayPosts.length}
  onSignIn={signInWithGoogle}
/>
```

Gate the `ChatInput` behind auth — only signed-in users can submit new analyses:
```jsx
{/* Only render ChatInput for signed-in users */}
{user && (
  <div className="absolute bottom-0 left-0 right-0 px-4 py-3 z-10 bg-slate-50/75 dark:bg-[#0f172a]/75 backdrop-blur-md">
    <div className="mx-auto max-w-2xl">
      <ChatInput
        onSubmit={analyzeWithSettings}
        onStop={cancel}
        isLoading={isLoading || !ready}
        settings={settings}
        onSettingsChange={updateSettings}
      />
    </div>
  </div>
)}
```

Remove the `parseShareUrl` / deeplink block entirely (deeplinks don't work with a shared DB without a fetch; simplify for v1.9 — they can be re-added later with a proper Supabase fetch).

### Step 3: Run all tests
```bash
npm test
```
Expected: all tests pass.

### Step 4: Start dev server and manually verify
```bash
npm run dev
```
Check in browser:
- [ ] Feed loads posts from Supabase (empty if DB is fresh)
- [ ] "Sign in" button visible in header when not signed in
- [ ] Clicking "Sign in" opens Google OAuth
- [ ] After sign in: avatar + name appear, chat input unlocks
- [ ] Submit a query → new post appears in feed
- [ ] Refresh page → post persists (loaded from Supabase)
- [ ] Open second browser tab → new post from tab 1 appears in tab 2 in real time
- [ ] "My Feed" tab shows only relevant posts
- [ ] "Delete" button on own posts works
- [ ] Sign out → input disappears, guest wall shows after 3 posts

### Step 5: Commit
```bash
git add src/App.jsx
git commit -m "feat: wire useFeed + useAuth + GuestWall + FeedTabs into App"
```

---

## Task 8: Version bump + deploy

**Files:**
- Modify: `package.json`

### Step 1: Bump version
In `package.json`, change `"version": "1.8"` → `"version": "1.9"`

### Step 2: Run all tests one final time
```bash
npm test
```
Expected: all tests pass (110+ total).

### Step 3: Commit + push
```bash
git add package.json
git commit -m "chore: bump version to 1.9 — shared feed with Supabase"
git push
```

### Step 4: Deploy
```bash
npx vercel --prod
```
Expected: deployment to `https://abudhabi-sales-explorer.vercel.app` succeeds.

### Step 5: Smoke test production
- Open the Vercel URL in two different browsers
- Sign in with Google in both
- Submit a query in browser 1 → confirm it appears in browser 2 in real time
- Guest view (incognito) → confirm blur wall after 3 posts
