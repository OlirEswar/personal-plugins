---
name: doodle-paper-design
description: Art-direct and build websites in a hand-drawn, paper-and-pencil style - graph-paper or notebook backgrounds, ink outlines, sketchy wobbling lines, sticky notes and tape, chunky pressable game-like buttons, simple-shape mascot characters, and playful low-poly 3D with ink outlines. Use ONLY when the request asks for that feel - e.g. doodle, sketchy, hand-drawn, notebook, graph paper, paper-like, sketchbook, scrapbook, "like someone drew it", crafty, whiteboard/marker, engineer's notepad, cute and playful like Duolingo. Do not use for generic, corporate, minimal, dark, or glossy designs.
---

# Doodle-on-paper web design

A look where the page *is* a sheet of paper someone is drawing on: a warm pad with a printed grid, graphite ink outlines, a few saturated "marker" colours, characters made from simple shapes, and motion that feels like a flipbook. It's playful but disciplined: one paper, one ink, one handwriting voice, everything else structural.

Reference build: the Nyquisition landing page (engineering-learning app), https://github.com/OlirEswar/nyquisition. Copy-ready material in this skill:

- `references/tokens-and-components.css`: tokens, paper grid, pressable buttons, chips, sheets and tape, sticky notes, clipboard, spiral notebook, margin pencil, torn footer, line-boil and draw-in doodles.
- `references/characters-2d.js`: faceted SVG mascots with a shared face kit and moods.
- `references/pencil-canvas.js`: hi-DPI canvas helpers for wobbly, seeded pencil charts.
 For any 3D, also load the **threejs** skill (toon shading + ink hulls + line boil).

## First, ground it in the subject

The paper metaphor must come from the product's world, not be pasted on. Decide before designing:

| Subject | Paper | Grid / rule | Ink accents |
| --- | --- | --- | --- |
| Engineering / maths | buff computation pad | non-photo-blue grid, red margin line | op-amp △, pole ×, zero ○ |
| Writing / journaling | cream notebook | blue ruled lines, red margin | fountain-pen blue, highlighter |
| Kids / games | sketchbook white | none, crayon texture | crayon-bright primaries |
| Design / product | dot-grid journal | dot grid | marker + sticky-note colours |
| Recipes / home | kraft or index card | faint red index-card rules | stamp red, pencil |

Use the subject's own symbols as decoration and characters (for engineering, the circuit and s-plane symbols became the mascots).

## Token system (adapt, don't copy blindly)

- **Paper**: one warm light background (e.g. `#fbf4df`), one *sheet* white for raised surfaces (`#fffbef`), one deeper tone for wells and edges.
- **Grid**: two layered `linear-gradient` grids on `body` (minor 24px, major 120px) in a desaturated blue at 25–50% alpha. Never pure grey.
- **Ink**: one graphite with a slight colour cast (e.g. `#2d2a3e`) used for *every* outline, text and shadow. Avoid `#000`/`#111`.
- **Markers**: 4–5 saturated colours, each owned by one character or concept, each with `-deep` (pressed edge/text) and `-tint` (background wash) variants.
- **Type**: a chunky *rounded* display face (Baloo 2, Fredoka, Nunito Black… pick per brand), a plain readable sans for body (Figtree, Atkinson…), and a **handwriting face used only for annotations** (Architects Daughter for engineers, Caveat/Patrick Hand otherwise). The handwriting is margin notes, arrows, axis labels and captions, never body copy or buttons.
- **Shape**: chunky radii on controls (12–16px), wobbly radii on paper scraps (`border-radius: 255px 18px 225px 18px / 18px 225px 18px 255px`), 2.5px ink borders, and *hard offset* shadows (`4px 5px 0 ink`) instead of blurred ones.

## Signature components

