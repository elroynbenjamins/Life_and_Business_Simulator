# Guided introduction: precise targets and navigation

This pass follows `guided-introduction-2026-09-24.md`. It improves the existing six-lesson opening without adding more mandatory lessons or changing economy rules.

## Player-facing changes

- Home cash flow and the Advance button use explicit tutorial identifiers. Renaming a button no longer changes whether it is a tutorial target.
- Education identifies one eligible Basic-course Enroll button as an example. Players can still choose any eligible course. Show me restores the Basics filter and requests locating again; ordinary manual filter changes remain available.
- Current Education has its own progress target. The optional education boost remains visible and is not a completion requirement.
- Career locates the Student Work card and outlines both Flexible and High-Hours options equally. Buttons have distinct accessibility labels and a minimum 44-point height. Full-time employment removes the student-work target and disables those choices as before.
- Home and Education navigation icons receive emphasis when the guide asks the player to open those tabs. Career is not a visible bottom tab, so it continues to use a direct Open Career action.
- The First Life Journey transport objective is now Open Transport and opens `/housing?section=transport`. Lifestyle validates the section parameter, defaults to Housing for unknown input, and retains manual tab switching.
- The dock now offers Show me on the current screen. Missing controls yield a dismissible explanation with retry/skip options, not an input-blocking overlay.

## Scrolling and safety

`TutorialScrollView` uses a real native View for viewport measurement and attaches each target to its actual native control. Geometry is calculated from current measured positions, viewport height, content height and scroll offset, with bounds checks. Native ScrollView is used only for scrolling, not as a View measurement API.

Locating uses bounded retries and non-animated scrolling. Manual drag, manual education filter changes, pause, route changes, disabled controls and stale requests prevent pending locating callbacks from moving the screen. Missing, zero-size and detached targets do not block gameplay. Existing scroll callbacks are forwarded. The guide remains an in-layout panel, not a dimmed full-screen spotlight.

Focus requests and navigation emphasis are ephemeral presentation state. They are not saved in gameplay data or the tutorial sidecar. Enrollment, student work, vehicle changes and weekly progression still use their existing commands; the tutorial does not invoke them automatically.

## Automated coverage

Measured scrolling geometry includes already-visible, above/below viewport, oversized, boundary-clamped and corrupt-layout cases. Focus-state tests cover stale callbacks, cancellation, timeout, retry and pause. Screen tests cover explicit identifiers, the actual available course button, restoring Basics, both student-work choices, unavailable student work, Transport deep links, manual tab switching, callback forwarding and safe missing-target recovery. Existing tutorial/save/economy tests remain part of full validation.

## Still needs device verification

Automated React Native component tests do not prove pixel layout or physical-device touch behaviour. Verify portrait/landscape, small screens, larger text, both themes, keyboard visibility, native scrolling, Android Back, ads and purchase dialogs on a device before release. This pass does not publish a store build.

## Next scope

Add short opt-in Business and Holdings chapters, using these explicit anchors. Explain the actual business/holding balances, protected reserves and transaction previews. Do not automatically queue advanced chapters after the beginner opening.
