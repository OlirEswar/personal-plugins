---
name: motion
description: Add purposeful animation and micro-interactions - timing and easing tokens, enter/exit transitions, layout animations, View Transitions API, scroll effects - while staying performant (compositor-only) and respecting prefers-reduced-motion. Use when asked to animate, add transitions, make the UI feel smoother or more polished.
argument-hint: "[element or interaction]"
---

# Motion and interaction

Motion should explain something, such as a change, where an element came from, or a cause and effect. Leave it out when it's only decoration.

## Tokens
| Use | Duration | Easing |
|---|---|---|
| Hover/press feedback | 100–150ms | `ease-out` |
| Small enter (tooltip, dropdown) | 150–200ms | `cubic-bezier(0.16, 1, 0.3, 1)` (out-expo-ish) |
| Large enter (modal, sheet) | 200–300ms | same, or a spring |
| Exit | ~75% of the enter duration | `ease-in` |
| Layout/position change | 200–350ms | `cubic-bezier(0.2, 0, 0, 1)` or a spring |
Keep UI transitions under 400ms. Store these as CSS variables (`--duration-fast`, `--ease-out`) or as Tailwind theme values.

## Rules
- Animate only `transform` and `opacity` (and `filter` sparingly) so the work stays on the compositor. Never animate `width`, `height`, `top`, `left`, or `box-shadow` in loops. For height, use the `grid-template-rows: 0fr → 1fr` trick or `interpolate-size: allow-keywords`.
- Enter from where the element originates: dropdowns scale from their trigger (`transform-origin`), sheets slide from their edge.
- Stagger lists by 20–40ms per item and cap the total stagger.
- Don't block input: animations must be interruptible, and the user shouldn't have to wait for one to finish.
- **Reduced motion**: wrap non-essential motion in `@media (prefers-reduced-motion: no-preference)`, or use `motion-safe:` in Tailwind. Under reduced motion, replace slides and zooms with fades, or remove them.

## Tools
- CSS transitions and `@starting-style` handle enter animations for elements newly in the DOM, including `<dialog>` and popovers.
- **View Transitions API**: `document.startViewTransition()` for same-document changes, and `@view-transition { navigation: auto; }` for MPA route changes. Use `view-transition-name` for shared elements.
- **Motion** (`motion/react`, formerly Framer Motion): use it for springs, layout animations (`layout` prop), `AnimatePresence` exit animations, and gestures. Check the bundle cost and import from `motion/react-m` with `LazyMotion` where it matters.
- Scroll-driven animations use `animation-timeline: view()` in CSS before reaching for JS scroll listeners.

## Verify
Check smoothness in the chrome-devtools performance trace (no long frames during the animation), and test with reduced motion turned on (`emulate` media feature `prefers-reduced-motion: reduce`).
