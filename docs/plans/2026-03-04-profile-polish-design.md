# Profile Polish + Feed UX Fixes — Design Doc (v1.12)

**Date:** 2026-03-04
**Status:** Approved

## Overview

Five targeted fixes and improvements based on user feedback after v1.11 shipped.

---

## Fix 1: UserBubble bottom alignment

**Problem:** The timestamp is inside the bubble column, so `items-end` on the flex row aligns the avatar to the bottom of the column+timestamp — placing the avatar lower than the bubble's bottom edge.

**Solution:** Extract a wrapper column that stacks the bubble+avatar row on top and the timestamp below. The inner row uses `items-end` so the avatar and bubble share a common bottom edge.

```
Before:
  <div flex items-end>          ← avatar aligned to column bottom (incl. timestamp)
    <div flex-col>
      <bubble />
      <timestamp />
    </div>
    <avatar />
  </div>

After:
  <div flex-col items-end>       ← outer wrapper, right-aligned
    <div flex items-end gap-2>   ← bubble + avatar, BOTH bottom-aligned
      <bubble />
      <avatar />
    </div>
    <timestamp />                ← sits below the row, does not affect alignment
  </div>
```

**Files:** `src/components/UserBubble.jsx`, `src/components/UserBubble.test.jsx`

---

## Fix 2: PostCard author avatar — initials fallback

**Problem:** PostCard's author `<img>` has no `onError` handler. When a Google OAuth photo URL fails (expired, CORS, etc.), the browser renders a torn-image icon instead of a graceful fallback.

**Solution:** Add `imgError` state to PostCard. When the image errors, render a small circle with the `initials()` utility (already in `src/utils/initials.js`). Applied to both the `<Link>` branch (when `post.userId` exists) and the plain-div branch. The circle uses `bg-accent/10 text-accent` to match the brand.

**Files:** `src/components/PostCard.jsx`

---

## Fix 3: Profile header — back button replaces Feed/Charts tabs

**Problem:** When viewing `/profile/:userId`, the header still shows "Feed | Charts" navigation, which looks wrong for a focused profile view (not matching the X pattern the user referenced).

**Solution:** In `App.jsx`, use `useMatch('/profile/:userId')` to detect the profile route at render time. When matched:
- Replace the Feed/Charts tab nav with a single `← Back` button
- Button calls `navigate(-1)` (browser history)
- Octopus logo, theme toggle, and profile avatar menu remain unchanged

This costs zero new state — `useMatch` is reactive to route changes automatically.

**Files:** `src/App.jsx`

---

## Fix 4: Replies tab — inline expand/collapse

**Problem:** `ReplyContextCard` currently shows only the post title, which the user described as "useless". There's no way to see the full post context.

**Solution:** Add a local `expanded` boolean state to `ReplyContextCard`. The title header becomes a clickable row with a chevron that rotates on expand. When expanded:
- The full `PostCard` renders inline (read-only: `onReply={null}`, `isActive={false}`, `onCancel={null}`, `onDeepAnalysis={null}`)
- The user's reply bubbles appear below the PostCard

Layout:
```
Collapsed:
  ┌──────────────────────────────────────┐
  │ › Ready vs Off-Plan Price Gap…       │
  └──────────────────────────────────────┘

Expanded:
  ┌──────────────────────────────────────┐
  │ ˅ Ready vs Off-Plan Price Gap…       │
  │ ┌──────────────────────────────────┐ │
  │ │  PostCard (read-only)            │ │
  │ └──────────────────────────────────┘ │
  │   user bubble 1            [NS]      │
  │   user bubble 2            [NS]      │
  └──────────────────────────────────────┘
```

The `post` prop already has `analysisText`, `chartData`, etc. — no extra Supabase fetch required.

`ReplyContextCard` also needs `user` and `onSignIn` props passed through for PostCard's auth-gating (even though `onReply` is null, PostCard still renders a sign-in prompt).

**Files:** `src/pages/ProfilePage.jsx`

---

## Fix 5: New query from own profile

**Problem:** There's no way to submit a query from the Profile page's Posts tab.

**Solution:** When `isOwnProfile` is true, show a sticky `ChatInput` bar at the bottom of ProfilePage (same styling as FeedPage). On submit:
1. Call `ctx.analyze(prompt + ctx.getDateRangeHint())`
2. Navigate to `/` so the user lands on the Feed to watch the query run

ProfilePage needs to destructure additional props from `ctx`:
- `analyze`, `getDateRangeHint` (for submission)
- `activePostId`, `cancel`, `ready` (for ChatInput state)

Only shown when `isOwnProfile && !loading`.

**Files:** `src/pages/ProfilePage.jsx`

---

## Implementation order

1. Fix 1: UserBubble alignment (small, isolated)
2. Fix 2: PostCard author avatar fallback (small, isolated)
3. Fix 3: App.jsx back button (touches App.jsx only)
4. Fix 4: ProfilePage Replies expand/collapse (moderate)
5. Fix 5: ProfilePage new query ChatInput (moderate)
6. Bump version to 1.12, full suite, deploy

---

## Testing notes

- Fix 1: Update UserBubble tests — restructure the DOM, existing alignment/initials tests should still pass
- Fix 2: PostCard has no existing test file; no tests to update
- Fix 3: App.jsx has no test file; no tests to update
- Fix 4: ProfilePage tests need one new test for expand/collapse behavior
- Fix 5: ProfilePage tests need one new test verifying ChatInput renders for own profile
