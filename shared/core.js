/* ============================================================================
 * Reel — code shared by the app (youtube-playlist-manager.html) and Reel Studio
 * (reel-studio.html). AUD-33: every theme and thumbnail fix used to land twice,
 * once per page, and the copies had started to drift (different fallbacks,
 * one hexToHsl throwing on a non-string).
 *
 * Only pure helpers live here: no DOM, no page state. A classic script, loaded
 * before each page's own script, so its functions are ordinary globals — the
 * inline handlers and tests.html (w.<fn>) keep working unchanged. The theme
 * application, the colour-picker widget and the IndexedDB readers still differ
 * between the pages in signature and state; they are not merged here.
 * ========================================================================== */

// ── Thumbnails (revision history, 11 September 2026) ────────────────────────
// Largest first for a hero image; the medium size first for a card.
var THUMB_ORDER = ['uhd', 'qhd', 'fhd', 'maxres', 'standard', 'high', 'medium', 'default'];
var THUMB_ORDER_CARD = ['medium', 'high', 'standard', 'fhd', 'qhd', 'uhd', 'maxres', 'default'];

function pickThumb(thumbs, want) {
  if (!thumbs) return '';
  const order = want === 'hero' ? THUMB_ORDER : THUMB_ORDER_CARD;
  for (const key of order) {
    const url = thumbs[key]?.url;
    if (url) return url;
  }
  return '';
}

// ── Durations ───────────────────────────────────────────────────────────────
// ISO 8601 "PT#H#M#S" → seconds. 0 for anything else, never a throw.
function parseDuration(iso) {
  const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0) : 0;
}

// ── Colour maths (themes, accents, the colour picker) ───────────────────────
// hexToRgb falls back to `fallback` (a 24-bit number) on anything that is not
// a six-digit hex: each page passes its own default accent.
function hexToRgb(hex, fallback = 0xe8604c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  const n = m ? parseInt(m[1], 16) : fallback;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToRgb(h, s, v) {
  const c = v * s, hp = (h % 360) / 60, xx = c * (1 - Math.abs((hp % 2) - 1));
  const seg = [[c, xx, 0], [xx, c, 0], [0, c, xx], [0, xx, c], [xx, 0, c], [c, 0, xx]][Math.floor(hp) % 6];
  const m = v - c;
  return { r: (seg[0] + m) * 255, g: (seg[1] + m) * 255, b: (seg[2] + m) * 255 };
}

function hexToHsl(hex) {
  const { r: R, g: G, b: B } = hexToRgb(hex, 0xff2d55);
  const r = R / 255, g = G / 255, b = B / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  return { h, s: (d ? d / (1 - Math.abs(2 * l - 1)) : 0) * 100, l: l * 100 };
}

// An HSL colour string, lightness shifted by dL and kept inside 8–94 %.
function hsl(c, dL) {
  const l = Math.max(8, Math.min(94, c.l + (dL || 0)));
  return `hsl(${c.h.toFixed(1)} ${c.s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

// Six categorical colours from one accent: lighter to darker steps of it.
function accentRamp(hex) {
  const c = hexToHsl(hex);
  return [16, 6, -4, -14, -24, -32].map(d => hsl(c, d));
}

// The chart palette of a named theme: its 1–3 accents, completed with shifts.
function categoricalsFor(theme, accents) {
  if (theme.accents === 1) return accentRamp(accents[0]);
  const c = accents.map(hexToHsl);
  if (theme.accents === 2) return [accents[0], accents[1], hsl(c[0], 14), hsl(c[1], 14), hsl(c[0], -18), hsl(c[1], -18)];
  return [accents[0], accents[1], accents[2], hsl(c[0], 15), hsl(c[1], 15), hsl(c[2], 15)];
}
