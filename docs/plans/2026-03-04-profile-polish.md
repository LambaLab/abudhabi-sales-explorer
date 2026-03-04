# Profile Polish + Feed UX Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Five targeted UX fixes: UserBubble avatar alignment, PostCard author initials fallback, profile page back-button header, Replies tab inline expand/collapse, and new-query ChatInput on own profile.

**Architecture:** All changes are UI-only within existing components. No new hooks, no schema changes. ProfilePage gets additional `ctx` props wired through (`analyze`, `getDateRangeHint`, `activePostId`, `cancel`, `ready`). App.jsx uses `useMatch('/profile/:userId')` to swap the header center between tab-nav and back-button.

**Tech Stack:** React 19, react-router-dom v7, Tailwind v4, Vitest + @testing-library/react

---

### Shared constants

```
Project root:   /Users/nagi/abudhabi-sales-explorer
Node binary:    /Users/nagi/.nvm/versions/node/v24.13.1/bin/node
npm binary:     /Users/nagi/.nvm/versions/node/v24.13.1/bin/npm
Vitest:         /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest
Run all tests:  PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run
Run one file:   PATH="..." vitest run src/path/file.test.jsx
git commit:     PATH="..." git -C /Users/nagi/abudhabi-sales-explorer commit -m "..."
git push:       PATH="..." git -C /Users/nagi/abudhabi-sales-explorer push
```

---

### Task 1: Fix UserBubble bottom alignment

**Files:**
- Modify: `src/components/UserBubble.jsx`
- Modify: `src/components/UserBubble.test.jsx`

**Context:** The timestamp is currently inside the bubble column, so `items-end` on the outer flex row aligns the avatar to the bottom of `bubble+timestamp`. This places the avatar lower than the bubble's bottom edge. Fix: wrap bubble+avatar in an inner row with `items-end`, and move the timestamp to a separate outer column.

**Step 1: Write the failing test**

Read `src/components/UserBubble.test.jsx` first. Then add this test inside the existing `describe('UserBubble', ...)` block:

```jsx
it('timestamp is not a sibling of the avatar in the same flex row', () => {
  const { container } = render(
    <UserBubble
      prompt="hello"
      createdAt={Date.now()}
      author={{ display_name: 'Nagi Salloum', avatar_url: '' }}
    />
  )
  // The outer wrapper should be a flex column, not a flex row
  // The timestamp <p> should NOT be a sibling of the avatar circle in the same row
  // We verify: timestamp exists and is in the DOM
  expect(container.querySelector('p')).toBeTruthy()
  // And the avatar circle is NOT inside the same parent div as the timestamp
  const avatarCircle = container.querySelector('.rounded-full')
  const timestamp    = container.querySelector('p')
  expect(avatarCircle.parentElement).not.toBe(timestamp.parentElement)
})
```

**Step 2: Run test — verify it FAILS**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/components/UserBubble.test.jsx
```

Expected: new test fails (avatar and timestamp share the same parent currently).

**Step 3: Rewrite `src/components/UserBubble.jsx`**

Replace the full file content:

```jsx
import { useState } from 'react'
import { relativeTime } from '../utils/relativeTime'
import { stripHint }    from '../utils/stripHint'
import { initials }     from '../utils/initials'

export function UserBubble({ prompt, createdAt, author }) {
  const [imgError, setImgError] = useState(false)

  const avatarUrl   = author?.avatar_url ?? ''
  const displayName = author?.display_name ?? ''
  const showImg     = avatarUrl && !imgError

  return (
    {/* Outer column: stacks [bubble+avatar row] then [timestamp] */}
    <div className="flex flex-col items-end gap-0.5">

      {/* Inner row: bubble left, avatar right — both bottom-aligned */}
      <div className="flex justify-end items-end gap-2">
        <div className="rounded-xl bg-accent text-white px-3.5 py-2.5 text-sm leading-relaxed max-w-[80%]">
          {stripHint(prompt)}
        </div>

        {/* Avatar */}
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

      {/* Timestamp — below the row, not affecting avatar alignment */}
      <p className="text-xs text-slate-400">{relativeTime(createdAt)}</p>
    </div>
  )
}
```

**IMPORTANT — JSX comment syntax:** JSX does not allow `{/* ... */}` as direct children of another component at the root level. Remove or convert the inline JSX comments to `{/* */}` inside a container. The actual code should be:

```jsx
import { useState } from 'react'
import { relativeTime } from '../utils/relativeTime'
import { stripHint }    from '../utils/stripHint'
import { initials }     from '../utils/initials'

