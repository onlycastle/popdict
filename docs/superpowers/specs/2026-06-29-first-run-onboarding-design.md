# First-Run Onboarding — Design Spec

**Date:** 2026-06-29
**Status:** Approved design, pre-implementation
**Topic:** Make PopDict's first launch unmistakable, and turn the Settings panel into a persistent soft-onboarding home.

---

## Problem

PopDict is a **menu-bar-only app**: `electron/main.ts:90-92` calls `app.dock.hide()`, and the search window is created with `show: false` (`electron/windows/windowSpecs.ts:47`). After the user drags the app out of the DMG and launches it, there is no dock icon and no visible window — just a tray glyph most newcomers never look at. The launch *feels empty*: "Is it even running? What do I do?"

A first-run flow already exists but does not fully solve this:

- `electron/store.ts:11,18` — an `onboardingDone` flag (defaults `false`).
- `electron/main.ts:86-88` — opens a Welcome window on first run.
- `src/views/OnboardingView.tsx` — a 3-step welcome that ends with "Get started" → `finishOnboarding()`.

Gaps in the current flow:

1. **No spatial orientation.** It never points the user to the menu bar, which is the root cause of "where did it go?" on a tray app.
2. **Permission dead-end.** The Accessibility step (`OnboardingView.tsx:69-74`) tells the user to grant permission "then relaunch PopDict." macOS grants Accessibility out-of-process, so the app never gets an event; the code checks once and gives up.
3. **One-shot only.** Once dismissed, there is no re-openable surface that re-guides setup.

## Goal

Two complementary surfaces that share **one live setup-status source**:

1. A redesigned **first-run Welcome window** that orients the user spatially, proves the app works, and shows live setup status.
2. A persistent **"Getting Started" section at the top of Settings** that mirrors the same status, then steps aside once setup is complete.

Chosen approach: **Hybrid (A)** — strong welcome window + live Settings section, kept in sync by a shared status hook and a shared checklist component.

## Non-Goals (YAGNI)

- **No DMG installer-window redesign.** The confirmed pain is first *launch*, not the disk-image mount.
- **No dock icon or persistent main window.** PopDict stays a menu-bar app.
- **No multi-page wizard.** Single-window soft flow only.
- **No analytics/telemetry.**

---

## Design

### Surface 1 — Welcome window (first run)

Rebuild `OnboardingView.tsx` around the **"Menu-bar spotlight"** layout:

- **Menu-bar pointer (hero):** a small macOS menu-bar strip illustration with the PopDict icon highlighted and an upward arrow + caption "PopDict lives up here ↑". This is the first thing the user sees.
- **Orientation copy:** serif "Welcome to PopDict" + "It runs quietly in your menu bar — no dock icon, no window in your way."
- **Hotkey, large:** a `⌘ ⇧ Space` chip with "Press it from any app to pop up search."
- **Try-it nudge:** "Press `⌘ ⇧ Space` now to try it." This invokes the **real** search window (already wired via the global shortcut) — not an embedded demo field. Rehearsing the real interaction builds the correct muscle memory.
- **Live checklist** (shared component — see below): Hotkey ready / Select-to-lookup / Sign in to save (optional).
- **"Get started"** closes the window and sets `onboardingDone: true` (existing `finish-onboarding` IPC), regardless of permission state — the Settings section picks up any unfinished steps.

### Surface 2 — Settings "Getting Started" section (persistent)

Add a card at the **top** of `SettingsView.tsx`, above the existing Account/hotkey/toggle fields:

- **In progress:** title "Getting started" + `n / 3` count + a thin progress bar, then the same 3-row live checklist with inline action buttons (Enable / Sign in).
- **Complete:** collapses to a single green "You're all set up ✓" strip with a **Hide** link.
- The existing Settings fields are untouched and render below the card.

### Shared status model

The two surfaces must never disagree. Introduce a single source of truth:

- **`useSetupStatus()` hook** (`src/hooks/useSetupStatus.ts`) returns:
  - `hotkeyReady: boolean` — the global shortcut registered successfully at startup.
  - `selectionEnabled: boolean` — `isAccessibilityTrusted()` is `true`.
  - `signedIn: boolean` — from `useSupabaseAuth()`.
  - `authAvailable: boolean` — Supabase env configured (mirrors existing `auth.configured`).
  - `allRequiredDone: boolean` — `selectionEnabled` is the single required gate (see rule below).
  - It **polls `isAccessibilityTrusted` (~1.5s)** while the window is focused/visible, and stops on blur/hide. This closes the macOS out-of-process polling gap and removes the "relaunch" dead-end. The poll ticks both surfaces the instant permission is granted.
