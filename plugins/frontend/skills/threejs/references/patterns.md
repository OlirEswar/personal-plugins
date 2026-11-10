# three.js patterns (tested on r187)

Working, production-used versions of every pattern live in the reference build, https://github.com/OlirEswar/nyquisition, under `src/js/three/` (the condensed snippets below are enough on their own):

| Pattern | File |
| --- | --- |
| Canvas wrapper: CSS-box sizing, offscreen pausing, `THREE.Timer`, NDC + screen projection helpers | `src/js/three/stage.js` |
| Toon gradient map, inverted-hull outlines with 6 fps line boil, blob shadows, paper lighting | `src/js/three/toon.js` |
| Low-poly characters: extruded shapes, face kit (eyes track a target, blink), squash spring, hit proxies | `src/js/three/characters.js` |
| Pick / drag on a camera-facing plane / toss with velocity history / gravity + bounce + walls + soft separation | `src/js/three/hero.js` |
| Real physics toy: inverted pendulum, user spring control + LQR-style state feedback | `src/js/three/cartpole.js` |
| Turntable selection with drag-to-spin and settle-to-front | `src/js/three/cast.js` |

## Renderer bootstrap

```js
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
const timer = new THREE.Timer();
timer.connect(document);

const ro = new ResizeObserver(() => {
  const { width, height } = canvas.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
const io = new IntersectionObserver(([e]) =>
  renderer.setAnimationLoop(e.isIntersecting ? (ts) => {
    timer.update(ts);
    const dt = Math.min(timer.getDelta(), 1 / 20); // clamp after tab switches
    step(dt, timer.getElapsed());
    renderer.render(scene, camera);
  } : null), { rootMargin: '120px' });
queueMicrotask(() => { ro.observe(canvas); io.observe(canvas); });
```

## Ink outline with line boil

```js
const outline = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
outline.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = sharedTime;           // { value: seconds }
  shader.uniforms.uThickness = { value: 0.035 };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      uniform float uTime; uniform float uThickness;
      float h31(vec3 p){ p = fract(p*.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      float wob = (h31(position * 7.0 + floor(uTime * 6.0)) - 0.5) * 0.55;
      transformed += normalize(normal) * uThickness * (1.0 + wob);`);
};
outline.customProgramCacheKey = () => 'outline-0.035';

// Hull geometry: strip attributes, merge, recompute → smooth normals, no cracks
const g = geometry.clone();
for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
const hullGeo = mergeVertices(g, 1e-3); hullGeo.computeVertexNormals();
const hull = new THREE.Mesh(hullGeo, outline); hull.raycast = () => {}; mesh.add(hull);
```

## Drag and toss

```js
// pointerdown: pick proxy → setPointerCapture → plane through object facing camera
plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), obj.position);
// pointermove: ray ∩ plane → obj.position.lerp(hit + grabOffset, 0.6); push {p, t} into history (keep 6)
// pointerup: quick + unmoved → "poke"; else velocity = (last.p - first.p) / dt, clampLength(0, 16)
```

Short click (< 350 ms, < 6 px) = poke (jump + squash + speech bubble). Anything else = toss.

## Squash and stretch spring

```js
s.v += (-160 * s.x - 9 * s.v) * dt;  s.x += s.v * dt;
const k = clamp(s.x, -0.45, 0.45);
rig.scale.set(1 + k * 0.6, 1 - k, 1 + k * 0.6);
rig.position.y = -height * k;        // keep feet planted
// impulse: s.v -= amount * 9
```

## Inverted pendulum (cart-pole)

θ from vertical (+ leans +x), cart acceleration `a`:

```
θ̈ = (g sin θ − a cos θ) / L − b θ̇
```

State feedback that balances L = 1.6 m from |θ| ≤ 0.65 rad (verified by simulation):
`a = 40θ + 10θ̇ + 2x + 3.5ẋ`, clamped to ±28 m/s². Human control: `a = 90(target − x) − 17ẋ`,
with time scaled to 0.8 so it's playable. Sub-step 4× per frame.
