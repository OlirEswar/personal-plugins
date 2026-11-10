---
name: threejs
description: Build interactive three.js (WebGL) scenes for websites - renderer setup, low-poly and toon/doodle styling, playable objects (raycast picking, drag, toss, squash-and-stretch), scroll-linked 3D, simple physics, and performance/accessibility hygiene. Use whenever a page needs 3D models, a WebGL canvas, three.js, react-three-fiber, or "something the user can play with in 3D".
---

# three.js for product websites

Target: three **r187** (`npm i three`). Check `node_modules/three/package.json` before relying on an API you remember from an older release - three breaks APIs every few versions. Grep `node_modules/three/src` for `deprecated` / `has been removed` when unsure.

Read `references/patterns.md` for copy-ready code (renderer bootstrap, outline shader, drag/toss, cart-pole physics, offscreen pausing).

## Version facts that bite (r150 → r187)

- Imports: `import * as THREE from 'three'` and addons from `three/addons/...` (e.g. `three/addons/geometries/RoundedBoxGeometry.js`). Never `three/examples/js`.
- `THREE.Clock` is **deprecated (r183)**. Use `THREE.Timer`: `timer.update(timestamp)` once per frame inside the rAF callback, then `timer.getDelta()` / `getElapsed()`. `timer.connect(document)` pauses delta across hidden tabs.
- `PCFSoftShadowMap` is **removed** in WebGLRenderer (falls back with a warning). Use `PCFShadowMap` (default) or `VSMShadowMap`.
- Color management is on by default: `renderer.outputColorSpace = SRGBColorSpace`; hex colors on materials are treated as sRGB and converted. Don't "fix" washed-out colors by hand-tuning hex values - check lighting/tone mapping first.
- Lights use physical units (no `useLegacyLights`). Typical page scene: `HemisphereLight(sky, ground, 2–3)` + one `DirectionalLight(…, 2–3)` casting shadows. `AmbientLight` alone looks flat and dead.
- `Geometry` is long gone; everything is `BufferGeometry`. To build custom low-poly shapes, start from built-ins with low segment counts, or `BufferGeometryUtils.mergeGeometries`.
- `WebGPURenderer` + TSL exist (`three/webgpu`), but for marketing pages stay on `WebGLRenderer` unless you need compute; it has the widest support and ShaderMaterial/onBeforeCompile work.
- `MeshToonMaterial` doesn't declare `flatShading`, but setting `material.flatShading = true` works (the renderer reads it) — that's how you get faceted cel shading.
- In `onBeforeCompile` on a **`MeshBasicMaterial`**, `objectNormal` is *not* declared (no lighting chunks). Use the `normal` attribute directly. Shader compile errors print once, then every frame spams `useProgram: program not valid` — scroll to the first error.

## Bugs that cost time on real builds

- **TDZ in scene wrappers**: `const stage = new Stage(canvas, { onResize: () => stage.camera… })` throws if the wrapper calls callbacks synchronously from its constructor. Defer the first `resize()` and observer hookups with `queueMicrotask`.
- **Bundle bloat**: any static import chain that reaches `three` (even for a tiny `hasWebGL()` helper) pulls ~700 kB into the page entry. Keep feature-detection in a three-free module and `import()` scene modules lazily.
- **Off-centre subjects**: to put 3D content beside a headline without perspective skew, use `camera.filmOffset` rather than moving the camera/lookAt. For a shift of fraction `f` of the frame width: `cam.filmOffset = -f * cam.aspect * 2 * tan(fov/2) * cam.getFilmWidth()`. The world x at the canvas centre becomes `-f * frustumWidth`; recompute drag/physics bounds from that.
- **Inked props at the frame edge read as a black bar.** When an outlined object is mostly off-canvas, the visible sliver is its dark hull — users see a "black vertical bar" at certain window sizes. Fit-check decorative props by projecting their extremes (`v.project(camera)`, keep |x|,|y| < 0.96) on every resize and hide them when they don't fit. Zero-thickness meshes (paper planes, cards) can't use inverted hulls at all; outline them with `EdgesGeometry` + `LineSegments`.
- **Spacing by available area**, not constants: size crew spacing from `viewWidthAt(distance)` and the fraction of the canvas they may occupy, with a clamp; otherwise characters overlap at one breakpoint and float apart at another.

## Renderer bootstrap rules

1. `new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })`.
2. `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` - never uncapped (4K phones melt).
3. Size from the **canvas's CSS box** with a `ResizeObserver`, not `window.innerWidth`: `renderer.setSize(w, h, false)` then `camera.aspect = w/h; camera.updateProjectionMatrix()`.
4. Use `renderer.setAnimationLoop(fn)` (or your own rAF) and **stop it when the canvas is offscreen** (`IntersectionObserver`) or the tab is hidden. Multiple canvases on one page are fine if only visible ones render. Browsers cap live WebGL contexts at ~16; keep a page to ≤4.
5. Transparent canvas (`alpha: true`, no `scene.background`) lets CSS paper/gradients show through - best for blending 3D into a 2D page design.
6. Tone mapping: `ACESFilmicToneMapping` desaturates bright brand colors. For flat, saturated, illustrative palettes use `NoToneMapping` (default) or `AgXToneMapping` with exposure ~1.

