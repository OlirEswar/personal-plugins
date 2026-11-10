// 2D versions of the crew. Faceted polygons so they match the low-poly 3D models.
// Each returns an SVG string; `mood` changes the face.

const INK = '#2d2a3e';

function face({ x = 32, y = 30, gap = 11, mood = 'happy', look = [0, 0] } = {}) {
  const [lx, ly] = look;
  const eye = (cx) => {
    if (mood === 'wink' && cx > x) {
      return `<path d="M${cx - 4} ${y} q4 -4 8 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    }
    if (mood === 'sleepy') {
      return `<path d="M${cx - 4} ${y + 1} q4 3 8 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
    }
    return `<circle cx="${cx}" cy="${y}" r="5.2" fill="#fff" stroke="${INK}" stroke-width="2.2"/>
            <circle cx="${cx + lx * 1.6}" cy="${y + ly * 1.6}" r="2.6" fill="${INK}"/>
            <circle cx="${cx + lx * 1.6 + 1}" cy="${y + ly * 1.6 - 1}" r="0.8" fill="#fff"/>`;
  };
  const mouths = {
    happy: `<path d="M${x - 5} ${y + 8} q5 5 10 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    wink: `<path d="M${x - 5} ${y + 8} q5 5 10 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    wow: `<ellipse cx="${x}" cy="${y + 10}" rx="3" ry="3.6" fill="${INK}"/>`,
    sad: `<path d="M${x - 5} ${y + 11} q5 -5 10 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    sleepy: `<path d="M${x - 3} ${y + 9} h6" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
  };
  const cheeks = `<ellipse cx="${x - gap - 4}" cy="${y + 7}" rx="3.4" ry="2.2" fill="#ff8fb0" opacity=".7"/>
                  <ellipse cx="${x + gap + 4}" cy="${y + 7}" rx="3.4" ry="2.2" fill="#ff8fb0" opacity=".7"/>`;
  return `${eye(x - gap / 2 - 1)}${eye(x + gap / 2 + 1)}${mouths[mood] ?? mouths.happy}${cheeks}`;
}

const wrap = (inner, label, cls = '') =>
  `<svg class="crew ${cls}" viewBox="0 0 64 64" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

/** Nyq — an op-amp triangle. The lead. */
export function nyq(opts = {}) {
  const { mood = 'happy', label = 'Nyq, a green triangle' } = opts;
  return wrap(
    `<path d="M14 54 v6 M22 54 v6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
     <path d="M54 33 h7" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
     <path d="M10 8 L55 33 L10 56 Z" fill="#2fbf71" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     <path d="M10 8 L55 33 L30 30 Z" fill="#4fd68b" opacity=".75"/>
     <path d="M10 56 L55 33 L30 30 Z" fill="#1f9356" opacity=".35"/>
     ${face({ x: 25, y: 30, gap: 9, mood, look: opts.look })}`,
    label,
    'crew--nyq',
  );
}

/** Polly — a pole (×). A little unstable. */
export function polly(opts = {}) {
  const { mood = 'happy', label = 'Polly, a pink X' } = opts;
  return wrap(
    `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
       <path d="M14 6 L32 22 L50 6 L58 14 L42 32 L58 50 L50 58 L32 42 L14 58 L6 50 L22 32 L6 14 Z" fill="#ff5d8f"/>
     </g>
     <path d="M14 6 L32 22 L50 6 L58 14 L42 32 L32 30 L22 32 L6 14 Z" fill="#ff86ab" opacity=".55"/>
     ${face({ x: 32, y: 29, gap: 9, mood, look: opts.look })}`,
    label,
    'crew--polly',
  );
}

/** Ozzy — a zero (○), as an octagon. Calm, steady. */
export function ozzy(opts = {}) {
  const { mood = 'happy', label = 'Ozzy, a blue ball' } = opts;
  return wrap(
    `<path d="M22 5 H42 L58 21 V43 L42 59 H22 L6 43 V21 Z" fill="#3e8bff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     <path d="M22 5 H42 L58 21 L32 26 L6 21 Z" fill="#6aa8ff" opacity=".7"/>
     <path d="M6 43 L22 59 H42 L58 43 L32 40 Z" fill="#2566cc" opacity=".35"/>
     ${face({ x: 32, y: 31, gap: 10, mood, look: opts.look })}`,
    label,
    'crew--ozzy',
  );
}

/** Cubert — a cube. Keeps the notes. */
export function cubert(opts = {}) {
  const { mood = 'happy', label = 'Cubert, a yellow cube' } = opts;
  return wrap(
    `<path d="M10 18 L28 8 L56 14 L56 48 L36 58 L10 50 Z" fill="#ffc234" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     <path d="M10 18 L28 8 L56 14 L36 22 Z" fill="#ffd772" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
     <path d="M36 22 L36 58" stroke="${INK}" stroke-width="2.4"/>
     <path d="M36 22 L56 14 L56 48 L36 58 Z" fill="#d99a0b" opacity=".35"/>
     ${face({ x: 23, y: 34, gap: 8, mood, look: opts.look })}`,
    label,
    'crew--cubert',
  );
}

export const crew = { nyq, polly, ozzy, cubert };

export const crewInfo = [
  {
    id: 'nyq',
    name: 'Nyq',
    shape: 'Op-amp triangle',
    color: '#2fbf71',
    role: 'Your lesson guide',
    bio: 'Nyq amplifies whatever you are close to understanding. Shows up every morning with your quiz and never lets a streak die quietly.',
    likes: 'High gain, low noise, morning streaks',
  },
  {
    id: 'polly',
    name: 'Polly',
    shape: 'Pole (×)',
    color: '#ff5d8f',
    role: 'Chief troublemaker',
    bio: 'Polly lives a little too close to the right half-plane. Asks the tricky follow-up question right after you think you have it.',
    likes: 'Oscillation, drama, root locus plots',
  },
  {
    id: 'ozzy',
    name: 'Ozzy',
    shape: 'Zero (○)',
    color: '#3e8bff',
    role: 'The calm one',
    bio: 'Ozzy cancels out panic. Explains the same idea three different ways until one of them clicks, and steadies Polly when things ring.',
    likes: 'Phase margin, tea, field lines',
  },
  {
    id: 'cubert',
    name: 'Cubert',
    shape: 'Unit cube',
    color: '#ffc234',
    role: 'Keeper of notes',
    bio: 'Cubert writes down every mistake you make (kindly) and turns them into notes you can poke, drag and replay later.',
    likes: 'Tidy derivations, sticky notes, sharp pencils',
  },
];