1. **Pressable buttons**: ink border, `box-shadow: 0 4px 0 ink`, translate down 4px and drop the shadow on `:active`; a translucent white lip across the top third. This is the Duolingo-like tactility.
2. **Paper scraps**: `.sheet` (white, ink border, offset shadow) at a 0.4–2° rotation; masking **tape** strips at the corners; **sticky notes** with a pin and a folded corner (`clip-path`).
3. **Real paper objects for real features**: a clipboard holding a quiz, a spiral notebook with tab dividers holding saved notes, a polaroid for the team photo. Use only when the object fits the feature.
4. **Margin line + scroll pencil**: a fixed red margin rule down the left; a graphite trace that scales with scroll progress, with a pencil at its tip. It works as a progress indicator.
5. **Doodles**: inline SVG arrows/underlines with `stroke-linecap: round`, drawn in with `stroke-dashoffset` when they enter the viewport, and a **line boil**: three SVG `feTurbulence + feDisplacementMap` filters with different seeds, cycled every ~170ms on a root data attribute. Apply boil to small doodles only (it's a paint cost).
6. **Torn edge**: a `clip-path` zig-zag on the top of the dark footer.
7. **Characters**: 3–5 mascots built from simple shapes with one shared face kit (two eyes with pupils + highlight, mouth, blush cheeks) and moods (happy, wink, wow, sad, sleepy). Draw 2D versions as *faceted polygons* so they match low-poly 3D versions. Give each a personality tied to the subject, and reuse them for avatars, empty states, toasts and 404s.

## Motion: flipbook, springs, and things you can poke

- One orchestrated load moment (e.g. headline "stamps" in, characters drop and bounce). No fade-up on every section.
- Springs with overshoot (`cubic-bezier(.34,1.56,.64,1)`) for things that pop; quick ease-out for state changes.
- Squash-and-stretch on pokes; characters' eyes follow the cursor; they glance down when the page scrolls.
- Line boil at ~6fps on outlines (CSS filter in 2D, shader in 3D) for a hand-redrawn quality.
- Every playful thing must be *interactive*, not just animated: poke, drag, toss, toggle, scrub. Give keyboard/button equivalents.
- `prefers-reduced-motion`: drop boil, draw-ins, idle bobbing and smooth scroll; keep the interactions.

## Charts and simulations "in pencil"

Draw on `<canvas>` with seeded wobble (stable between frames, never shimmering), round caps, arrowheaded axes, and handwritten axis labels. Use the character colours for series, with a dashed graphite target line. Mark special points with the subject's symbols (× for poles). See `references/pencil-canvas.js`.

## Copy voice

Plain, warm, a little nerdy, and specific to the subject. Puns belong in the hero line and character dialogue, not in buttons. Buttons say exactly what happens ("Create account", "Try a lesson"). Handwritten annotations talk to the visitor ("psst. you can pick us up").

## Avoid

- Handwriting fonts for body text or UI labels. Comic Sans energy.
- Clip-art doodles scattered everywhere. Every doodle points at, underlines or explains something.
- Pure black, blurred grey drop shadows, glassmorphism, gradients as decoration.
- Terracotta-on-cream "AI default" palettes. The marker colours should be bright and owned by characters.
- All-caps eyebrow labels and `→` on buttons.
- Identical rounded cards in grids. Vary the paper objects instead (sheet, sticky, clipboard, notebook, polaroid).

## Bugs this style is prone to (seen in production)

- `* { margin: 0 }` resets break `<dialog>` centring: restore `dialog { margin: auto }`.
- `display: grid/flex` on a component overrides the `hidden` attribute: add `[hidden] { display: none !important }`.
- Rotated sheets and offset shadows cause horizontal overflow on phones: `html, body { overflow-x: clip }`, and test at 390px.
- Chunky display type in narrow cards overflows ("Electromagnetics" in a 3-up grid): size grids from the longest label (`minmax(min(100%, 200px), 1fr)`), and use `overflow-wrap: anywhere` as a fallback.
- Bottom-corner toasts get clipped by macOS window corners and the Dock, and cover bottom action bars: put toasts top-right under the header, 24px from the edge, and cap the stack at 3.
- Ink-outlined 3D props near the canvas edge show up as a "black bar" when only the outline is visible: fit-check props and hide ones that don't fully fit.
- The decorative ink hull doesn't work on zero-thickness meshes; outline those with edge lines.

## Build checklist

- [ ] Paper, grid, ink, 4–5 markers, 3 fonts (display / body / hand) defined as tokens on `:root`.
- [ ] Hero opens with the most characteristic thing in the subject's world, drawn or playable.
- [ ] At least one interactive toy relevant to the product (a mini lesson, a simulation, a 3D scene).
- [ ] Characters appear consistently: hero, empty states, toasts, avatars, 404.
- [ ] Every page has real states: loading, error, empty, success. Forms validate inline in the interface's voice.
- [ ] Screenshot at 1440, 1024, 768 and 390px; check overflow (`scrollWidth === clientWidth`) and that no content escapes its card.
- [ ] Reduced motion, visible focus rings (`outline: 3px solid` a marker colour), contrast on tinted papers.
