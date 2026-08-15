'use strict';

/**
 * pixel-tree-qr — core rendering.
 *
 * Two renderers, mirroring the reference "Chroma Tree" concept:
 *
 *  1. TREE (default) — an isometric 3D tree. The QR matrix is laid out flat as
 *     a "ground" of coloured tiles; a trunk of stacked wooden blocks rises from
 *     the centre; and every dark module inside a circular canopy radius sprouts
 *     a small vertical column of "leaf" blocks. This is the decorative view.
 *
 *  2. FLAT — a plain, high-contrast square QR code with dark leaf modules. This
 *     is the scannable view (the one a phone camera actually reads).
 *
 * The QR matrix itself is identical in both views; only how it is drawn differs.
 */

const qrcode = require('qrcode-generator');
// @napi-rs/canvas is a drop-in replacement for node-canvas that ships prebuilt
// N-API binaries (no native compilation, works on Windows / Node 16+).
const { createCanvas } = require('@napi-rs/canvas');

// ---------------------------------------------------------------------------
// Colour themes (leaf palette: `top` = bright, `flat` = dark scannable)
// ---------------------------------------------------------------------------

const THEMES = {
  cherry: {
    label: '樱花粉', treeLabel: '樱花树',
    top: ['#ffd1df', '#f8aec8', '#ef91b4', '#f4b2cc'],
    flat: ['#9d4667', '#873653', '#a64d70', '#793047'],
  },
  summer: {
    label: '夏日绿', treeLabel: '夏日树',
    top: ['#b8dc72', '#77bd68', '#4fa76a', '#91c96a'],
    flat: ['#3d6f39', '#285f3d', '#1f654e', '#356d3c'],
  },
  ginkgo: {
    label: '银杏黄', treeLabel: '银杏树',
    top: ['#fff08a', '#f4d94e', '#e8bf35', '#f6df68'],
    flat: ['#bd8b16', '#ae7800', '#c4931d', '#b78109'],
  },
  rainbow: {
    label: '渐变彩虹', treeLabel: '彩虹树',
    top: ['#f58fbd', '#ef5350', '#f7943d', '#f2d54a', '#54c7c2', '#4fa66d'],
    flat: ['#a82962', '#a12e2e', '#9a4e16', '#7d6812', '#176f70', '#236743'],
  },
};

// Per-block three-face shading (top / left / right) for the ground & structure.
const STRUCTURE = {
  soil: { top: '#e3dbc6', left: '#c9bea5', right: '#d5cbb4' },
  'shadow-soil': { top: '#a9ad86', left: '#788169', right: '#909a78' },
  moss: { top: '#587a4b', left: '#355f43', right: '#466b46' },
  shade: { top: '#6f853f', left: '#3f613e', right: '#526f40' },
  wood: { top: '#6a4a32', left: '#463024', right: '#573b2a' },
  leaf: { top: '#52c7a5', left: '#146b6a', right: '#329b84' },
};

// ---------------------------------------------------------------------------
// Small math / colour utilities
// ---------------------------------------------------------------------------

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function hexToRgb(hex) {
  if (hex.startsWith('#')) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }
  const m = hex.match(/[\d.]+/g);
  if (!m || m.length < 3) return { r: 0, g: 0, b: 0 };
  return { r: +m[0], g: +m[1], b: +m[2] };
}

