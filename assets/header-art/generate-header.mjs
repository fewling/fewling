// Deterministic Bloom → static animated header.svg
// Ports the bloom algorithm to Node, scores seeds, bakes the best N into one
// SVG that cross-fades through them via SMIL (no JS needed at view time).
//
//   node assets/header-art/generate-header.mjs
//
import { writeFileSync } from 'node:fs';

// ── header geometry (matches assets/header.svg viewBox 900x150) ──────────────
const W = 900, H = 150;
const ORIGIN_X = 432, ORIGIN_Y = 75, RIGHT_BOUND = 872, TOP = 24, BOT = 128;

// ── palette ──────────────────────────────────────────────────────────────────
const DIM = '#1D9E75';     // lineage / contract green
const ACC = '#5DCAA5';     // accent / leaf glow
const BG  = '#0d1117';     // card

// ── tuned bloom parameters (understated: ~40-70 nodes) ───────────────────────
const GENERATIONS = 6;
const BRANCHING   = 1.8;
const SPREAD_AMT  = 42;    // vertical fan per generation
const WOBBLE_AMT  = 38;    // organic noise perturbation
const TERM_BASE   = 0.17;  // early-termination prob per generation past gen 2
const GOLDEN      = 2.399963;

// ── tiny seeded RNG + value noise (no p5 dependency) ─────────────────────────
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNoise(seed){
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Array(512); for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  return (x, y) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1], ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
    return lerp(lerp(aa / 255, ba / 255, u), lerp(ab / 255, bb / 255, u), v);
  };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const map = (v, a, b, c, d) => c + (d - c) * ((v - a) / (b - a));

// ── build one bloom ──────────────────────────────────────────────────────────
function buildBloom(seed){
  const random = mulberry32(seed);
  const noise = makeNoise(seed);

  const root = { x: ORIGIN_X, y: ORIGIN_Y, depth: 0, children: 0, ang: 0 };
  const nodes = [root];
  const edges = [];
  let frontier = [root];
  const xStep = (RIGHT_BOUND - ORIGIN_X) / GENERATIONS;

  for (let g = 1; g <= GENERATIONS; g++){
    const next = [];
    for (const p of frontier){
      // organic early termination: some branches end short, so leaves spread
      // across x instead of piling against the right edge.
      if (g >= 3 && random() < TERM_BASE * (g - 2)) continue; // p stays a leaf
      const base = Math.floor(BRANCHING);
      let n = Math.max(1, base + (random() < BRANCHING - base ? 1 : 0));
      if (g === GENERATIONS && random() < 0.35) n = Math.max(1, n - 1);
      for (let i = 0; i < n; i++){
        p.ang += GOLDEN;
        const fan = n === 1 ? 0 : (i - (n - 1) / 2) / Math.max(1, n - 1);
        const nx = (p.x + i * 17) * 0.012, ny = (p.y + g * 23) * 0.012;
        const dy = fan * SPREAD_AMT * (1 - 0.10 * g) + (noise(nx, ny) - 0.5) * WOBBLE_AMT;
        const dx = xStep * (0.55 + 0.75 * noise(nx + 11, ny + 7));
        const cx = clamp(p.x + dx, ORIGIN_X, RIGHT_BOUND);
        const cy = clamp(p.y + dy, TOP, BOT);
        const child = { x: cx, y: cy, depth: g, children: 0, ang: p.ang };
        p.children++; nodes.push(child); edges.push({ a: p, b: child, depth: g }); next.push(child);
      }
    }
    frontier = next;
    if (nodes.length > 220) break;
  }

  // relaxation: push same-x siblings apart in y
  for (let it = 0; it < 14; it++)
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++){
        const a = nodes[i], b = nodes[j];
        if (Math.abs(a.x - b.x) > 26) continue;
        const dy = b.y - a.y, d = Math.abs(dy);
        if (d < 13 && d > 1e-4){ const push = (13 - d) * 0.5, sg = dy > 0 ? 1 : -1;
          if (a.depth) a.y = clamp(a.y - sg * push, TOP, BOT);
          if (b.depth) b.y = clamp(b.y + sg * push, TOP, BOT); }
      }

  for (const nd of nodes) nd.isLeaf = nd.depth > 0 && nd.children === 0;
  const maxD = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  return { nodes, edges, maxD };
}

// ── score a bloom for curation (favour balanced, space-filling, reaching) ────
function score(b){
  const leaves = b.nodes.filter(n => n.isLeaf);
  const total = b.nodes.length;
  const ys = leaves.map(l => l.y);
  const vSpread = Math.max(...ys) - Math.min(...ys);
  const reach = Math.max(...leaves.map(l => l.x));
  const xSpread = Math.max(...leaves.map(l => l.x)) - Math.min(...leaves.map(l => l.x));
  if (total < 30 || total > 80) return -1;
  if (leaves.length < 6 || leaves.length > 22) return -1;
  if (vSpread < 60) return -1;
  if (reach < 815) return -1;
  if (xSpread < 120) return -1;   // leaves must spread horizontally, not clump at the edge
  // reward vertical + horizontal spread + reach, prefer a calm node count
  return vSpread * 0.8 + xSpread * 0.7 + (reach - 815) * 0.5 - Math.abs(total - 52) * 1.0 + leaves.length * 1.5;
}