## Low-poly style recipe

- Built-ins with tiny segment counts: `IcosahedronGeometry(r, 0|1)`, `CylinderGeometry(rt, rb, h, 5–8)`, `ConeGeometry(r, h, 5–7)`, `TorusGeometry(r, t, 6, 12)`, `CylinderGeometry(r, r, depth, 3)` for a triangular prism.
- `flatShading: true` on `MeshLambertMaterial` / `MeshStandardMaterial({ roughness: 0.9, metalness: 0 })` / `MeshToonMaterial`. Faceting is the look; do not smooth normals.
- Optional jitter: displace vertices by a small seeded random amount, then `geometry.computeVertexNormals()` so rocks/terrain look hand-cut. Re-index first (`mergeVertices`) if you want shared vertices to move together.
- Limit the palette to the brand's 4–6 colors + one shadow tint. Saturated base colors read best with a warm hemisphere light.

## Doodle / hand-drawn look

- **Inverted-hull outlines**: clone the mesh, `MeshBasicMaterial({ color: ink, side: BackSide })`, push vertices along normals in the vertex shader (`onBeforeCompile`) by a fixed thickness. Gives thick, ink-pen outlines without postprocessing and works with transparent canvases. Use `transformed += normal * thickness` - for flat-shaded meshes, compute outline normals from a smoothed (merged) copy so the hull doesn't crack at hard edges.
- **Line boil**: add stepped time (`floor(uTime * 6.0)`) noise to the hull offset so outlines wiggle at ~6 fps like animated pencil drawings. Keep amplitude tiny (0.003–0.01 world units).
- Contact shadow instead of a lit floor: a `ShadowMaterial({ opacity: 0.15 })` plane, or a radial-gradient `CanvasTexture` sprite under each object (cheap and scales well).
- Pair 3D with SVG doodles in the DOM (arrows, labels in a handwritten font) positioned over the canvas - project 3D points with `vector.project(camera)` to anchor them.

## Making it playable

- **Picking**: one `Raycaster`; convert pointer to NDC from `canvas.getBoundingClientRect()` (not window). Raycast against an array of *hit proxies* (simple invisible boxes/spheres) rather than detailed meshes - cheaper and easier to grab.
- **Drag**: on `pointerdown` over an object, `canvas.setPointerCapture(e.pointerId)`, intersect a drag plane (`THREE.Plane`) to get world position, move the object there. Track velocity over the last few frames; on release, apply it so the object can be **tossed**, then run gravity + floor bounce + damping.
- **Touch**: set `touch-action: pan-y` on the canvas so vertical page scroll still works on phones; only call `preventDefault` once a drag has actually started on an object.
- **Juice**: squash-and-stretch (`scale.set(1+s, 1-s, 1+s)` decaying spring), eyes that track the pointer (`lookAt` a point on a plane in front of the camera, clamped), small idle bob with per-object phase offsets, a sound-free "boing" via DOM text popups.
- Use critically damped springs (`x += v*dt; v += (k*(target-x) - c*v)*dt`) for everything follow-y; they're frame-rate independent with small fixed substeps (e.g. 1/120 s).
- Hover cursor: set `canvas.style.cursor = 'grab'` when the ray hits a proxy, `grabbing` while dragging.

## Scroll-linked 3D

- Drive scene parameters from a normalized progress value (0–1) computed from the section's bounding rect or GSAP ScrollTrigger `onUpdate: self => progress = self.progress`. Ease toward the target inside the render loop (`current += (target - current) * (1 - Math.exp(-dt * 8))`) so it stays smooth with any scroll library.
- Never re-create geometry on scroll; mutate transforms/uniforms only.

## Performance checklist

- Draw calls < ~100 per scene; merge static geometry or use `InstancedMesh` for repeats (confetti, grid dots, trees).
- Shadows: one shadow-casting light, `shadow.mapSize` 1024, tight `shadow.camera` bounds. Or fake them with blob sprites.
- Reuse geometries/materials across meshes; dispose (`geometry.dispose()`, `material.dispose()`, `renderer.dispose()`) when tearing down SPA routes.
- Avoid allocating `new Vector3()` inside the loop - keep scratch vectors at module scope.
- Lazy-init scenes when they approach the viewport (`IntersectionObserver` with `rootMargin: '200px'`), and dynamic-`import()` heavy scene modules so the hero text paints first.

## Accessibility & resilience

- Canvas gets `role="img"` + `aria-label` describing what it shows, or `aria-hidden="true"` if purely decorative with the same info in text. Provide keyboard alternatives for any game mechanic (arrow keys, buttons).
- `prefers-reduced-motion: reduce` → no idle animation/auto-rotation; render on interaction only. Keep the scene usable.
- Feature-detect WebGL (`canvas.getContext('webgl2')`) and show a static illustration fallback; wrap renderer creation in try/catch.
- Never block page scroll: wheel events over the canvas must pass through unless the canvas is explicitly a "zoom" control.

## Verifying visually

Screenshot the page in a real browser (Playwright / Chrome DevTools MCP) after changes - check: colors not washed out, outlines not cracked, objects fit at 375px width, nothing renders when offscreen (Performance panel), no console warnings from three (deprecations print once).
