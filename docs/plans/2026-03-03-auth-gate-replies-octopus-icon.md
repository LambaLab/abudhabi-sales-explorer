# Auth-Gate Replies + Fix Octopus Icon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Block unauthenticated users from posting follow-up replies (show a Facebook-style sign-in modal instead), and fix the broken octopus avatar in AI reply bubbles.

**Architecture:** A new `SignInModal` component is rendered inside `PostCard` and controlled by local state. When a guest clicks "Ask a follow-up" or a clarification chip, the modal opens instead of the reply input. `user` and `onSignIn` props are threaded down `App → PostFeed → PostCard`. The octopus icon fix is a one-line asset path correction in `AIBubble`.

**Tech Stack:** React 19, Vite, Tailwind v4, Vitest + @testing-library/react

---

### Task 1: Fix broken octopus icon in AIBubble

**Files:**
- Modify: `src/components/AIBubble.jsx:35`

**Step 1: Write the failing test**

Add to `src/components/AIBubble.test.jsx` (check existing tests first to understand mock setup):

```jsx
it('renders octopus.png (not octopus.svg) as the AI avatar', () => {
  const reply = { status: 'done', analysisText: 'hello', createdAt: Date.now() }
  render(<AIBubble reply={reply} onReply={() => {}} postId="p1" />)
  const img = document.querySelector('img[src="/octopus.png"]')
  expect(img).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/components/AIBubble.test.jsx
```

Expected: FAIL — no `img[src="/octopus.png"]` found (current src is `/octopus.svg`)

**Step 3: Fix the src in AIBubble.jsx**

In `src/components/AIBubble.jsx` line 35, change:
```jsx
<img src="/octopus.svg" alt="" className="h-full w-full object-contain p-0.5" />
```
to:
```jsx
<img src="/octopus.png" alt="" className="h-full w-full object-contain p-0.5" />
```

**Step 4: Run test to verify it passes**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/components/AIBubble.test.jsx
```

Expected: All AIBubble tests PASS

**Step 5: Commit**

```bash
git -C /Users/nagi/abudhabi-sales-explorer add src/components/AIBubble.jsx src/components/AIBubble.test.jsx
git -C /Users/nagi/abudhabi-sales-explorer commit -m "fix: use octopus.png (not .svg) in AIBubble avatar"
```

---

### Task 2: Create SignInModal component

**Files:**
- Create: `src/components/SignInModal.jsx`
- Create: `src/components/SignInModal.test.jsx`

**Step 1: Write the failing tests**

Create `src/components/SignInModal.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SignInModal } from './SignInModal'