export function UserBubble({ prompt, createdAt, author }) {
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
      <p className="text-xs text-slate-400">{relativeTime(createdAt)}</p>
    </div>
  )
}
```

**Step 4: Run tests — all must PASS**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/components/UserBubble.test.jsx
```

Expected: 7/7 pass.

**Step 5: Run full suite**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run
```

Expected: all 145 tests pass.

**Step 6: Commit**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  git -C /Users/nagi/abudhabi-sales-explorer add \
    src/components/UserBubble.jsx \
    src/components/UserBubble.test.jsx && \
  git -C /Users/nagi/abudhabi-sales-explorer commit -m "fix: UserBubble timestamp below row so avatar aligns with bubble bottom

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Fix PostCard author avatar — initials fallback

**Files:**
- Modify: `src/components/PostCard.jsx`

**Context:** PostCard's author bar renders `<img>` with no `onError` handler. When a Google photo URL is expired or fails, the browser renders a torn-image icon. Add `imgError` state with initials fallback using the shared `initials()` utility. There is no PostCard test file, so no test changes are needed.

**Step 1: Read `src/components/PostCard.jsx`** to locate the author bar section (currently around lines 178–226 after the last diff).

**Step 2: Add the import for `initials`**

At the top of PostCard.jsx, the current imports are:
```jsx
import { useState, useRef, useEffect } from 'react'
import { Link }            from 'react-router-dom'
...
import { SignInModal }     from './SignInModal'
```

Add:
```jsx
import { initials }        from '../utils/initials'
```

**Step 3: Add `imgError` state**

Inside `PostCard`, after the existing `useState` calls (e.g., after `const [showSignIn, setShowSignIn] = useState(false)`), add:

```jsx
const [authorImgError, setAuthorImgError] = useState(false)
```

**Step 4: Create a shared `AuthorAvatar` helper inside PostCard.jsx**

To avoid duplicating the fallback logic for both the linked and non-linked branch, add a tiny helper component just before the `PostCard` export:

```jsx
/** Small circular author avatar with initials fallback */
function AuthorAvatar({ avatarUrl, displayName, imgError, onError }) {
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={displayName ?? 'User'}
        className="h-5 w-5 rounded-full object-cover shrink-0"
        onError={onError}
      />
    )
  }
  const abbr = initials(displayName ?? '')
  return (
    <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
      <span className="text-[9px] font-bold text-accent select-none leading-none">
        {abbr || '?'}
      </span>
    </div>
  )
}
```

**Step 5: Update the author bar in `PostCard` to use `AuthorAvatar`**

Find the author bar block (it renders two nearly-identical branches: one wrapped in `<Link>` when `post.userId` exists, one in a plain `<div>`). Replace both `<img>` / empty-div fallbacks with `<AuthorAvatar>`:

```jsx
{/* Author bar */}
{post.author && (
  <div className="flex items-center gap-2 mb-2">
    {post.userId ? (
      <Link
        to={`/profile/${post.userId}`}
        className="flex items-center gap-2 min-w-0 hover:opacity-75 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <AuthorAvatar
          avatarUrl={post.author.avatar_url}
          displayName={post.author.display_name}
          imgError={authorImgError}
          onError={() => setAuthorImgError(true)}
        />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {post.author.display_name}
        </span>
      </Link>
    ) : (
      <div className="flex items-center gap-2 min-w-0">
        <AuthorAvatar
          avatarUrl={post.author.avatar_url}
          displayName={post.author.display_name}
          imgError={authorImgError}
          onError={() => setAuthorImgError(true)}
        />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {post.author.display_name}
        </span>
      </div>
    )}
    {onDelete && (
      <button
        onClick={() => onDelete(post.id)}
        className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors shrink-0"
        aria-label="Delete post"
      >
        Delete
      </button>
    )}
  </div>
)}
```

**Step 6: Run full suite**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run
```

Expected: all tests pass (PostCard has no test file, so no new tests — but nothing should break).

**Step 7: Commit**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  git -C /Users/nagi/abudhabi-sales-explorer add src/components/PostCard.jsx && \
  git -C /Users/nagi/abudhabi-sales-explorer commit -m "fix: PostCard author avatar initials fallback on image error

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: App.jsx — back button on profile routes

**Files:**
- Modify: `src/App.jsx`

