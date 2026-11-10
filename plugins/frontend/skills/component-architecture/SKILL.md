---
name: component-architecture
description: Structure frontend components and state well (React/Next.js focus, applies to Vue/Svelte) - composition over configuration, where state should live, server vs client components, data fetching, forms, effects, error/loading boundaries, and file organization. Use when designing new features, refactoring tangled components, or reviewing frontend code structure.
argument-hint: "[feature or component]"
---

# Component architecture

Check the project's framework and version first (`package.json`) and follow its existing conventions. Use context7 to look up current docs rather than relying on memory, especially for Next.js, React 19, TanStack, and other fast-moving libraries.

## Composition
- Prefer **composition** (children, slots, compound components such as `<Card><Card.Header/>`) over long boolean prop lists. Five or more booleans usually means the component should be split.
- Keep presentational components (props in, markup out) separate from containers that fetch, mutate, and route.
- Put a component in the shared `components/` directory only after a second use. Until then, keep it next to the feature that uses it.
- Write a headless hook (`useCombobox`) for complex behavior, and lean on Radix, React Aria, or Ark primitives for accessible widgets.

## State placement
Pick the lowest option on this list that works:
1. **Derived** values: compute them during render, never store them in state or sync them with an effect.
2. **Local** `useState`/`useReducer` in the component that owns it.
3. **URL** (search params): filters, tabs, pagination, anything that should survive a shareable link.
4. **Server cache** (TanStack Query, SWR, RSC + `revalidate`): anything that comes from the server. Don't copy it into global state.
5. **Context**: low-frequency, widely needed values like theme, user, and locale. Split contexts by update frequency.
6. **Global store** (Zustand, Jotai): genuinely shared client state that's updated often.

## Effects
You probably don't need an effect if you're deriving data, transforming data for render, resetting state when a prop changes (use a `key` instead), or responding to an event (do that in the handler). Use effects only to sync with external systems such as subscriptions, imperative widgets, or `document.title`.

## Server/client split (RSC frameworks)
- Server components are the default: fetch data there, keep secrets there, and ship less JS.
- Put `"use client"` on the smallest interactive leaf and pass server data down as props or children.
- Use Server Actions or route handlers for mutations. Validate on the server with a schema (zod or valibot) shared with the form.
- Every async segment gets loading UI (`<Suspense>` or `loading.tsx`) and an error boundary (`error.tsx`).

## Forms
Use native `<form>` + `action` + `useActionState` (React 19), or react-hook-form + zod. Show field-level errors linked to their inputs, disable or indicate pending submits, and make submissions idempotent on the server.

## Performance hygiene
Use stable keys (never the index for reorderable lists), lift expensive subtrees out of frequently re-rendering parents, and virtualize long lists. Memoize only after profiling, unless the React Compiler is enabled, in which case don't hand-memoize.

## Types
Type props explicitly, use discriminated unions for variant props, keep `any` out of component APIs, and infer API types from the schema (zod, OpenAPI, tRPC) instead of duplicating them.