// ── render one bloom as an SVG fragment ──────────────────────────────────────
function fmt(n){ return Math.round(n * 100) / 100; }
function bloomSvg({ nodes, edges, maxD }){
  let s = '';
  // lineage edges
  for (const e of edges){
    const df = map(e.depth, 1, maxD, 1.0, 0.45);
    const op = fmt(0.30 * df);
    const sw = fmt(map(e.depth, 1, maxD, 1.4, 0.7));
    const mx = fmt((e.a.x + e.b.x) / 2);
    s += `    <path d="M${fmt(e.a.x)} ${fmt(e.a.y)}C${mx} ${fmt(e.a.y)} ${mx} ${fmt(e.b.y)} ${fmt(e.b.x)} ${fmt(e.b.y)}" fill="none" stroke="${DIM}" stroke-width="${sw}" stroke-opacity="${op}"/>\n`;
  }
  // nodes
  for (const nd of nodes){
    if (nd.depth === 0){
      s += `    <circle cx="${fmt(nd.x)}" cy="${fmt(nd.y)}" r="3.75" fill="${ACC}" fill-opacity="0.92"/>\n`;
      s += `    <circle cx="${fmt(nd.x)}" cy="${fmt(nd.y)}" r="6.5" fill="none" stroke="${ACC}" stroke-opacity="0.35"/>\n`;
    } else if (nd.isLeaf){
      s += `    <circle cx="${fmt(nd.x)}" cy="${fmt(nd.y)}" r="5.5" fill="${ACC}" fill-opacity="0.18"/>\n`;
      s += `    <circle cx="${fmt(nd.x)}" cy="${fmt(nd.y)}" r="2.1" fill="${ACC}" fill-opacity="0.92"/>\n`;
    } else {
      const op = fmt(map(nd.depth, 1, maxD, 0.78, 0.42));
      const r = fmt(map(nd.depth, 1, maxD, 2.1, 1.3));
      s += `    <circle cx="${fmt(nd.x)}" cy="${fmt(nd.y)}" r="${r}" fill="${DIM}" fill-opacity="${op}"/>\n`;
    }
  }
  return s;
}

// ── curate seeds ─────────────────────────────────────────────────────────────
const N = 6;                 // number of blooms to cycle
const CANDIDATES = [];
for (let seed = 1; seed <= 120; seed++){
  const b = buildBloom(seed);
  const sc = score(b);
  if (sc > 0) CANDIDATES.push({ seed, sc, total: b.nodes.length, leaves: b.nodes.filter(n => n.isLeaf).length });
}
CANDIDATES.sort((a, b) => b.sc - a.sc);
// pick the top N, but spread them so the curated set is visually varied by node count
const picked = [];
const top = CANDIDATES.slice(0, 30);
top.sort((a, b) => a.total - b.total);
for (let i = 0; i < N; i++){
  const idx = Math.round(map(i, 0, N - 1, 0, top.length - 1));
  picked.push(top[idx]);
}
const seeds = picked.map(p => p.seed);
console.log('Curated seeds:', picked.map(p => `${p.seed}(n=${p.total},leaves=${p.leaves})`).join('  '));

// ── SMIL cross-fade timing (shared trapezoid, phase-shifted per layer) ───────
const DUR = 42;              // seconds for a full cycle through all N
const slot = DUR / N;
const h = 0.35 / N, f = 0.40 / N;
const keyTimes = [0, h, h + f, 1 - h - f, 1 - h, 1].map(t => fmt(t)).join(';');
const values = '1;1;0;0;1;1';

// ── assemble ─────────────────────────────────────────────────────────────────
let groups = '';
seeds.forEach((seed, i) => {
  const begin = i === 0 ? '0s' : `-${fmt(i * slot)}s`;
  groups += `  <g opacity="0">\n`;
  groups += `    <animate attributeName="opacity" dur="${DUR}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes}" values="${values}" begin="${begin}"/>\n`;
  groups += bloomSvg(buildBloom(seed));
  groups += `  </g>\n`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="fewling — fullstack engineer; mobile, web, backend, cloud, ai">
  <title>fewling — fullstack engineer; mobile, web, backend, cloud, ai</title>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${BG}" stroke="#21262d" stroke-width="1"/>
  <!-- Deterministic Bloom — ${N} curated seeds [${seeds.join(', ')}] cross-fading on a ${DUR}s loop. Regenerate via assets/header-art/generate-header.mjs -->
${groups}  <text x="40" y="80" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="46" font-weight="600" fill="#e6edf3">fewling</text>
  <rect x="240" y="50" width="14" height="34" fill="${ACC}">
    <animate attributeName="opacity" values="1;1;0.12;0.12;1" dur="1.6s" repeatCount="indefinite"/>
  </rect>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14">
    <rect x="286" y="48" width="104" height="28" rx="14" fill="#161b22" stroke="#1D9E75" stroke-width="1"/>
    <text x="338" y="66" text-anchor="middle" fill="${ACC}">fullstack</text>
  </g>
  <text x="42" y="116" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="16" fill="#8b949e">mobile · web · backend · cloud · ai</text>
  <rect x="42" y="130" width="118" height="3" fill="#1D9E75"/>
</svg>
`;

const out = new URL('../header.svg', import.meta.url);
writeFileSync(out, svg);
console.log('Wrote', out.pathname, `(${svg.length} bytes)`);