**Context:** When on `/profile/:userId`, the header should show a `← Back` button (browser history) instead of the Feed/Charts tab nav. Use `useMatch('/profile/:userId')` from react-router-dom to detect the profile route. No test file exists for App.jsx — just run the full suite.

**Step 1: Read `src/App.jsx`** to understand the current header structure.

**Step 2: Add `useMatch` and `useNavigate` to the import**

Change:
```jsx
import { Routes, Route, NavLink } from 'react-router-dom'
```
To:
```jsx
import { Routes, Route, NavLink, useMatch, useNavigate } from 'react-router-dom'
```

**Step 3: Add inside `App()` body** (near the top, after the existing hooks):

```jsx
const isProfile = useMatch('/profile/:userId')
const navigate  = useNavigate()
```

**Step 4: Replace the Feed/Charts nav block in the header**

Find this block in the header:
```jsx
{/* Feed / Charts nav */}
<div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 p-1">
  {[
    { to: '/',       label: 'Feed',   end: true },
    { to: '/charts', label: 'Charts', end: false },
  ].map(({ to, label, end }) => (
    <NavLink ... >{label}</NavLink>
  ))}
</div>
```

Replace it with:

```jsx
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
```

**Step 5: Run full suite**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run
```

Expected: all tests pass.

**Step 6: Commit**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  git -C /Users/nagi/abudhabi-sales-explorer add src/App.jsx && \
  git -C /Users/nagi/abudhabi-sales-explorer commit -m "feat: show Back button in header on profile routes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: ProfilePage Replies — inline expand/collapse

**Files:**
- Modify: `src/pages/ProfilePage.jsx`
- Modify: `src/pages/ProfilePage.test.jsx`

**Context:** `ReplyContextCard` currently shows the post title statically. We add a local `expanded` state and a chevron button in the title header. When expanded, the full `PostCard` renders inline (read-only). `ReplyContextCard` also needs `user` and `onSignIn` props so PostCard's auth-gating works correctly.

**Step 1: Read `src/pages/ProfilePage.test.jsx`** to understand the existing test structure.

**Step 2: Add the failing test**

Add to `ProfilePage.test.jsx` inside the `describe('ProfilePage', ...)` block:

```jsx
it('expands ReplyContextCard when header is clicked', () => {
  const replyPost = {
    id: 'rp1',
    userId: 'u2',
    prompt: 'What are top areas?',
    title: 'Top Areas Query',
    status: 'done',
    analysisText: 'Al Reem is top.',
    replies: [
      {
        id: 'r1',
        userId: 'u1',
        prompt: 'Tell me more',
        createdAt: Date.now(),
        status: 'done',
        author: { display_name: 'Nagi Salloum', avatar_url: '' },
      },
    ],
    createdAt: Date.now(),
    chartData: [],
  }
  useProfileFeed.mockReturnValue({
    profile: { id: 'u1', display_name: 'Nagi', avatar_url: '' },
    posts: [],
    replyPosts: [replyPost],
    loading: false,
    error: null,
  })
  renderProfile('u1', { user: { id: 'u1' }, authLoading: false, signInWithGoogle: vi.fn() })

  // Switch to Replies tab
  fireEvent.click(screen.getByRole('tab', { name: /replies/i }))

  // The post title should be visible (collapsed state)
  expect(screen.getByText('Top Areas Query')).toBeTruthy()

  // Click the expand button (the header row)
  fireEvent.click(screen.getByRole('button', { name: /expand/i }))

  // Now the analysis text from the PostCard should be visible
  expect(screen.getByText('Al Reem is top.')).toBeTruthy()
})
```

**Step 3: Run test — verify it FAILS**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/pages/ProfilePage.test.jsx
```

Expected: new test fails (no "expand" button, no analysis text visible).

**Step 4: Update `ReplyContextCard` in `src/pages/ProfilePage.jsx`**

Replace the current `ReplyContextCard` function with this expanded version:

```jsx
/** Compact card for Replies tab: post context + user's reply bubbles, with expand/collapse */
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
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
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
```

**Step 5: Update `ReplyContextCard` usage in ProfilePage to pass `user` and `onSignIn`**

Find the line where `ReplyContextCard` is rendered inside the Replies tab:

```jsx
{replyPosts.map(post => (
  <ReplyContextCard key={post.id} post={post} userId={userId} />
))}
```

Change to:
```jsx
{replyPosts.map(post => (
  <ReplyContextCard key={post.id} post={post} userId={userId} user={user} onSignIn={signInWithGoogle} />
))}
```

