# frontend

A setup for frontend-heavy and design-heavy projects.

## Prerequisites

- Node 18+ with `npx` (runs the MCP servers)
- TypeScript LSP: `npm i -g typescript-language-server typescript`
- Figma MCP: run `/mcp`, pick **figma**, and authenticate once (needs a Figma account with Dev Mode)
- Chrome installed (for the chrome-devtools MCP)

## Contents

| Kind | Name | Purpose |
|---|---|---|
| skill | `design-review` | Screenshot, critique, fix loop across breakpoints, themes, and states |
| skill | `accessibility` | WCAG 2.2 AA: axe scan injected in the browser, plus a manual checklist |
| skill | `web-performance` | Core Web Vitals with DevTools traces, Lighthouse, and bundle analysis |
| skill | `design-system` | Tokens (OKLCH, scales), dark mode, Tailwind v4 `@theme`, shadcn vars |
| skill | `figma-to-code` | Figma MCP context and variables mapped onto existing components and tokens, verified visually |
| skill | `motion` | Timing and easing tokens, compositor-only animation, View Transitions, reduced motion |
| skill | `component-architecture` | Composition, state placement, RSC split, effects, forms |
| skill | `threejs` | Interactive three.js (r187) for sites: low-poly toon and ink outlines, drag/toss physics, scroll-linked 3D, perf and a11y |
| skill | `doodle-paper-design` | Hand-drawn, paper-and-pencil art direction and components; triggers only when the brief asks for that feel |
| agent | `ui-reviewer` | Read-only design QA in a fresh context |
| agent | `accessibility-auditor` | Read-only full a11y audit |
| agent | `performance-auditor` | Read-only perf profiling |
| mcp | `chrome-devtools` | Google's DevTools MCP: perf traces, network, console, emulation |
| mcp | `shadcn` | Search, view, and add shadcn/registry components |
| mcp | `figma` | Figma remote MCP: design context, variables, screenshots |
| hook | PostToolUse | Formats edited files with the project's own Biome or Prettier (no-op without one) |
| dep | `frontend-design` | Anthropic's distinctive-UI design skill (official marketplace) |
| dep | `playwright` | Playwright browser automation MCP (official marketplace) |
| dep | `context7` | Up-to-date library docs MCP (official marketplace) |
| dep | `typescript-lsp` | TS/JS code intelligence (official marketplace) |
