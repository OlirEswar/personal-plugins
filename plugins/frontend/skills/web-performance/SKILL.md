---
name: web-performance
description: Measure and improve Core Web Vitals (LCP, INP, CLS), bundle size, and loading performance using Chrome DevTools traces, Lighthouse, and bundle analysis. Use when a page is slow, when asked about performance, Lighthouse scores, bundle size, hydration cost, or before launching a page.
argument-hint: "[url or route]"
---

# Web performance

**Measure first.** Every optimization should be justified by a number from a trace or report.

## Targets (75th percentile, mobile)
| Metric | Good | What usually hurts it |
|---|---|---|
| LCP | ≤ 2.5s | slow TTFB, render-blocking CSS/JS, lazy-loaded or unprioritized hero image, client-only rendering |
| INP | ≤ 200ms | long tasks over 50ms, heavy re-renders, synchronous work in handlers, hydration |
| CLS | ≤ 0.1 | images or embeds without dimensions, web-font swaps, injected banners, late-loading ads |

## Measure
1. **Trace**: with the chrome-devtools MCP, call `performance_start_trace` (reload: true) on the page, then `performance_stop_trace`, then `performance_analyze_insight` for the LCP breakdown, render-blocking requests, long tasks, and layout shifts. Emulate a mid-tier phone with `emulate` (CPU 4× slowdown, Slow 4G).
2. **Lighthouse (CI-style)**: `npx -y lighthouse <url> --only-categories=performance --form-factor=mobile --output=json --output-path=./lh.json --chrome-flags="--headless=new"`. Read `audits` from the JSON rather than pasting the whole report.
3. **Bundle**: build with the framework's analyzer, such as `ANALYZE=true` with `@next/bundle-analyzer`, `vite-bundle-visualizer`, or `npx source-map-explorer dist/**/*.js`. Look for duplicate libraries, whole-library imports (lodash, date-fns locales, icon packs), and large client components.
4. **Network**: use `list_network_requests` to find waterfalls, uncompressed assets, and missing caching headers.

## Common fixes
- **LCP image**: `fetchpriority="high"`, not lazy, correct `sizes` and `srcset`, AVIF/WebP, preloaded if it's discovered late. Do the work on the server (SSR/SSG/streaming) instead of on the client.
- **JS**: code-split by route and interaction (`import()` / `lazy`), move work to server components, defer third-party scripts, and drop polyfills for modern browsers.
- **INP**: split long tasks (`scheduler.yield()` or `setTimeout` chunks), use `startTransition` / `useDeferredValue` for non-urgent updates, virtualize long lists, and debounce expensive handlers. Avoid layout thrashing (reading layout after writing it).
- **CLS**: set `width` and `height` or `aspect-ratio` on media, reserve space for async UI, and use `font-display: optional` or `swap` with size-adjusted fallbacks (next/font does this).
- **Fonts**: self-host, subset, preload one or two critical files, and use variable fonts.
- **Caching**: hashed assets get `Cache-Control: immutable`. Use a CDN for static assets and compress with brotli.

## Report
Show before and after numbers for each metric, list what changed, and note any trade-offs. Re-measure under the same throttling settings.