// Mix two CSS colours and return an `rgb(r g b)` string.
function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(lerp(ca.r, cb.r, t))} ${Math.round(lerp(ca.g, cb.g, t))} ${Math.round(lerp(ca.b, cb.b, t))})`;
}

// Sample a colour palette array at a fractional position t in [0, 1].
function samplePalette(arr, t) {
  const n = t * (arr.length - 1);
  const i = Math.min(Math.floor(n), arr.length - 2);
  return mix(arr[i], arr[i + 1], n - i);
}

// Deterministic pseudo-random value in [0, 1) — same tree every time for a
// given URL, no seed required.
function jitter(x, z, y = 0) {
  const s = Math.sin(x * 91.7 + z * 247.3 + y * 37.1) * 15347.31;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------------------
// QR matrix
// ---------------------------------------------------------------------------

function getMatrix(url, errorCorrection) {
  const qr = qrcode(0, errorCorrection);
  qr.addData(url, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const matrix = [];
  for (let row = 0; row < n; row++) {
    const r = [];
    for (let col = 0; col < n; col++) r.push(qr.isDark(row, col));
    matrix.push(r);
  }
  return matrix; // matrix[row][col], row = z, col = x
}

// ---------------------------------------------------------------------------
// Tree scene: turn the flat matrix into a set of 3D blocks
// ---------------------------------------------------------------------------

function buildScene(matrix) {
  const n = matrix.length;
  const center = (n - 1) / 2;
  const canopyR = n * 0.43; // canopy radius, in module units
  const blocks = [];

  // 1. Ground tiles (one per module) — the QR laid flat.
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const dark = matrix[z][x];
      const d = Math.hypot(x - center, z - center);
      let kind = d < canopyR * 0.9 ? 'shadow-soil' : 'soil';
      if (dark && d < 2.25) kind = 'wood';
      else if (dark && d < canopyR) kind = 'shade';
      else if (dark) kind = 'moss';
      blocks.push({ x, z, y: 0, kind, extra: false, jitter: jitter(x, z) });
    }
  }

  // 2. Trunk — dark modules near the centre stacked upward.
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      if (matrix[z][x] && Math.hypot(x - center, z - center) < 2.05) {
        for (let y = 1; y <= 8; y++) {
          blocks.push({ x, z, y, kind: 'wood', extra: true, jitter: jitter(x, z, y) });
        }
      }
    }
  }

  // 3. Canopy — a vertical column of leaves above each dark module within the
  //    canopy radius (taller/denser toward the centre).
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      if (!matrix[z][x]) continue;
      const d = Math.hypot(x - center, z - center);
      if (d < canopyR) {
        const t = 1 - d / canopyR;
        const count = 3 + Math.floor(4 * t * t + jitter(x, z, 11) * 2);
        for (let i = 0; i < count; i++) {
          blocks.push({ x, z, y: 9 + i + Math.floor(t * 2), kind: 'leaf', extra: true, jitter: jitter(x, z, i + 20) });
        }
      }
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Tree renderer (isometric projection)
// ---------------------------------------------------------------------------

function drawBackground(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ece8d9');
  g.addColorStop(0.62, '#f1e8cf');
  g.addColorStop(1, '#e5d6b7');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Soft elliptical ground shadow under the canopy.
function drawShadow(ctx, w, h, n, E) {
  const cx = w / 2 + E * 5.5;
  const cy = h * 0.76;
  const rx = n * E * 0.52;
  const ry = n * E * 0.16;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(41,71,56,0.30)');
  g.addColorStop(1, 'rgba(41,71,56,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

// Draw one isometric block: a top diamond face with two extruded side faces.
function drawBlock(ctx, x, y, r, hgt, color) {
  const s = [[0, -r * 0.31], [r * 0.52, 0], [0, r * 0.31], [-r * 0.52, 0]];
  const l = s.map(([sx, sy]) => ({ x: x + sx, y: y + sy }));

  if (hgt > 0.2) {
    // left face
    ctx.fillStyle = color.left;
    ctx.beginPath();
    ctx.moveTo(l[3].x, l[3].y); ctx.lineTo(l[2].x, l[2].y);
    ctx.lineTo(l[2].x, l[2].y + hgt); ctx.lineTo(l[3].x, l[3].y + hgt);
    ctx.closePath(); ctx.fill();
    // right face
    ctx.fillStyle = color.right;
    ctx.beginPath();
    ctx.moveTo(l[1].x, l[1].y); ctx.lineTo(l[2].x, l[2].y);
    ctx.lineTo(l[2].x, l[2].y + hgt); ctx.lineTo(l[1].x, l[1].y + hgt);
    ctx.closePath(); ctx.fill();
  }

  // top face
  ctx.fillStyle = color.top;
  ctx.beginPath();
  ctx.moveTo(l[0].x, l[0].y);
  ctx.lineTo(l[1].x, l[1].y);
  ctx.lineTo(l[2].x, l[2].y);
  ctx.lineTo(l[3].x, l[3].y);
  ctx.closePath(); ctx.fill();
}

function leafColor(b, theme) {
  const t = THEMES[theme];
  let j = b.jitter;
  if (theme === 'rainbow') {
    // rainbow: colour driven by height (vertical gradient) + a little jitter
    j = clamp01((18 - b.y) / 9 + (b.jitter - 0.5) * 0.04);
  }
  const top = samplePalette(t.top, j);
  const flat = samplePalette(t.flat, j);
  return { top, left: mix(top, flat, 0.68), right: mix(top, flat, 0.38) };
}

function blockColor(b, theme) {
  if (b.kind === 'leaf') return leafColor(b, theme);

  const c = STRUCTURE[b.kind] || STRUCTURE.soil;

  if (b.kind === 'shadow-soil') {
    // sprinkle a few lighter "pebble" tiles across the darker inner disc
    const light = b.jitter > 0.84;
    const target = light ? '#d7d98f' : '#667558';
    const a = light ? 0.42 : 0.18;
    return {
      top: mix(c.top, target, a),
      left: mix(c.left, target, a * 0.5),
      right: mix(c.right, target, a * 0.65),
    };
  }
  return c;
}

function renderTree(matrix, opts) {
  const n = matrix.length;
  const w = opts.width;
  const h = opts.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, w, h);

  const center = (n - 1) / 2;
  const E = Math.min(w, h) / Math.max(n * 1.45, 36); // module -> pixel scale
  const rot = -0.74; // fixed isometric rotation

  drawShadow(ctx, w, h, n, E);

  const blocks = buildScene(matrix);

  // Project each block from (x, z, y) grid space into screen space.
  const projected = blocks.map((b) => {
    const cx = b.x - center;
    const cz = b.z - center;
    const px = cx * Math.cos(rot) - cz * Math.sin(rot);
    const pz = cx * Math.sin(rot) + cz * Math.cos(rot);
    return {
      ...b,
      sx: w / 2 + px * E,
      sy: h * 0.7 + pz * E * 0.46 - b.y * E * 0.86,
      depth: pz + b.y * 0.06,
    };
  });

  // Painter's algorithm: ground first, then trunk/leaves, back to front.
  projected.sort((a, b) =>
    a.extra === b.extra ? (a.depth - b.depth) || (a.y - b.y) : a.extra ? 1 : -1
  );

  const size = E * 1.03;
  const hgt = size * 0.5;
  for (const b of projected) {
    drawBlock(ctx, b.sx, b.sy, size, hgt, blockColor(b, opts.theme));
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Flat renderer (the scannable view)
// ---------------------------------------------------------------------------

const FLAT = {
  hueCenter: 120,   // green
  hueEdge: 58,      // golden yellow
  saturation: 80,   // %
  lightness: 21,    // % (kept dark so every leaf reads as a dark module)
  maxRadius: 0.46,
  minRadius: 0.28,
  offset: 0.3,
};
const FINDER_COLOR = 'hsl(120, 60%, 18%)';

const ALIGNMENT_POSITIONS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66],
  15: [6, 26, 48, 70], 16: [6, 26, 50, 74], 17: [6, 30, 54, 78],
  18: [6, 30, 56, 82], 19: [6, 30, 58, 86], 20: [6, 34, 62, 90],
  21: [6, 28, 50, 72, 94], 22: [6, 26, 50, 74, 98], 23: [6, 30, 54, 78, 102],
  24: [6, 28, 54, 80, 106], 25: [6, 32, 58, 84, 110], 26: [6, 30, 58, 86, 114],
  27: [6, 34, 62, 90, 118], 28: [6, 26, 50, 74, 98, 122],
  29: [6, 30, 54, 78, 102, 126], 30: [6, 26, 52, 78, 104, 130],
  31: [6, 30, 56, 82, 108, 134], 32: [6, 34, 60, 86, 112, 138],
  33: [6, 30, 58, 86, 114, 142], 34: [6, 34, 62, 90, 118, 146],
  35: [6, 30, 54, 78, 102, 126, 150], 36: [6, 24, 50, 76, 102, 128, 154],
  37: [6, 28, 54, 80, 106, 132, 158], 38: [6, 32, 58, 84, 110, 136, 162],
  39: [6, 26, 54, 82, 110, 138, 166], 40: [6, 30, 58, 86, 114, 142, 170],
};

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawLeafFlat(ctx, row, col, scale, quietZone, center, maxDist, rng) {
  const dist = Math.hypot(col - center, row - center);
  const t = clamp01(dist / maxDist);
  const hue = lerp(FLAT.hueCenter, FLAT.hueEdge, t);
  const light = FLAT.lightness + (rng() - 0.5) * 4;
  const radius = scale * lerp(FLAT.maxRadius, FLAT.minRadius, t) * (0.9 + rng() * 0.2);
  const ox = (rng() - 0.5) * scale * FLAT.offset;
  const oy = (rng() - 0.5) * scale * FLAT.offset;
  const cx = (quietZone + col + 0.5) * scale + ox;
  const cy = (quietZone + row + 0.5) * scale + oy;
  ctx.fillStyle = `hsl(${hue}, ${FLAT.saturation}%, ${light}%)`;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawSolidDot(ctx, row, col, scale, quietZone) {
  ctx.fillStyle = FINDER_COLOR;
  ctx.beginPath();
  ctx.arc((quietZone + col + 0.5) * scale, (quietZone + row + 0.5) * scale, scale * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function drawFinder(ctx, x, y, s) {
  ctx.fillStyle = FINDER_COLOR;
  ctx.fillRect(x, y, 7 * s, s);
  ctx.fillRect(x, y + 6 * s, 7 * s, s);
  ctx.fillRect(x, y, s, 7 * s);
  ctx.fillRect(x + 6 * s, y, s, 7 * s);
  ctx.fillRect(x + 2 * s, y + 2 * s, 3 * s, 3 * s);
}

function drawAlignment(ctx, x, y, s) {
  ctx.fillStyle = FINDER_COLOR;
  ctx.fillRect(x, y, 5 * s, s);
  ctx.fillRect(x, y + 4 * s, 5 * s, s);
  ctx.fillRect(x, y, s, 5 * s);
  ctx.fillRect(x + 4 * s, y, s, 5 * s);
  ctx.fillRect(x + 2 * s, y + 2 * s, s, s);
}

function renderFlat(matrix, opts) {
  const scale = opts.scale;
  const quietZone = opts.quietZone;
  const n = matrix.length;
  const version = (n - 17) / 4;
  const rng = mulberry32(hashString(String(opts.seed ?? opts.url)));
  const width = (n + 2 * quietZone) * scale;
  const canvas = createCanvas(width, width);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, width);

  const solid = new Set();
  const key = (r, c) => `${r},${c}`;
  const finderOrigins = [[0, 0], [0, n - 7], [n - 7, 0]];
  for (const [fr, fc] of finderOrigins) {
    for (let r = fr; r < fr + 7; r++) for (let c = fc; c < fc + 7; c++) solid.add(key(r, c));
  }
  const centers = ALIGNMENT_POSITIONS[version] || [];
  for (const r of centers) {
    for (const c of centers) {
      if ((r < 7 && c < 7) || (r < 7 && c > n - 8) || (r > n - 8 && c < 7)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) solid.add(key(r + dr, c + dc));
    }
  }

  const center = (n - 1) / 2;
  const maxDist = Math.hypot(center, center);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c] || solid.has(key(r, c))) continue;
      if (r === 6 || c === 6) drawSolidDot(ctx, r, c, scale, quietZone);
      else drawLeafFlat(ctx, r, c, scale, quietZone, center, maxDist, rng);
    }
  }

  for (const [fr, fc] of finderOrigins) {
    drawFinder(ctx, (quietZone + fc) * scale, (quietZone + fr) * scale, scale);
  }
  for (const r of centers) {
    for (const c of centers) {
      if ((r < 7 && c < 7) || (r < 7 && c > n - 8) || (r > n - 8 && c < 7)) continue;
      drawAlignment(ctx, (quietZone + c - 2) * scale, (quietZone + r - 2) * scale, scale);
    }
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function generateTreeQr(url, options = {}) {
  const opts = {
    theme: 'cherry',
    width: 1152,
    height: 928,
    errorCorrection: 'H',
    ...options,
  };
  const matrix = getMatrix(url, opts.errorCorrection);
  return renderTree(matrix, opts);
}

function generateFlatQr(url, options = {}) {
  const opts = {
    scale: 16,
    quietZone: 4,
    errorCorrection: 'H',
    seed: undefined,
    ...options,
  };
  opts.url = url;
  const matrix = getMatrix(url, opts.errorCorrection);
  return renderFlat(matrix, opts);
}

// Backward-compatible entry point. `mode: 'flat'` selects the scannable view.
function generatePixelTreeQr(url, options = {}) {
  return options.mode === 'flat' ? generateFlatQr(url, options) : generateTreeQr(url, options);
}

module.exports = { generatePixelTreeQr, generateTreeQr, generateFlatQr };
