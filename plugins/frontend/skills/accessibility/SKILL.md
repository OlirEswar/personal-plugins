---
name: accessibility
description: Audit and fix web accessibility to WCAG 2.2 AA - semantics, keyboard, focus, names/labels, contrast, target size, motion, forms - using automated axe scans in the browser plus manual checks. Use when building forms, dialogs, menus, custom widgets, or when asked about a11y, screen readers, keyboard support, or WCAG.
argument-hint: "[url or component]"
---

# Accessibility (WCAG 2.2 AA)

Automated tools find roughly a third of real issues. Run them first, then do the manual checks.

## Automated scan
Inject axe-core into the running page through the browser MCP (`browser_evaluate` or chrome-devtools `evaluate_script`):

```js
async () => {
  if (!window.axe) {
    await new Promise((res, rej) => { const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice'] });
  return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0,5).map(n => n.target.join(' ')) }));
}
```
If CSP blocks the CDN, use `@axe-core/playwright` in a test, or `npx @axe-core/cli <url>`. The accessibility tree snapshot (`browser_snapshot` or `take_snapshot`) shows what a screen reader sees.

## Manual checklist
- **Semantics**: use native elements first (`button`, `a[href]`, `label`, `fieldset`, `dialog`, `nav`, `main`). Each page has one `h1`, headings don't skip levels, and landmarks are present. Add ARIA only when no native element fits, and then follow the APG pattern.
- **Keyboard**: everything works with Tab, Shift+Tab, Enter, Space, Esc, and arrows. Use logical order and no positive `tabindex`. Dialogs trap focus and return it to the trigger on close. Include a skip link.
- **Focus visible**: show an obvious `:focus-visible` ring with at least 3:1 contrast. Never `outline: none` without a replacement. The focused element isn't hidden behind sticky headers (2.4.11).
- **Names**: icon-only buttons have `aria-label`. Inputs have associated `<label>`s, not just placeholders. Link text makes sense out of context. Images have `alt`, and decorative ones get `alt=""`.
- **Contrast**: 4.5:1 for text, 3:1 for large text (24px, or 18.66px bold), UI component boundaries, and focus indicators. Check both themes.
- **Target size**: at least 24×24 CSS px, or enough spacing (2.5.8).
- **Forms**: errors are shown as text (not only color), linked with `aria-describedby`, and focus or an announcement lands on the first error. Mark required fields. Use `autocomplete` attributes. Don't require re-entering data the user already gave (3.3.7). Accessible auth without cognitive puzzles (3.3.8).
- **Dynamic content**: announce async status with `aria-live="polite"` or `role="status"`. Don't move focus unexpectedly.
- **Motion**: respect `prefers-reduced-motion`, avoid auto-playing motion longer than 5s without a pause control, and nothing flashes more than 3 times per second.
- **Zoom and reflow**: usable at 200% zoom and at 320px width with no 2-D scrolling. Use relative units for text.
- **Dragging**: every drag action has a single-pointer alternative (2.5.7).

## Output
List each issue with its WCAG criterion number, impact, element selector, and fix. Fix them in order: critical and serious first. Re-run axe to confirm.

The `accessibility-auditor` agent can run a full-page audit in isolated context.
