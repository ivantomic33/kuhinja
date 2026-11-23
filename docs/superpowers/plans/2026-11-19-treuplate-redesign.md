# TreuPlate redesign implementation plan

**Goal:** A legible, calm Serbian kitchen workspace and a credible product landing page, preserving the existing routes and business logic.

**Architecture:** Refine existing components and Tailwind utilities. Restore the standard 4 px spacing unit, then adjust shared controls and each screen's layout. No new dependencies or backend features.

**Spec:** User's attached TreuPlate redesign brief and screenshots; layout proposal in the conversation.

## Constraints and decisions
- Retain Next.js, React, Tailwind v4, Inter, logo, dark palette and orange accent.
- Preserve calculations, validation, auth, billing, limits, offline cache/synchronization and destructive confirmations.
- Work in place: the TreuPlate app is untracked within an already heavily changed repository; a worktree from HEAD would contain a different app. Preserve existing changes; do not commit them.
- Implement inline, following the user's request to proceed with a better UI; no additional planning approval round.

## Tasks
- [x] Foundation: remove conflicting spacing overrides; refine shared panels, typography, buttons, navigation, dialogs and mobile safe areas. Inspect every spacing consumer through source and responsive checks.
- [x] Workspace: prioritize shift prep and recent recipes, demote counters, refine recipe rows and ingredient tables. Remove unsupported ingredient filters/bulk actions. Distinguish load errors and empty/search states.
- [x] Working screens: ingredients left/calculation summary right, separate advanced controls, compact desktop scaling keypad, nonoverlapping shift action, honest price-history empty state.
- [x] Marketing/auth/billing: two-column landing hero and labeled product example, focused two-column auth, consistent Premium naming and source prices, accurate annual billing, unavailable Tim and PDF, deduplicate billing links.
- [x] Verification: regression test for empty history before fixing; existing tests, TypeScript, ESLint, production build; browser checks at 390/768/1280/1440 including long names, currency, keyboard, dialogs, reduced motion and offline where available.

## Review focus
- Restoring spacing changes all sizes, including icons and form controls.
- Long user text and large amounts must not widen the page.
- Dialog focus must remain inside and return to the trigger.
- No fabricated user records or unsupported product promises.
- Fixed shift actions must clear the sidebar, bottom nav and safe area.

## Progress
- Initial inspection complete. Existing dev server on port 3000; no connected document session.
- All tasks complete. Final verification: 24 tests, clean ESLint, TypeScript and production build; 60 responsive checks and 44 interaction assertions pass.
- Independent review findings were corrected and verified; full changed-file list and limitations are in the redesign report.