describe('SignInModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <SignInModal open={false} onClose={() => {}} onSignIn={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows headline and Google sign-in button when open=true', () => {
    render(<SignInModal open={true} onClose={() => {}} onSignIn={() => {}} />)
    expect(screen.getByText(/sign in to join/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeTruthy()
  })

  it('calls onSignIn when Google button is clicked', () => {
    const onSignIn = vi.fn()
    render(<SignInModal open={true} onClose={() => {}} onSignIn={onSignIn} />)
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    render(<SignInModal open={true} onClose={onClose} onSignIn={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn()
    const { container } = render(
      <SignInModal open={true} onClose={onClose} onSignIn={() => {}} />
    )
    // The backdrop is the outermost div with the onClick handler
    fireEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/components/SignInModal.test.jsx
```

Expected: FAIL — module not found

**Step 3: Create SignInModal.jsx**

Create `src/components/SignInModal.jsx`:

```jsx
/**
 * SignInModal — Facebook-style sign-in gate.
 * Shown when a guest tries to post a follow-up reply.
 *
 * Props:
 *   open      — boolean
 *   onClose   — called when backdrop or × is clicked
 *   onSignIn  — called when Google sign-in button is clicked
 */
export function SignInModal({ open, onClose, onSignIn }) {
  if (!open) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Card — stop propagation so clicking inside doesn't close */}
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-8 flex flex-col items-center gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        {/* Octopus icon */}
        <img src="/octopus.png" alt="" className="h-12 w-12 object-contain" />

        {/* Headline */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Sign in to join the conversation
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ask follow-up questions and save your queries to the shared feed.
          </p>
        </div>

        {/* Google sign-in button */}
        <button
          onClick={onSignIn}
          aria-label="Sign in with Google"
          className="mt-2 w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
        >
          {/* Google G logo */}
          <svg className="h-5 w-5" viewBox="0 0 24 24">
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

**Step 4: Run tests to verify they pass**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run src/components/SignInModal.test.jsx
```

Expected: 5/5 PASS

**Step 5: Commit**

```bash
git -C /Users/nagi/abudhabi-sales-explorer add src/components/SignInModal.jsx src/components/SignInModal.test.jsx
git -C /Users/nagi/abudhabi-sales-explorer commit -m "feat: add SignInModal component for guest auth gate"
```

---

### Task 3: Wire SignInModal into PostCard + thread props

**Files:**
- Modify: `src/components/PostCard.jsx`
- Modify: `src/components/PostFeed.jsx`
- Modify: `src/App.jsx`

**Step 1: Read PostFeed.jsx first**

```bash
cat /Users/nagi/abudhabi-sales-explorer/src/components/PostFeed.jsx
```

**Step 2: Update PostCard.jsx**

3a. Import `SignInModal` and `useState` at top of `PostCard.jsx`:
```jsx
import { SignInModal } from './SignInModal'
```
(`useState` is already imported)

3b. Add `user` and `onSignIn` to `PostCard` props:
```jsx
export function PostCard({ post, onReply, isActive, onCancel, onDeepAnalysis, chartType = 'bar', onDelete, currentUser, user, onSignIn }) {
```

3c. Add modal state inside `PostCard` (after existing `useState` calls):
```jsx
const [showSignIn, setShowSignIn] = useState(false)
```

3d. Add a guard helper inside `PostCard`:
```jsx
function requireAuth(fn) {
  if (user) return fn()
  setShowSignIn(true)
}
```

3e. In the `ReplyInput` render (line ~350), change:
```jsx
{onReply && isDone && (
  <div className="pt-1">
    <ReplyInput postId={post.id} onSubmit={onReply} disabled={hasActiveReply} />
  </div>
)}
```
to:
```jsx
{onReply && isDone && (
  <div className="pt-1">
    {user ? (
      <ReplyInput postId={post.id} onSubmit={onReply} disabled={hasActiveReply} />
    ) : (
      <button
        onClick={() => setShowSignIn(true)}
        className="text-sm text-slate-400 dark:text-slate-500 hover:text-accent dark:hover:text-accent transition-colors flex items-center gap-1.5"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        Ask a follow-up
      </button>
    )}
  </div>
)}
```

3f. For clarification chips (line ~331), wrap the `onClick` with `requireAuth`:
```jsx
onClick={() => requireAuth(() => onReply(post.id, option))}
```

3g. Add `SignInModal` at the bottom of the article (just before `</article>`):
```jsx
<SignInModal
  open={showSignIn}
  onClose={() => setShowSignIn(false)}
  onSignIn={() => { setShowSignIn(false); onSignIn?.() }}
/>
```

**Step 3: Update PostFeed.jsx**

Add `user` and `onSignIn` to PostFeed's props and forward to PostCard.

Read the file first, then find where `PostCard` is rendered and add:
```jsx
user={user}
onSignIn={onSignIn}
```

**Step 4: Update App.jsx**

Find the `<PostFeed` usage and add:
```jsx
user={user}
onSignIn={signInWithGoogle}
```

**Step 5: Run the full test suite**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run
```

Expected: All tests pass (no existing tests should break since `user` and `onSignIn` are new optional props)

**Step 6: Commit**

```bash
git -C /Users/nagi/abudhabi-sales-explorer add \
  src/components/PostCard.jsx \
  src/components/PostFeed.jsx \
  src/App.jsx
git -C /Users/nagi/abudhabi-sales-explorer commit -m "feat: gate follow-up replies behind auth — show SignInModal for guests"
```

---

### Task 4: Run full suite + deploy

**Step 1: Run all tests**

```bash
PATH="/Users/nagi/.nvm/versions/node/v24.13.1/bin:$PATH" \
  /Users/nagi/abudhabi-sales-explorer/node_modules/.bin/vitest run
```

Expected: All tests pass, output pristine (no errors/warnings)

**Step 2: Push to deploy**

```bash
git -C /Users/nagi/abudhabi-sales-explorer push
```

Vercel will auto-deploy on push.

---

## Verification Checklist

- [ ] `/octopus.png` appears in AI reply bubbles (not broken image)
- [ ] Signed-out user: clicking "Ask a follow-up" opens SignInModal
- [ ] Signed-out user: clicking a clarification chip opens SignInModal
- [ ] SignInModal: clicking backdrop or × closes without signing in
- [ ] SignInModal: clicking "Sign in with Google" triggers Google OAuth
- [ ] Signed-in user: reply input works normally, no modal
- [ ] All tests pass