**Step 6: Run tests — all must PASS**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/pages/ProfilePage.test.jsx
```

Expected: 6/6 pass.

**Step 7: Run full suite**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run
```

Expected: all pass.

**Step 8: Commit**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  git -C /Users/nagi/abudhabi-sales-explorer add \
    src/pages/ProfilePage.jsx \
    src/pages/ProfilePage.test.jsx && \
  git -C /Users/nagi/abudhabi-sales-explorer commit -m "feat: Replies tab expand/collapse shows full PostCard inline

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: ProfilePage — new query ChatInput on own profile

**Files:**
- Modify: `src/pages/ProfilePage.jsx`
- Modify: `src/pages/ProfilePage.test.jsx`

**Context:** When the viewer is looking at their OWN profile (`isOwnProfile === true`), show a sticky ChatInput at the bottom (same pattern as FeedPage). On submit, call `ctx.analyze(prompt + ctx.getDateRangeHint())` then navigate to `/` so the user can watch the query run on the Feed. ProfilePage must destructure additional ctx props: `analyze`, `getDateRangeHint`, `activePostId`, `cancel`, `ready`, `settings`, `updateSettings`.

**Step 1: Add the failing test**

Add to `ProfilePage.test.jsx` inside the `describe('ProfilePage', ...)` block:

```jsx
it('shows ChatInput on own profile', () => {
  // Mock ChatInput
  vi.mock('../components/ChatInput', () => ({
    ChatInput: ({ onSubmit }) => (
      <div data-testid="chat-input">
        <button onClick={() => onSubmit('test query')}>submit</button>
      </div>
    ),
  }))

  useProfileFeed.mockReturnValue({
    profile: { id: 'u1', display_name: 'Nagi', avatar_url: '' },
    posts: [], replyPosts: [], loading: false, error: null,
  })

  const mockAnalyze = vi.fn()
  renderProfile('u1', {
    user: { id: 'u1' },
    authLoading: false,
    signInWithGoogle: vi.fn(),
    analyze: mockAnalyze,
    getDateRangeHint: () => '',
    activePostId: null,
    cancel: vi.fn(),
    ready: true,
    settings: { chartType: 'bar' },
    updateSettings: vi.fn(),
  })

  expect(screen.getByTestId('chat-input')).toBeTruthy()
})
```

**IMPORTANT note on vi.mock inside a test:** In Vitest, `vi.mock` calls are hoisted to the top of the file. If `ChatInput` is already mocked globally in the file, this will conflict. Instead, add the ChatInput mock at the top of `ProfilePage.test.jsx` alongside the other mocks:

```jsx
// Add near the top with the other vi.mock calls:
vi.mock('../components/ChatInput', () => ({
  ChatInput: ({ onSubmit }) => (
    <div data-testid="chat-input">
      <button onClick={() => onSubmit && onSubmit('test query')}>submit</button>
    </div>
  ),
}))
```

And the test becomes:
```jsx
it('shows ChatInput on own profile', () => {
  useProfileFeed.mockReturnValue({
    profile: { id: 'u1', display_name: 'Nagi', avatar_url: '' },
    posts: [], replyPosts: [], loading: false, error: null,
  })
  renderProfile('u1', {
    user: { id: 'u1' },
    authLoading: false,
    signInWithGoogle: vi.fn(),
    analyze: vi.fn(),
    getDateRangeHint: () => '',
    activePostId: null,
    cancel: vi.fn(),
    ready: true,
    settings: { chartType: 'bar' },
    updateSettings: vi.fn(),
  })
  expect(screen.getByTestId('chat-input')).toBeTruthy()
})
```

Also add to ProfilePage.test.jsx the mock for PostCard (needed to avoid rendering the full PostCard component in profile tests):
```jsx
vi.mock('../components/PostCard', () => ({
  PostCard: ({ post }) => <div data-testid="post-card">{post.id}</div>,
}))
```

