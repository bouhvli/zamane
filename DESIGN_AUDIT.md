# Zamane — Design System & UX Audit

> **Purpose of this document:** an actionable redesign brief. It was produced by a dual-agent design critique (an isolated design-director review + an isolated deterministic anti-pattern scan) on 2026-07-15. An AI agent (or a human) should be able to open this file and execute the fixes without re-deriving the analysis. Every finding carries a severity, the file/line it lives in, why it matters, and a concrete fix.
>
> **How to use:** work the phases in order (Phase 1 → 3). Do not "improve" anything listed under **Preserve** — those are deliberate, working decisions. Re-run `/impeccable critique src` after each phase to measure progress.
>
> **Owner-confirmed decisions (2026-07-15):** execute **all phases in order** (full scope, not a subset), and the hero policy in §4 Phase 2.1 is confirmed — **full dark PageHero on Home only**; all other pages get the compact light header. These are decisions, not open questions.

---

## 1. Context

- **Product:** Zamane — a mobile-first PWA for couples: shared savings goals (with contributions), trips (itineraries), shopping lists, profile/group pairing.
- **Register:** product UI (design serves the task). The bar is *earned familiarity* — a user fluent in Linear/Stripe-quality tools should trust every component, not pause at subtly-off ones.
- **Stack:** React + Vite + Tailwind v4 (`@theme inline`), shadcn-derived UI kit (`src/components/ui/`), react-hook-form + zod, react-router.
- **Design foundation files:** [src/styles/theme.css](src/styles/theme.css) (tokens), [src/styles/page-hero.css](src/styles/page-hero.css), [src/styles/bottom-nav.css](src/styles/bottom-nav.css), [src/styles/index.css](src/styles/index.css).
- **Fonts:** Geist (UI sans), Fraunces (display serif, SOFT=60), JetBrains Mono — loaded from Google Fonts in [index.html:28](index.html#L28).

## 2. Verdict & scores

**Overall: 24/40 (Acceptable — significant improvements needed).** This is **not** generic AI slop — the token work, form grammar, and mobile fundamentals are real. The dissatisfaction the owner feels comes from four systemic problems:

1. **The PageHero dark slab is worn by every page** — a marketing hero on utility screens, hitting three banned patterns (decorative glassmorphism, hero-metric chips, repeated uppercase eyebrows).
2. **The emotional weighting is inverted** — the core moment (contributing money to a shared goal) is silent, while trivial actions toast.
3. **No user control** — nothing can be edited or undone in a money app; deletes are one-tap and permanent.
4. **Theme leaks** — shadcn's neutral-`--accent` assumption collides with Zamane's saturated rose accent, flooding secondary buttons pink on hover; the base `h1–h3` Fraunces rule fights the app's own usage.

| # | Nielsen heuristic | Score /4 | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Contribution success produces no confirmation |
| 2 | Match system / real world | 3 | "New progress (%)", "General" goal type unexplained; no currency symbol on amount inputs |
| 3 | User control & freedom | 2 | No undo, no edit/delete for goals, trips, contributions |
| 4 | Consistency & standards | 3 | Profile hand-rolls cards; every `h2` must opt out of Fraunces |
| 5 | Error prevention | 2 | One-tap unconfirmed deletes; amount prefilled with `0` |
| 6 | Recognition over recall | 3 | Free-text shopping category silently forks "groceries"/"Groceries" |
| 7 | Flexibility & efficiency | 1 | One rigid path everywhere; no quick-add, no amount chips, no bulk actions |
| 8 | Aesthetic & minimalist design | 3 | Hero slab = 5 decorative layers before content on every page |
| 9 | Error recovery | 3 | Good inline `role="alert"`; catch-alls collapse to "Something went wrong" |
| 10 | Help & documentation | 1 | No contextual help anywhere |
| | **Total** | **24/40** | |

**Deterministic scan (detect.mjs):** `src/**` came back **clean** (exit 0); the only finding project-wide was `overused-font` for Fraunces in [index.html:28](index.html#L28). Conclusion: the problems are judgment-level (composition, hierarchy, UX flow), not mechanical anti-patterns — which matches the owner's "I'm not satisfied but the scanner is happy" instinct.

**Cognitive load:** 2/8 checklist failures (moderate) — progressive disclosure (every create-form fully expanded, e.g. the 4-field shopping add-form permanently open above the list) and visual hierarchy (the decorative hero dominates every screen instead of the task).

## 3. Preserve — do not regress these

1. **Token discipline.** The pink-tinted neutral ramp (`#F5EFF2` bg / `#FDFAFC` card), the documented contrast fixes (`--muted-foreground: #7A5566`, `--accent-strong: #8A3F58`), and the semantic z-index scale in [src/styles/theme.css](src/styles/theme.css) are deliberate and correct. Keep the inline audit comments.
2. **One form grammar.** Every form uses RHF + zod + `FormMessage` + `role="alert"` server errors + disabled-with-spinner submit. Never introduce a second pattern.
3. **Mobile fundamentals.** 44px button/icon tap targets ([src/components/ui/button.tsx](src/components/ui/button.tsx)), 44px checkbox hit-area wrapping a 20px visual ([ShoppingItemRow.tsx](src/components/shopping/ShoppingItemRow.tsx)), safe-area insets, `focus-visible` rings everywhere, `aria-current` nav, `role="progressbar"` with values, the route-loading pill in [AppLayout.tsx](src/components/layout/AppLayout.tsx).
4. **Voice.** The warm copy ("Join your partner", "You're paired up") and the custom flip-dot Loader are personality — keep them.
5. **Fraunces as a signature** — but only at the scoped moments defined in Phase 2.4 below.

---

## 4. Findings & fixes

### Phase 1 — P1: trust and feedback (do these first)

#### 1.1 Irreversible actions have no guardrails — in a money app
- **Where:** [ShoppingItemRow.tsx](src/components/shopping/ShoppingItemRow.tsx) (one-tap X delete, no confirm/undo), [ItineraryList.tsx](src/components/trips/ItineraryList.tsx) (same), [ContributionHistoryList.tsx](src/components/goals/ContributionHistoryList.tsx) (contributions can never be edited or removed).
- **Why:** a mistyped €500-instead-of-€50 contribution is permanent shared financial data between partners; a fat-fingered delete is unrecoverable. This is the "user would contact support" bar.
- **Fix:**
  - Deletes: keep one-tap speed but show a **toast with Undo** (5s window before the API call commits, or soft-delete + restore endpoint).
  - Contributions: add a delete affordance per history row (with confirm), or minimally a "Remove last contribution" action on GoalDetailPage. Requires an API endpoint — add `DELETE /api/goals/:id/contributions/:cid`.

#### 1.2 The core success moment is silent
- **Where:** [ContributionForm.tsx](src/components/goals/ContributionForm.tsx) — on success it resets the form and revalidates. Nothing else.
- **Why:** the app's whole premise peaks here; a distracted mobile user on slow network sees a spinner stop and an emptied form and doesn't know if it worked (double-submit risk). Meanwhile copying an invite code *does* toast — emotional weighting inverted.
- **Fix (layered):**
  1. Minimum: `toast.success("€50 added — you're 64% there")` with the real numbers.
  2. Animate the ProgressBar fill from old → new value (200ms ease-out).
  3. When `isCompleted` flips to true, render a one-time completion state on GoalDetailPage (distinct visual + copy acknowledging both partners), and **stop the pulsing status dot** — "Done" must not pulse.

#### 1.3 `outline`/`ghost` buttons flood saturated rose on hover
- **Where:** [src/components/ui/button.tsx](src/components/ui/button.tsx) — `outline` and `ghost` variants use shadcn's `hover:bg-accent hover:text-accent-foreground`. shadcn assumes `--accent` is a neutral; Zamane's `--accent` is brand rose `#BF6382` with white text.
- **Why:** "Log out", every ghost "Back", and every icon-delete button turn full pink on hover — heavy saturation on secondary states; the delete-X's own `hover:text-destructive` fights it.
- **Fix:** change those variants to `hover:bg-muted` (or `hover:bg-secondary`) with `hover:text-foreground`. Accent stays reserved for primary actions/selection/state.

### Phase 2 — P2: composition and control

#### 2.1 PageHero: a marketing hero worn by every utility page
- **Where:** [PageHero.tsx](src/components/layout/PageHero.tsx) + [page-hero.css](src/styles/page-hero.css) — dual radial glow blobs, dot grid, glassmorphic stat chips, pulsing status pill, uppercase tracked eyebrow ("HOME", "GOALS", …) rendered identically on all 9 app pages, including two-field form pages.
- **Why:** costs ~40% of the first viewport everywhere; hits three banned patterns (decorative glassmorphism, hero-metric template, eyebrow-on-every-section); makes all pages look identical at a glance; pushes the actual task below the fold.
- **Fix — hero policy:**
  - **Home only** keeps the full dark-gradient hero (it's the brand crown; it earns it there).
  - **List pages (Goals, Trips, Shopping, Profile):** compact light header — `h1` + one-line description + primary action. No glows, no dot grid, no glass chips, no eyebrow. Surface the one stat that matters as plain text if needed.
  - **Detail/form pages (GoalDetail, TripDetail, New*):** compact header **with a top-left back affordance** (currently "Back to all goals" is a text link at page *bottom* — move it to the top).
  - Drop the uppercase-tracked eyebrow device everywhere it merely restates the nav tab. Keep at most one deliberate use.

#### 2.2 Goals and trips can never be edited or deleted
- **Where:** [GoalDetailPage.tsx](src/pages/GoalDetailPage.tsx), [TripDetailPage.tsx](src/pages/TripDetailPage.tsx) — no edit, archive, or delete anywhere.
- **Why:** a typo'd target amount or a cancelled trip lives forever; heuristic 3 (user control) collapses on this alone.
- **Fix:** overflow menu (⋯) in the detail-page header with Edit and Delete (delete confirms; reuse the existing form pages in edit mode). Requires `PATCH`/`DELETE` API endpoints if missing.

#### 2.3 Form-control details undermining the polish
- **Where / fixes:**
  - [NewGoalPage.tsx](src/pages/NewGoalPage.tsx) goal-type buttons use `role="radio"` without roving tabindex or arrow-key handling — broken ARIA radio pattern. Implement the real radiogroup keyboard pattern (or use a proper RadioGroup primitive). Also add one line of helper text explaining Financial vs General ("General tracks progress in % — great for non-money goals").
  - Notes fields capped at 1000–2000 chars are rendered as single-line `<Input>` ([NewTripPage.tsx](src/pages/NewTripPage.tsx), [ItineraryItemForm.tsx](src/components/trips/ItineraryItemForm.tsx)). **Add a Textarea component** to the kit and use it.
  - Contribution amount defaults to literal `0` that must be cleared ([ContributionForm.tsx](src/components/goals/ContributionForm.tsx)). Use `undefined` + placeholder, add a **currency symbol prefix** inside the input, and add quick-amount chips (€10 / €25 / €50) above it.
  - Inputs are `h-9` (36px) while the project's own tap floor is 44px ([input.tsx](src/components/ui/input.tsx) vs button.tsx). Move inputs to `h-11`.
  - Rename the label "New progress (%)" → "Progress so far (%)" with helper text "Total progress, not the amount added."
  - Shopping category is free text ([ShoppingItemForm.tsx](src/components/shopping/ShoppingItemForm.tsx)) — "groceries" vs "Groceries" forks groups. Suggest existing categories (datalist or chip picker) and normalize case on save.
- **Why:** these are exactly the "subtly-off components" that make a fluent user stop trusting the product.

#### 2.4 Typography: scope the display serif; stop fighting the base layer
- **Where:** [theme.css](src/styles/theme.css) `@layer base` sets Fraunces on **all** `h1–h3`, so every section `h2` in the app opts out with `font-sans` (GoalDetailPage, ShoppingPage, ProfilePage…). Meanwhile [GoalCard.tsx](src/components/goals/GoalCard.tsx) and [TripCard.tsx](src/components/trips/TripCard.tsx) put `font-heading` on **every list-row title** — violating the project's own documented rule ("one-per-page moments only, never dense/repeated UI chrome", theme.css comments).
- **Fix:**
  - Remove Fraunces from the `h1–h3` base rule; keep the base rules sizing/weight only. Create a `.font-display` (or keep `font-heading` utility) applied **explicitly** at the one-per-page moments: PageHero greeting (Home), auth-screen titles, error-page headline. Everything else is Geist.
  - Remove `font-heading` from GoalCard/TripCard titles → `font-sans font-semibold`.
  - Detector note: Fraunces itself was flagged as an overused face. It's acceptable to keep (the SOFT-axis tuning is a real choice), but scoping it to rare moments is what makes it read as a signature instead of a template.

#### 2.5 Two competing pinks; consolidate the gradient family
- **Where:** ProgressBar fill uses `--nav-gradient` (violet → `#C026D3` → hot pink `#FF2D78`) while the system accent is dusty rose `#BF6382` — two unrelated pink families in one UI.
- **Fix:** pick one: either retire the hot-magenta stops from surfaces outside the Home hero, filling the ProgressBar with `--primary` → `--accent`, or formally promote `#FF2D78` to a token and remove `--accent` from progress contexts. One pink family per system.

#### 2.6 Dark mode is fully specified and fully unreachable
- **Where:** `.dark` token block in [theme.css](src/styles/theme.css) + `@custom-variant dark`; [index.html](index.html) advertises a dark `theme-color` — but nothing ever applies the `.dark` class.
- **Fix (pick one, don't leave it half-shipped):**
  - **A (recommended):** apply `.dark` at boot from `matchMedia("(prefers-color-scheme: dark)")` + listen for changes; add a manual toggle on ProfilePage later.
  - **B:** delete the `.dark` block and the dark `theme-color` meta until dark mode is a real feature.

### Phase 3 — P3: polish and efficiency

- **Reduced motion:** zero `prefers-reduced-motion` handling project-wide. Add `motion-reduce:animate-none` to the status-pill pulse, spinners, and progress sweep; guard the Loader's flicker animation.
- **Stop the perpetual pulse:** the hero status dot `animate-pulse` runs forever even on terminal states ("Done"). Pulse only while something is genuinely in-flight.
- **Skeletons over spinners:** route fallback and list loading use centered spinners ([router.tsx](src/router.tsx)). Add skeleton rows for goal/trip/shopping lists (product-register standard).
- **Bottom-nav active state on detail routes:** [BottomNav.tsx](src/components/layout/BottomNav.tsx) uses `pathname === tab.href`, so `/goals/123` highlights nothing. Use `pathname.startsWith(tab.href)` (with `/` exact-match for Home).
- **Thumb-zone creation:** "New goal"/"New trip" CTAs live inside the top hero — least reachable zone one-handed. After the Phase 2.1 header rework, place the primary create action within thumb reach (bottom-anchored button or FAB above the nav).
- **Shopping quick-add:** the highest-frequency action (add "Milk") costs a permanently-expanded 4-field form above the list ([ShoppingPage.tsx](src/pages/ShoppingPage.tsx)). Replace with a single inline input + Enter-to-add (name only; category/details editable after). Collapse the full form behind "Details".
- **Optimistic UI for check-off:** [ShoppingItemRow.tsx](src/components/shopping/ShoppingItemRow.tsx) disables the row and waits for round-trip + revalidate per tap. Toggle locally, reconcile on response, revert on error.
- **Separate checked items:** move bought items to a collapsed "Done" group at the list bottom instead of interleaving at 60% opacity.
- **Empty states:** GoalsPage's dashed "No goals yet" box is bland; reuse HomePage's teaching CTA-card pattern for Goals/Trips/Shopping empty states.
- **Hero chip label contrast (while heroes remain):** `page-hero-chip-label` at 35% white on the violet gradient ≈ 3:1 — fails AA at 12px. Raise to ≥ 70% white or drop the chips with Phase 2.1.
- **ProfilePage:** "Change password" (3 fields) renders permanently expanded — put it behind a disclosure. Replace hand-rolled card divs with the shared `<Card>`.
- **Currency everywhere:** amount inputs and hero stats should show the currency symbol; consider a "total saved" headline figure — the app's premise has no headline metric anywhere.
- **Contextual help:** one-line helper texts at the three confusion points: goal type choice, progress-% field, invite code ("Share this code — your partner enters it on their signup").

---

## 5. Acceptance checklist (definition of done)

- [ ] No destructive action commits without confirm or undo; contributions are correctable.
- [ ] Contributing shows immediate success feedback with real numbers; goal completion has a designed moment; nothing pulses in a terminal state.
- [ ] `outline`/`ghost` hover is neutral (`bg-muted`), never saturated rose.
- [ ] Full dark hero exists on Home only; all other pages use the compact header with top back affordance; no glass chips, dot grids, or uppercase eyebrows outside Home.
- [ ] Fraunces appears only at explicit one-per-page moments; no `font-sans` opt-outs needed on `h2`s; card titles are Geist.
- [ ] One pink family: ProgressBar and accent draw from the same ramp.
- [ ] Goals and trips have Edit/Delete; radiogroup is keyboard-correct; Textarea exists; inputs are 44px; amount fields have currency prefix + no literal `0` default.
- [ ] Dark mode either works via `prefers-color-scheme` or its tokens are removed.
- [ ] `prefers-reduced-motion` respected on every animation; lists load with skeletons.
- [ ] `/goals/123` highlights the Goals tab; shopping has one-line quick-add with optimistic check-off.
- [ ] Everything in **Preserve** (§3) still intact: tokens, form grammar, tap targets, focus rings, voice.

## 6. Suggested command sequence (impeccable skill)

1. `/impeccable harden` — Phase 1 (undo/confirm, contribution feedback, button hover remap).
2. `/impeccable layout` — Phase 2.1 hero policy + compact headers + thumb-zone CTAs.
3. `/impeccable typeset` — Phase 2.4 Fraunces scoping + base-layer cleanup.
4. `/impeccable harden` — Phase 2.2/2.3 edit-delete flows + form-control fixes.
5. `/impeccable polish` — Phase 3 sweep.
6. `/impeccable critique src` — re-score; target ≥ 32/40.
