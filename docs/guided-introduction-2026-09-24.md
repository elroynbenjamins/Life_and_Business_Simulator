# Guided introduction: first implementation pass

## Implemented

- Replace the four-page opening slideshow with Guide me / Explore freely.
- Fold the separate education introduction into this choice; both paths dismiss its old flag.
- Add a six-step, optional live-screen guide: cash flow, enrollment, course progress/optional boost explanation, student work, advancing a real week, and understanding the weekly result.
- Guide buttons only navigate or acknowledge/skip lessons. Game commands are never called by the tutorial; action completion is inferred from successful save-state changes.
- Highlight existing enabled Enroll / Advance buttons and the cash-flow / course-progress cards. Exact-label adapters are centralized; explicit typed tutorialId props are available for later screen integrations. Career currently receives screen-level guidance, not individual option highlights.
- Use an in-layout, height-bounded dock rather than a touch-blocking spotlight. Text scrolls, the underlying screen stays interactive, and navigation is not covered. Keyboard and major game dialogs suspend it; Android Back pauses it.
- Persist completed/skipped lesson records separately from gameplay saves. Tutorial state never adds rewards, changes cash, resets a save or requires an advertisement/purchase.
- Resume deliberately from Home/How To Play, not automatically on production save load. Slot/name/generation changes stop the active guide. Explicit replay starts a new lesson run; a new-game welcome also starts a fresh run even when reusing the same slot/name.
- Keep the live First Life Journey separate from completed knowledge, with its detailed goal list collapsed by default. An unfinished guided opening remains resumable after Year 1.
- Replace the long help article list with expandable reference chapters, including acquisitions, Holdings and optional Personal Life. These later chapters are reference help, not yet interactive tours.

## Storage

`life_empire_guidance_v1` is an independent AsyncStorage sidecar, version 1. It holds at most 12 sessions scoped to slot/name/generation. Hydration validates identifiers and finite baseline weeks. Writes are serialized. Failed storage does not block play and displays a small warning while guidance continues in memory. Active visibility is never restored automatically. This sidecar does not travel with exported gameplay saves.

## Verification

Engine tests cover state-driven completion, failed actions, graduated/employed saves, optional skips, year rollover, late-save replay, scope isolation, stale taps, storage validation/bounds and target exclusions. Repository typecheck/full test suite should be run before merging.

## Native QA still required

Fresh save: both welcome choices; tutorial never opens another education modal. Enroll, select either work option or skip, advance one week, close result/event dialogs, finish. Pause and resume, restart app, switch save, replace a save with the same name, and load an existing production save. Test small screens, large text, both themes, keyboard, Android Back, education ads, purchase dialogs and blocked cash advancement.

## Next implementation pass

Replace the compatibility target adapters with explicit screen-level anchors and guided scrolling where needed. Add individual student-work / navigation-tab anchors. Then add first-business and Holding treasury tours triggered on demand. Do not automatically queue all advanced chapters after the opening, and do not claim those tours or a dimmed spotlight are implemented by this pass.
