# RPG Your Way accessibility standard

RPG Your Way targets **WCAG 2.2 Level AA** for pages and complete user flows that the site controls.

Accessibility is a release requirement, not a one-time audit. The automated checks in `scripts/validate-accessibility.mts` are regression guards. They do not certify conformance and they do not replace testing with real browsers and assistive technology.

## Code-level requirements

- Every page has a meaningful title, a main landmark, and a logical heading structure.
- The global skip link must reach `#main-content`.
- All functionality must be operable from a keyboard. Do not create pointer-only interactions.
- Focus must be visible and must not disappear when dialogs or responsive panels open, close, or replace one another.
- Modal dialogs must have an accessible name, trap focus while open, close with Escape when appropriate, make background content unavailable to assistive technology, and restore focus on close.
- Form controls must have programmatic names. Instructions, errors, and constraints must be associated with their controls when they are needed to complete the field.
- Dynamic status, error, progress, and conversational updates that matter without a focus change must use an appropriate live-region pattern.
- Images need useful alternative text when informative and an empty `alt` when decorative.
- Information and state cannot depend on color alone.
- Drag interactions need a non-drag alternative. Character reordering in Play keeps explicit move-up and move-down controls.
- Motion must respect `prefers-reduced-motion`, and the Play motion preference must continue to offer a user override.
- Essential text and controls must survive zoom and responsive reflow without requiring two-dimensional scrolling for ordinary page content.
- Interactive targets should meet the WCAG 2.2 AA 24 by 24 CSS-pixel minimum unless an allowed exception applies.
- Do not remove visible focus styles, semantic labels, status announcements, or keyboard alternatives to simplify visual styling.

## Manual release checks

Before describing the site as conforming, test the deployed build rather than source code alone. At minimum:

1. Complete every major flow with keyboard only, including Start, Play, Account, Script, dialogs, menus, and campaign return/import paths.
2. Check at 200% zoom and 400% zoom/reflow at a narrow viewport. Confirm text is readable and controls remain reachable without clipped content.
3. Test Play and Start with **NVDA + Firefox or Chrome** on Windows.
4. Test the principal navigation and forms with **VoiceOver + Safari** on macOS or iOS.
5. Spot-check **Narrator + Edge** on Windows.
6. Test reduced motion and Windows forced-colors/high-contrast mode.
7. Verify that asynchronous errors, usage notices, recording state, roll results, and AI conversation updates are announced without forcing focus unexpectedly.
8. Verify third-party payment transitions and document any accessibility limitation outside RPG Your Way's control.

Record defects as product bugs and fix blockers before making a conformance claim.
