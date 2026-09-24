# Guided introduction: first implementation pass

## Implemented

- Replace the four-page opening slideshow with Guide me / Explore freely.
- Fold the separate education introduction into this choice; both paths dismiss its old flag.
- Add six optional live-screen lessons: cash flow, enrollment, course progress/optional boost explanation, student work, advancing a real week, and understanding the weekly result after closing its report.
- Guide buttons only navigate or acknowledge/skip lessons. Game commands are never called by the tutorial; action completion is inferred from successful save-state changes.
- Highlight existing enabled Enroll / Advance buttons and the cash-flow / course-progress cards. Exact-label adapters are centralized; explicit typed tutorialId props are available for later screen integrations. Career currently receives screen-level guidance, not individual option highlights.
- Use an in-layout, height-bounded dock rather than a touch-blocking spotlight. Text scrolls, the underlying screen stays interactive, and navigation is not covered by the dock. Keyboard and major game dialogs suspend it; Android Back pauses it.
- Persist completed/skipped lesson records separately from gameplay saves. Tutorial state never adds rewards, changes cash, resets a save or requires an advertisement/purchase.
- Resume deliberately from Home/How To Play, not automatically on production save load. Slot/name/generation changes stop the active guide. Explicit replay starts a new lesson run. Guide me on a new-game welcome starts fresh; Explore freely forgets any previous guide for that reused slot/name. A rolled-back save never waits to catch up with an older tutorial baseline.
- Keep the live First Life Journey separate from completed knowledge, with its detailed goal list collapsed by default. Unfinished guided lessons remain resumable after Year 1.
- Replace the long help article list with expandable reference chapters, including acquisitions, Holdings and optional Personal Life. Later chapters are reference help, not yet interactive tours.

## Storage

`life_empire_guidance_v1` is an independent AsyncStorage sidecar, version 1. It holds at most 12 sessions scoped to slot/name/generation. Hydration validates identifiers and finite baseline weeks. Writes are serialized. Failed storage does not block play and displays a small warning while guidance continues in memory. Active visibility is never restored automatically. This sidecar does not travel with exported gameplay saves.

## Verification coverage

Engine: state-driven completion, failed actions, graduated/employed saves, optional skips, year rollover, late-save replay, scope isolation, stale taps, storage validation/bounds and target exclusions.
Store: pause/resume/replay, rolled-back saves, per-scope forget, separate serialized persistence and recovery after storage failure.
Components: opt-in only, real versus rejected enrollment, modal suspension, real week completion, disabled button highlights, save switching, Android Back, both welcome choices and Year-2 resume.

Integration preserved the newer acquisition/capital-basis work. A previously stale economyCycle test used a break-even subsidiary while expecting a management fee. The test now uses a profitable fixture to isolate the four-week buffer and separately asserts the existing no-fee-for-loss/break-even and 35%-of-profit protections. No production economy rule was changed by that test correction.

## Native QA still required

Fresh save: both welcome choices; enroll, select either work option or skip, advance one week, close result/event dialogs, finish. Pause and resume, restart app, switch saves, replace a save with the same name, and load an existing production save. Test small screens, large text, both themes, keyboard, Android Back, education ads, purchase dialogs and blocked cash advancement. Automated component tests do not replace real-device layout/input verification.

## Next implementation pass

Replace compatibility target adapters with explicit screen-level anchors and guided scrolling where needed. Add individual student-work / navigation-tab anchors and direct Transport routing from the journey. Then add first-business and Holding treasury tours triggered on demand. Do not automatically queue all advanced chapters after the opening, and do not claim those tours, direct Transport routing or a dimmed spotlight are implemented by this pass.
