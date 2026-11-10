---
name: design-system
description: Create or extend a design system - design tokens (color in OKLCH, spacing, type scale, radii, shadows, motion), semantic theming with light/dark mode, Tailwind v4 @theme and shadcn/ui CSS variables, and component variants. Use when starting a new UI, adding a theme/dark mode, unifying inconsistent styles, or when components use hard-coded values.
argument-hint: "[what to set up or change]"
---

# Design system and tokens

Components should only consume **semantic tokens**. Raw values live in exactly one place.

## 0. Discover what exists
Look for `tailwind.config.*`, the `@theme` block in global CSS, `components.json` (shadcn), CSS custom properties in `:root`, theme objects (MUI/Chakra/styled-components), and Figma variables (the `figma-to-code` skill). Extend what's there rather than adding a parallel system.

## 1. Token layers
1. **Primitives**: raw scales such as `--gray-50…950` and `--blue-50…950`, spacing `0.25rem` steps, and the type scale.
2. **Semantic**: purpose-based names that components use, such as `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--border`, `--ring`, `--destructive`, `--card`, `--popover`. This matches shadcn naming, which keeps registry components drop-in.
3. **Component** (optional): `--button-height-md`, and so on, only when a value is truly component-specific.

Dark mode remaps the **semantic** layer only (`.dark { --background: … }` or `@media (prefers-color-scheme: dark)`). Primitives never change.

## 2. Color
- Define ramps in **OKLCH** so lightness is perceptually even: keep chroma and hue roughly constant and step L, for example from 0.98 down to 0.15.
- Use one neutral ramp (tinted slightly toward the brand hue), one brand ramp, and status colors (success, warning, danger, info).
- Pair every background token with a `-foreground` token and check AA contrast for each pair in both themes.
- Dark mode isn't an inversion: lower the chroma, use surfaces around L 0.15–0.25 instead of pure black, and show elevation with lighter surfaces rather than shadows.

## 3. Scales
- **Spacing**: 4px base (0, 1, 2, 3, 4, 6, 8, 12, 16, 24 × 4px).
- **Type**: modular scale around 1.2–1.25 (12, 14, 16, 18, 20, 24, 30, 36, 48, 60). Define line-height and letter-spacing per step and use `clamp()` for fluid display sizes.
- **Radius**: a single `--radius` with derived sm, md, lg. **Shadows**: 3–5 elevation levels. **Motion**: duration and easing tokens (see the `motion` skill). **Z-index**: named layers (dropdown, sticky, overlay, modal, toast).

## 4. Tailwind v4 wiring
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
:root { --background: oklch(0.99 0.003 260); --foreground: oklch(0.21 0.02 260); --primary: oklch(0.55 0.2 260); --primary-foreground: oklch(0.98 0.01 260); --radius: 0.625rem; }
.dark { --background: oklch(0.17 0.015 260); --foreground: oklch(0.96 0.005 260); }
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
}
```
In Tailwind v3, map the same variables in `theme.extend.colors`.

## 5. Components
- Express variants with `cva` (or the project's equivalent). Keep the variant axes small and orthogonal: `variant`, `size`, `tone`.
- Use the shadcn MCP (`search_items_in_registries`, `view_items_in_registries`, `get_add_command_for_items`) to pull primitives instead of hand-rolling them. Then restyle with tokens, not by forking logic.
- Document each token group and component in a demo page or Storybook so `design-review` has something to screenshot.

## Guardrails
No hex, rgb, or px values for color and spacing in component files, apart from 1px borders. Grep for `#[0-9a-fA-F]{3,8}\b` and arbitrary Tailwind values like `-\[` after making changes.
