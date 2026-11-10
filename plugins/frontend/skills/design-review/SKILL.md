---
name: design-review
description: Visually QA a UI in a real browser - screenshot across breakpoints, themes and states, then critique hierarchy, spacing, typography, color, alignment and states and fix the issues. Use after building or changing any UI, when asked to "polish", "make it look better", "review the design", or before shipping a frontend change.
argument-hint: "[url or route] [component/page]"
---

# Design review loop

Code that looks right can still render wrong, so judge the UI from what actually renders. Work in passes: **capture → critique → fix → re-capture**. Stop when a pass turns up nothing above "nit".

## 1. Capture
- Make sure the dev server is running. Find the command in `package.json`, start it in the background, and reuse it if it's already up.
- Use the browser MCP: Playwright (`browser_navigate`, `browser_resize`, `browser_take_screenshot`) or chrome-devtools (`navigate_page`, `resize_page`, `take_screenshot`).
- Capture at least **375×812** (mobile), **768×1024** (tablet), **1440×900** (desktop). If the app has a theme toggle, capture both **light and dark**.
- Capture each **state** that exists: hover/focus (use `browser_hover`, and Tab for focus), loading, empty, error, overflow (long names, 3-line titles, 0 and 1000 items), disabled.
- Check the browser console for errors and warnings at the same time.

## 2. Critique (in priority order)
1. **Broken**: overlap, clipping, horizontal scroll on mobile, invisible text, layout shift, console errors.
2. **Hierarchy**: one clear primary action per view. The heading, body, and meta levels should be distinguishable at a glance (squint test). Avoid having everything bold or everything the same size.
3. **Spacing and alignment**: use the spacing scale (4/8-based or the project's tokens), with no magic numbers. Related items sit closer together than unrelated ones. Edges line up to a shared grid.
4. **Typography**: body text 16px+ on mobile, line length 45–75ch, line-height around 1.4–1.6 for body and tighter for headings. Limit to 2–3 weights and one type scale.
5. **Color**: semantic tokens only, no raw hex in components. Contrast meets AA (see the `accessibility` skill). Use accent color sparingly, for meaning.
6. **States and feedback**: every interactive element has hover, focus-visible, active, and disabled styles. Async actions show pending state. Empty states say what to do next.
7. **Consistency**: radii, shadows, icon sizes, and button heights match the rest of the app and the design system.
8. **Responsiveness**: content reflows instead of shrinking, and touch targets are at least 24px (44px preferred).

## 3. Fix
- Fix by priority. Reuse existing components and tokens before adding new ones, and add new tokens to the design system rather than inline.
- Keep visual changes scoped. Don't restyle unrelated screens.

## 4. Report
Give a short table of `issue | severity (broken/major/minor/nit) | fix applied`, then before/after screenshots of the most important fixes if the user is following along.

For a second opinion on large changes, delegate to the `ui-reviewer` agent. It reviews with fresh context and doesn't edit code.