- **`<SetupChecklist>` component** (`src/components/SetupChecklist.tsx`) — a shared presentational checklist consumed by both `OnboardingView` and the Settings card. Props: the status object + action handlers (`onEnableSelection`, `onSignIn`). A `variant` prop ('welcome' | 'settings') controls only spacing/labels, not logic.

### Checklist items & "done" rules

| Item | Done when | Required? |
| --- | --- | --- |
| **Hotkey ready** | global shortcut registered at startup | informational ✓ (warns if registration failed) |
| **Select-to-lookup** | Accessibility granted | **Yes** — the one deliberate OS action; gates "all set" |
| **Sign in to save** | `auth.user` exists | No — always labelled optional, never blocks "done" |

- **Collapse rule:** the Settings card stays visible until `allRequiredDone` (Accessibility granted) **or** the user clicks **Hide**. Then it collapses to the green strip. Sign-in stays optional throughout, so a user who never signs in still reaches a complete state.
- **Hide** persists a new store flag so the card does not reappear on the next launch.

### State / store changes

- `electron/store.ts`: add `gettingStartedHidden: boolean` (default `false`) to `StoredConfig`, `DEFAULT_CONFIG`, and `withDefaults`. Keep `onboardingDone`.
- No new IPC channels required for status: `is-accessibility-trusted`, `request-accessibility`, `set-settings`, and auth are all already exposed. Add a tiny `set-getting-started-hidden` (or fold into existing `set-settings`) to persist the Hide flag, plus expose `gettingStartedHidden` in the settings payload.

### Main-process change

- `electron/main.ts` first-run branch (`:86-88`): after opening the onboarding window, **explicitly foreground it** (`win.show()` + `win.focus()`, and `app.focus({ steal: true })` on darwin). With the dock hidden, a freshly created window can open un-activated; forcing focus guarantees the user actually sees the Welcome window rather than nothing.

### Error handling

- **Hotkey registration failed:** the "Hotkey ready" row renders as a warning with a "Set a shortcut" affordance pointing at the existing hotkey field. (`hotkey.register()` already returns a boolean at startup — surface it.)
- **Accessibility never granted:** the Settings card persists (soft reminder); **Hide** is always available as the escape hatch.
- **Auth not configured** (`!auth.configured`): the "Sign in to save" row renders disabled/explanatory, matching the existing notice in `SettingsView.tsx:60-62`. It never counts against completion.
- **Polling hygiene:** the interval runs only while the window is focused/visible and is cleared on unmount/blur.

---

## Components & boundaries

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `useSetupStatus()` | Single source of setup truth; focus-gated accessibility polling | `window.electronAPI`, `useSupabaseAuth` |
| `<SetupChecklist>` | Presentational 3-row checklist + actions; no business logic | status object (props) |
| `OnboardingView` (rebuilt) | First-run welcome: menu-bar pointer, try-it nudge, checklist | `useSetupStatus`, `SetupChecklist` |
| `SettingsView` (extended) | Adds Getting Started card w/ collapse + Hide; existing fields unchanged | `useSetupStatus`, `SetupChecklist`, store |
| `store` (extended) | Persists `gettingStartedHidden` | — |
| `main.ts` (touched) | Foreground welcome window on first run | — |

Both views render the same checklist from the same hook — change the status logic once, both surfaces follow.

---

## Testing

- **Unit (Vitest):**
  - `useSetupStatus` — status derivation (`allRequiredDone`, optional sign-in, auth-unavailable), and that polling starts/stops with focus (mock `electronAPI`).
  - `store` — `gettingStartedHidden` default is `false`, survives `withDefaults` on partial/legacy config, and round-trips through `patch`.
  - `<SetupChecklist>` — renders the in-progress, all-done, hotkey-warning, and auth-unavailable states.
- **Manual (fresh-install simulation):** delete `~/Library/Application Support/PopDict/popdict-config.json`, launch, and verify: (1) the Welcome window foregrounds and points at the menu bar; (2) pressing the hotkey pops the real search; (3) granting Accessibility in System Settings ticks both surfaces live with no relaunch; (4) the Settings card collapses to the green strip; (5) Hide dismisses it and it stays hidden next launch.
- **Gates:** `tsc` + ESLint + Vitest must pass, then launch the packaged/dev app to confirm the flow end-to-end.

---

## Open questions

None blocking. The Hide-flag persistence (dedicated IPC vs. folding into `set-settings`) is an implementation detail to settle in the plan.