**Step 2: Run test — verify it FAILS**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/pages/ProfilePage.test.jsx
```

Expected: new test fails (ChatInput not rendered on own profile).

**Step 3: Update `ProfilePage.jsx`**

Add import for `ChatInput` and `useNavigate` (if not already imported):

```jsx
import { useParams, useNavigate } from 'react-router-dom'  // already present
import { ChatInput } from '../components/ChatInput'          // ADD THIS
```

Update the `ctx` destructuring at the top of `ProfilePage`:

```jsx
const {
  user, authLoading, signInWithGoogle,
  analyze, getDateRangeHint, activePostId, cancel, ready,
  settings, updateSettings,
} = ctx
```

Add the sticky ChatInput at the bottom of the `return` block, inside `<main>` but OUTSIDE the `<div className="mx-auto max-w-2xl...">` wrapper. Add it as a sibling after that div:

```jsx
return (
  <main className="relative flex-1 overflow-y-auto">
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      {/* ... all existing content ... */}
    </div>

    {/* ChatInput for own profile */}
    {isOwnProfile && !loading && (
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 z-10 bg-slate-50/75 dark:bg-[#0f172a]/75 backdrop-blur-md">
        <div className="mx-auto max-w-2xl">
          <ChatInput
            onSubmit={prompt => {
              analyze(prompt + getDateRangeHint())
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
  </main>
)
```

Note: change `<main className="flex-1 overflow-y-auto">` to `<main className="relative flex-1 overflow-y-auto">` so the absolute-positioned ChatInput positions correctly.

Also change the inner content wrapper padding from `pb-16` to `pb-24` to make room for the ChatInput bar.

**Step 4: Run tests — all must PASS**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/pages/ProfilePage.test.jsx
```

Expected: 7/7 pass.

**Step 5: Run full suite**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run
```

Expected: all pass.

**Step 6: Commit**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  git -C /Users/nagi/abudhabi-sales-explorer add \
    src/pages/ProfilePage.jsx \
    src/pages/ProfilePage.test.jsx && \
  git -C /Users/nagi/abudhabi-sales-explorer commit -m "feat: ChatInput on own profile to post new queries

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Wire new ctx props to ProfilePage in App.jsx + version bump + deploy

**Files:**
- Modify: `src/App.jsx` (add new props to outletContext)
- Modify: `package.json` (version 1.11 → 1.12)

**Context:** ProfilePage now needs `analyze`, `getDateRangeHint`, `activePostId`, `cancel`, `ready`, `settings`, `updateSettings` from ctx. These are already computed in App.jsx but were not in `outletContext` — add them. Then bump version and deploy.

**Step 1: Update `outletContext` in `src/App.jsx`**

Find the `outletContext` object and ensure it includes:
```js
const outletContext = {
  ready, dbError, meta,
  user, authLoading, signInWithGoogle, signOut,
  posts, addPost, removePost,
  analyze, analyzeReply, analyzeDeep, activePostId, cancel,
  settings, updateSettings, getDateRangeHint,
}
```

Compare to the current outletContext and add any missing keys. The `analyze`, `activePostId`, `cancel`, `getDateRangeHint`, `settings`, `updateSettings` should already be there from v1.11. Just verify they haven't been accidentally removed.

**Step 2: Bump version to 1.12**

```bash
sed -i '' 's/"version": "1.11"/"version": "1.12"/' /Users/nagi/abudhabi-sales-explorer/package.json
grep '"version"' /Users/nagi/abudhabi-sales-explorer/package.json
```

Expected: `"version": "1.12"`

**Step 3: Run full test suite — must be clean**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run
```

Expected: all tests pass.

**Step 4: Commit and push**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  git -C /Users/nagi/abudhabi-sales-explorer add src/App.jsx package.json && \
  git -C /Users/nagi/abudhabi-sales-explorer commit -m "chore: bump version to 1.12

Changes in this version:
- fix: UserBubble avatar aligns with bubble bottom (timestamp below row)
- fix: PostCard author avatar initials fallback on image error
- feat: Back button in header on profile routes
- feat: Replies tab expand/collapse shows full PostCard inline
- feat: ChatInput on own profile to post new queries

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  git -C /Users/nagi/abudhabi-sales-explorer push
```

---

## Verification checklist

- [ ] UserBubble: avatar bottom edge aligns with bubble bottom (not timestamp)
- [ ] UserBubble: timestamp appears below the bubble+avatar row
- [ ] PostCard: author shows initials circle (e.g. "NS") when Google photo fails
- [ ] Profile header: "Back" button with ← arrow replaces Feed/Charts tabs
- [ ] Clicking Back navigates to previous page in browser history
- [ ] Replies tab: post title has a › chevron, clicking expands full PostCard
- [ ] Replies tab: clicking again collapses the PostCard
- [ ] Profile Posts tab (own profile): ChatInput bar visible at bottom
- [ ] Submitting from profile ChatInput navigates to Feed and shows the new query running
- [ ] Posts tab on other people's profiles: NO ChatInput visible
- [ ] All existing features (query submission, dark mode, auth, sign-out) still work
- [ ] All tests pass
