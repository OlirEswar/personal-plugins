// Canvas helpers that draw like a mechanical pencil: slightly wobbly strokes
// (seeded, so they don't shimmer between frames), arrowed axes, hand lettering.

export const COLORS = {
  ink: '#2d2a3e',
  soft: '#8d88a3',
  grid: 'rgba(120,186,214,.35)',
  nyq: '#2fbf71',
  polly: '#ff5d8f',
  ozzy: '#3e8bff',
  cubert: '#ffc234',
  flame: '#ff8a1e',
};

/** Hi-DPI canvas that tracks its CSS size. Calls draw() on resize. */
export function sketchCanvas(canvas, draw) {
  const ctx = canvas.getContext('2d');
  const state = { w: 0, h: 0, ctx };
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    state.w = r.width;
    state.h = r.height;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(state);
  };
  new ResizeObserver(fit).observe(canvas);
  document.fonts?.ready.then(fit);
  fit();
  return state;
}

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000 - 0.5;
  };
}

/** Polyline with a gentle hand wobble. pts: [[x,y],...] in px. */
export function wobblyLine(ctx, pts, { color = COLORS.ink, width = 2.2, seed = 7, jitter = 0.7, dash = null, passes = 1 } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  for (let p = 0; p < passes; p++) {
    const r = rand(seed + p * 31);
    ctx.globalAlpha = p === 0 ? 1 : 0.35;
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = r() * jitter;
      const jy = r() * jitter;
      if (i === 0) ctx.moveTo(x + jx, y + jy);
      else ctx.lineTo(x + jx, y + jy);
    });
    ctx.stroke();
  }
  ctx.restore();
}

/** Straight-ish stroke between two points, subdivided so it can wobble. */
export function stroke(ctx, x1, y1, x2, y2, opts = {}) {
  const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 24));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
  wobblyLine(ctx, pts, opts);
}

export function arrowHead(ctx, x, y, angle, { color = COLORS.ink, size = 9, width = 2.2 } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(angle - 0.45) * size, y - Math.sin(angle - 0.45) * size);
  ctx.lineTo(x, y);
  ctx.lineTo(x - Math.cos(angle + 0.45) * size, y - Math.sin(angle + 0.45) * size);
  ctx.stroke();
  ctx.restore();
}

export function label(ctx, text, x, y, { color = COLORS.ink, size = 15, align = 'left', base = 'alphabetic', font = 'hand' } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = font === 'hand' ? `${size}px "Architects Daughter", cursive` : `600 ${size}px Figtree, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Axes with arrowheads. Returns plot-area mapping helpers. */
export function axes(ctx, { x, y, w, h, xLabel, yLabel, seed = 3 }) {
  stroke(ctx, x, y + h, x + w + 8, y + h, { seed, width: 2.4 });
  arrowHead(ctx, x + w + 10, y + h, 0);
  stroke(ctx, x, y + h, x, y - 8, { seed: seed + 5, width: 2.4 });
  arrowHead(ctx, x, y - 10, -Math.PI / 2);
  if (xLabel) label(ctx, xLabel, x + w + 6, y + h - 9, { align: 'right', color: COLORS.soft, size: 14 });
  if (yLabel) label(ctx, yLabel, x + 12, y - 2, { color: COLORS.soft, size: 14 });
}

/** Pole marker in Polly's style (×). */
export function cross(ctx, x, y, { size = 7, color = COLORS.polly, width = 3 } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();
  ctx.restore();
}

/** Animate a 0→1 "draw-in" when the canvas first scrolls into view. */
export function drawIn(canvas, onProgress, duration = 1400) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    onProgress(1);
    return;
  }
  onProgress(0);
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / duration);
        onProgress(1 - Math.pow(1 - k, 3));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { threshold: 0.35 },
  );
  io.observe(canvas);
}
