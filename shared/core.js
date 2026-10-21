/* ============================================================================
 * VYMA — code shared by the app (youtube-playlist-manager.html) and VYMA Studio
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

// ── Tags: an id, and a name per language ────────────────────────────────────
// A tag is stored as an id; its name follows the interface language, so the
// French and English names of one category are one tag. Built-in ids carry a
// namespace: "yt:<categoryId>" (a YouTube category) and "genre:<Wikipedia
// page>" (a music genre). Any other id is a tag the user created: its own
// text, with optional names per language in tagLabels ({ id: { fr, en } }).
// Adding a language means adding it to these tables (tests.html checks).

// YouTube video categories (ids are global and stable). Source:
// videoCategories.list FR + EN. a: assignable to an upload.
var VIDEO_CATEGORIES = { "1":{fr:"Films et animations",en:"Film & Animation",a:1}, "2":{fr:"Auto/Moto",en:"Autos & Vehicles",a:1}, "10":{fr:"Musique",en:"Music",a:1}, "15":{fr:"Animaux",en:"Pets & Animals",a:1}, "17":{fr:"Sport",en:"Sports",a:1}, "18":{fr:"Courts métrages",en:"Short Movies",a:0}, "19":{fr:"Voyages et événements",en:"Travel & Events",a:1}, "20":{fr:"Jeux vidéo",en:"Gaming",a:1}, "21":{fr:"Blogs vidéo",en:"Videoblogging",a:0}, "22":{fr:"People et blogs",en:"People & Blogs",a:1}, "23":{fr:"Humour",en:"Comedy",a:1}, "24":{fr:"Divertissement",en:"Entertainment",a:1}, "25":{fr:"Actualités et politique",en:"News & Politics",a:1}, "26":{fr:"Vie pratique et style",en:"Howto & Style",a:1}, "27":{fr:"Éducation",en:"Education",a:1}, "28":{fr:"Science et technologie",en:"Science & Technology",a:1}, "29":{fr:"Associations et bénévolat",en:"Nonprofits & Activism",a:1}, "30":{fr:"Films",en:"Movies",a:0}, "31":{fr:"Dessins animés/films d'animation",en:"Anime/Animation",a:0}, "32":{fr:"Action/aventure",en:"Action/Adventure",a:0}, "33":{fr:"Classique",en:"Classics",a:0}, "34":{fr:"Humour",en:"Comedy",a:0}, "35":{fr:"Documentaire",en:"Documentary",a:0}, "36":{fr:"Drame",en:"Drama",a:0}, "37":{fr:"Famille",en:"Family",a:0}, "38":{fr:"Étranger",en:"Foreign",a:0}, "39":{fr:"Horreur",en:"Horror",a:0}, "40":{fr:"Science-fiction/fantastique",en:"Sci-Fi/Fantasy",a:0}, "41":{fr:"Thriller",en:"Thriller",a:0}, "42":{fr:"Court métrage",en:"Shorts",a:0}, "43":{fr:"Émissions",en:"Shows",a:0}, "44":{fr:"Bandes-annonces",en:"Trailers",a:0} };

// Wikipedia topic → genre name (AUD-27: was French only). A topic missing
// here still names itself, underscores as spaces.
var GENRE_LABELS = {
  'Electronic_music': { fr: 'Électronique / EDM', en: 'Electronic / EDM' }, 'Hip_hop_music': { fr: 'Hip-hop / Rap', en: 'Hip-hop / Rap' },
  'Pop_music': { fr: 'Pop', en: 'Pop' }, 'Rock_music': { fr: 'Rock', en: 'Rock' }, 'Rhythm_and_blues': { fr: 'R&B', en: 'R&B' }, 'Soul_music': { fr: 'Soul', en: 'Soul' },
  'Classical_music': { fr: 'Classique', en: 'Classical' }, 'Country_music': { fr: 'Country', en: 'Country' }, 'Christian_music': { fr: 'Gospel / Chrétienne', en: 'Gospel / Christian' },
  'Independent_music': { fr: 'Indé', en: 'Indie' }, 'Music_of_Latin_America': { fr: 'Latino', en: 'Latin' }, 'Music_of_Asia': { fr: 'Asie', en: 'Asian' },
  'Jazz': { fr: 'Jazz', en: 'Jazz' }, 'Reggae': { fr: 'Reggae', en: 'Reggae' }, 'Blues': { fr: 'Blues', en: 'Blues' },
};

// ── Subcategories (#97) ─────────────────────────────────────────────────────
// search.list takes a topicId only from YouTube's curated list (Freebase ids,
// frozen on 15 February 2017), while a video reports its topics as Wikipedia
// URLs. Each entry carries both: topicId for the request, the Wikipedia page
// (key, plus any alias) to recognise a video in a chart. Only Music, Gaming and
// Sports map cleanly onto one category each. Music names are GENRE_LABELS'.
// Blues has no topic: it is a keyword search inside Music.
var CATEGORY_TOPICS = { '10': '/m/04rlf', '20': '/m/0bzvm2', '17': '/m/06ntj' };

var SUBCATEGORIES = {
  '10': [
    { key: 'Pop_music', topicId: '/m/064t9' }, { key: 'Rock_music', topicId: '/m/06by7' },
    { key: 'Hip_hop_music', topicId: '/m/0glt670' }, { key: 'Electronic_music', topicId: '/m/02lkt' },
    { key: 'Rhythm_and_blues', topicId: '/m/06j6l' }, { key: 'Soul_music', topicId: '/m/0gywn' },
    { key: 'Jazz', topicId: '/m/03_d0' }, { key: 'Blues', topicId: null, keywords: 'blues' },
    { key: 'Classical_music', topicId: '/m/0ggq0m' }, { key: 'Country_music', topicId: '/m/01lyv' },
    { key: 'Reggae', topicId: '/m/06cqb' }, { key: 'Music_of_Latin_America', topicId: '/m/0g293' },
    { key: 'Music_of_Asia', topicId: '/m/028sqc' }, { key: 'Independent_music', topicId: '/m/05rwpb' },
    { key: 'Christian_music', topicId: '/m/02mscn' },
  ],
  '20': [
    { key: 'Action_game', topicId: '/m/025zzc', fr: 'Action', en: 'Action' },
    { key: 'Action-adventure_game', topicId: '/m/02ntfj', fr: 'Action-aventure', en: 'Action-adventure' },
    { key: 'Casual_game', topicId: '/m/0b1vjn', fr: 'Jeux grand public', en: 'Casual' },
    { key: 'Music_video_game', topicId: '/m/02hygl', fr: 'Jeux musicaux', en: 'Music games' },
    { key: 'Puzzle_video_game', topicId: '/m/04q1x3q', fr: 'Puzzle', en: 'Puzzle' },
    { key: 'Racing_video_game', topicId: '/m/01sjng', fr: 'Course', en: 'Racing' },
    { key: 'Role-playing_video_game', topicId: '/m/0403l3g', fr: 'Jeux de rôle', en: 'Role-playing' },
    { key: 'Simulation_video_game', topicId: '/m/021bp2', fr: 'Simulation', en: 'Simulation' },
    { key: 'Sports_game', topicId: '/m/022dc6', fr: 'Jeux de sport', en: 'Sports games', aliases: ['Sports_video_game'] },
    { key: 'Strategy_video_game', topicId: '/m/03hf_rm', fr: 'Stratégie', en: 'Strategy' },
  ],
  '17': [
    { key: 'Association_football', topicId: '/m/02vx4', fr: 'Football', en: 'Football (soccer)', aliases: ['Football'] },
    { key: 'American_football', topicId: '/m/0jm_', fr: 'Football américain', en: 'American football' },
    { key: 'Basketball', topicId: '/m/018w8', fr: 'Basket-ball', en: 'Basketball' },
    { key: 'Baseball', topicId: '/m/018jz', fr: 'Baseball', en: 'Baseball' },
    { key: 'Boxing', topicId: '/m/01cgz', fr: 'Boxe', en: 'Boxing' },
    { key: 'Cricket', topicId: '/m/09xp_', fr: 'Cricket', en: 'Cricket' },
    { key: 'Golf', topicId: '/m/037hz', fr: 'Golf', en: 'Golf' },
    { key: 'Ice_hockey', topicId: '/m/03tmr', fr: 'Hockey sur glace', en: 'Ice hockey' },
    { key: 'Mixed_martial_arts', topicId: '/m/01h7lh', fr: 'Arts martiaux mixtes (MMA)', en: 'Mixed martial arts' },
    { key: 'Motorsport', topicId: '/m/0410tth', fr: 'Sport automobile', en: 'Motorsport' },
    { key: 'Tennis', topicId: '/m/07bs0', fr: 'Tennis', en: 'Tennis' },
    { key: 'Volleyball', topicId: '/m/07_53', fr: 'Volley-ball', en: 'Volleyball' },
  ],
};

var CUSTOM_SUB_ID_RE = /^c[a-z0-9]{4,24}$/;
var CUSTOM_SUB_MAX = 100;

/**
 * The subcategories offered under a category: YouTube's first, then the
 * user's own attached to it. Each comes out in one shape:
 * { id, cat, custom, names: {fr, en}, topicId, keywords, topicKeys, parent }.
 * A custom one based on a YouTube subcategory takes that one's topic.
 */
function subcategoriesFor(categoryId, custom) {
  const cat = String(categoryId || '');
  const builtins = (SUBCATEGORIES[cat] || []).map(s => ({
    id: s.key, cat, custom: false,
    names: GENRE_LABELS[s.key] || { fr: s.fr, en: s.en },
    topicId: s.topicId, keywords: s.keywords || '',
    topicKeys: [s.key].concat(s.aliases || []), parent: null,
  }));
  const mine = (Array.isArray(custom) ? custom : []).filter(c => c && c.cat === cat).map(c => {
    const base = builtins.find(b => b.id === c.parent) || null;
    return {
      id: c.id, cat, custom: true, names: { fr: c.fr || '', en: c.en || '' },
      topicId: base ? base.topicId : null, keywords: c.keywords || '',
      topicKeys: base ? base.topicKeys : [], parent: base ? base.id : null,
    };
  });
  return builtins.concat(mine);
}

function findSubcategory(categoryId, id, custom) {
  if (!id) return null;
  return subcategoriesFor(categoryId, custom).find(s => s.id === id) || null;
}

/** Its name in `lang`, else English, else French, else the id. */
function subcategoryName(sub, lang) {
  if (!sub) return '';
  const n = sub.names || {};
  return n[lang] || n.en || n.fr || String(sub.id).replace(/_/g, ' ');
}

/**
 * The user's own subcategories, as stored or as read from a backup: only
 * known fields, bounded lengths, a real assignable category, and something to
 * search by (keywords, or a YouTube subcategory to sit in). Anything else is
 * dropped, never repaired into something the user did not write.
 */
function sanitizeCustomSubcategories(raw) {
  if (!Array.isArray(raw)) return [];
  const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
  const out = [], seen = new Set();
  for (const c of raw) {
    if (!c || typeof c !== 'object' || out.length >= CUSTOM_SUB_MAX) continue;
    const id = typeof c.id === 'string' && CUSTOM_SUB_ID_RE.test(c.id) ? c.id : null;
    const cat = typeof c.cat === 'string' && Object.prototype.hasOwnProperty.call(VIDEO_CATEGORIES, c.cat) && VIDEO_CATEGORIES[c.cat].a ? c.cat : null;
    if (!id || !cat || seen.has(id)) continue;
    const fr = text(c.fr, 40), en = text(c.en, 40), keywords = text(c.keywords, 120);
    const parent = typeof c.parent === 'string' && (SUBCATEGORIES[cat] || []).some(s => s.key === c.parent) ? c.parent : null;
    if (!(fr || en) || !(keywords || parent)) continue;
    seen.add(id);
    out.push({ id, cat, fr, en, keywords, parent });
  }
  return out;
}

/** A backup's subcategories added to this browser's: one already here wins. */
function mergeCustomSubcategories(mine, incoming) {
  const have = new Set((Array.isArray(mine) ? mine : []).map(c => c && c.id));
  const extra = (Array.isArray(incoming) ? incoming : []).filter(c => c && !have.has(c.id));
  return sanitizeCustomSubcategories((Array.isArray(mine) ? mine : []).concat(extra));
}

/** A Wikipedia topic URL as YouTube returns it → its page name, or ''. */
function topicKeyFromUrl(url) {
  const m = /\/wiki\/([^?#]+)$/.exec(String(url || ''));
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
}

var TAG_ID_RE = /^(?:yt:\d+|genre:[A-Za-z0-9_%().\-]+)$/;   // genre: a Wikipedia page name

function isBuiltinTag(id) {
  return /^(?:yt|genre):/.test(String(id || ''));
}

function ownNames(map, id) {
  return map && Object.prototype.hasOwnProperty.call(map, id) && map[id] && typeof map[id] === 'object' ? map[id] : null;
}

/** The name of tag `id` in `lang`: that language, else English, else French, else the id. */
function tagLabel(id, lang, customLabels) {
  const s = String(id || '');
  const pick = names => names && (names[lang] || names.en || names.fr);
  if (s.startsWith('yt:')) return pick(ownNames(VIDEO_CATEGORIES, s.slice(3))) || s;
  if (s.startsWith('genre:')) return pick(ownNames(GENRE_LABELS, s.slice(6))) || s.slice(6).replace(/_/g, ' ');
  const own = ownNames(customLabels, s);
  return (own && own[lang]) || s;
}

/**
 * The id a typed or legacy name stands for, whatever its language: "Music",
 * "Musique" and "musique" are all "yt:10". Assignable categories first, then
 * genres, then the other categories ("Humour" is 23, not the old 34;
 * "Classique" is the genre, not category 33). A name nothing knows is a user
 * tag: its own id, or the one whose translation it is. null for a reserved
 * "yt:…" / "genre:…" string that names nothing.
 */
function tagIdFromName(name, customLabels) {
  const s = String(name || '').trim();
  if (!s) return null;
  if (isBuiltinTag(s)) {
    if (!TAG_ID_RE.test(s)) return null;
    return s.startsWith('yt:') && !ownNames(VIDEO_CATEGORIES, s.slice(3)) ? null : s;
  }
  const key = s.toLocaleLowerCase();
  const same = names => !!names && Object.keys(names).some(l => l !== 'a' && String(names[l]).toLocaleLowerCase() === key);
  const cats = Object.entries(VIDEO_CATEGORIES);
  for (const [id, c] of cats) if (c.a && same(c)) return 'yt:' + id;
  for (const [g, names] of Object.entries(GENRE_LABELS)) if (same(names)) return 'genre:' + g;
  for (const [id, c] of cats) if (!c.a && same(c)) return 'yt:' + id;
  for (const [id, names] of Object.entries(customLabels || {})) {
    if (id.toLocaleLowerCase() === key || same(names)) return id;
  }
  return s;
}

/**
 * Migration to ids, safe to run again: every tag name becomes the id it
 * stands for, the duplicates of one playlist merge, and icons follow. An
 * icon already on the id wins over one carried by an old name.
 * → { tags, icons, changed }
 */
function normalizeTagIds(tags, icons, customLabels) {
  let changed = false;
  const outTags = {};
  for (const [pl, list] of Object.entries(tags || {})) {
    if (!Array.isArray(list)) continue;
    const ids = [...new Set(list.map(n => tagIdFromName(n, customLabels) || n))];
    if (ids.length !== list.length || ids.some((x, i) => x !== list[i])) changed = true;
    outTags[pl] = ids;
  }
  const outIcons = {};
  for (const [name, icon] of Object.entries(icons || {})) {
    const id = tagIdFromName(name, customLabels) || name;
    if (id !== name) changed = true;
    if (!Object.prototype.hasOwnProperty.call(outIcons, id) || id === name) outIcons[id] = icon;
  }
  return { tags: outTags, icons: outIcons, changed };
}

// ── Music detection (design spec §3, AUD-25) ────────────────────────────────
// Moved here so VYMA Studio's Music / Videos filter gives the app's verdicts.
// Pure: category, topics, tags and description come in with the video. The
// app's classifyVideoType() looks them up in its details cache first.
//
// Scoring, not a single signal: "- Topic" alone is strong but a two-hour DJ
// set on a Topic channel is still a video, and categoryId 10 is reliable when
// it is there and absent more often than you would like.
var MUSIC_SIGNALS = {
  topicChannel: 0.9,     // "Artist - Topic": auto-generated music channel
  musicCategory: 0.7,    // snippet.categoryId === '10'
  trackLength: 0.2,      // 2–7 minutes
  artistTitle: 0.2,      // "Artist - Title"
  longForm: -0.5,        // over 20 minutes: mix, podcast, lecture
};
var MUSIC_SCORE_THRESHOLD = 0.7;
var MUSIC_PLAYLIST_THRESHOLD = 0.8;   // ≥80% music → music playlist
var MUSIC_MIXED_THRESHOLD = 0.5;      // 50–80% → mixed, offer the switch
var MUSIC_SAMPLE_SIZE = 50;

function isTopicChannel(channelTitle) {
  return /\s-\sTopic$/.test(String(channelTitle || '').trim());
}

/** Per-video music score, clamped to [0, 1] (spec §3). */
function musicScore(v) {
  v = v || {};
  const channel = v.channelTitle || v.videoOwnerChannelTitle || '';
  const seconds = Number(v.durationSeconds) || 0;
  let score = 0;
  if (isTopicChannel(channel)) score += MUSIC_SIGNALS.topicChannel;
  if (String(v.categoryId) === '10') score += MUSIC_SIGNALS.musicCategory;
  if (seconds >= 120 && seconds <= 420) score += MUSIC_SIGNALS.trackLength;
  if (hasArtistTitlePattern(v.title || '')) score += MUSIC_SIGNALS.artistTitle;
  if (seconds > 1200) score += MUSIC_SIGNALS.longForm;
  return Math.max(0, Math.min(1, score));
}

// Decorations stripped before the "Artist - Title" check (spec §6).
var TITLE_DECORATIONS = [
  // Anything bracketed that opens with "official" — the wording varies wildly
  // ("Official Video", "Official Audio", "Official Video Remastered"), so match
  // the opening word and take the rest of the bracket with it.
  /[\(\[]\s*official[^\)\]]*[\)\]]/ig,
  /[\(\[]\s*(?:music\s+)?video\s*[\)\]]/ig,
  /[\(\[]\s*audio\s*[\)\]]/ig,
  /[\(\[]\s*(?:mv|m\/v)\s*[\)\]]/ig,
  /[\(\[]\s*(?:with\s+)?lyrics?(?:\s+video)?\s*[\)\]]/ig,
  /[\(\[]\s*(?:hd|hq|4k|8k|1080p|720p|full\s*hd|remastered)\s*[\)\]]/ig,
];

// Quality tags also turn up bare and unbracketed, but only ever as a trailing
// token. Stripping "HD" anywhere would mangle a track genuinely called "HD".
var TRAILING_QUALITY = /[\s\-–—|]*\b(?:hd|hq|4k|8k|1080p|720p|full\s*hd)\b\s*$/i;

function stripDecorations(s) {
  let out = String(s || '');
  for (const re of TITLE_DECORATIONS) out = out.replace(re, ' ');
  out = out.replace(/\s{2,}/g, ' ').trim();
  // Repeat: "... (Official Audio) HD 4K" leaves two of them stacked.
  let guard = 0;
  while (TRAILING_QUALITY.test(out) && guard++ < 4) out = out.replace(TRAILING_QUALITY, '').trim();
  return out.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—|]+|[\s\-–—|]+$/g, '').trim();
}

// Used as a music signal too: a bare "X - Y" is track-shaped.
function hasArtistTitlePattern(title) {
  const clean = stripDecorations(title);
  return /\S\s+[-–—]\s+\S/.test(clean);
}

// Tutorials. Music-production tutorials look like music to every music
// signal: category 10, a genre topic, 2–7 minutes, "Artist - Title". The
// verdict is a score over title, tags, description and category; 1 or more is
// a tutorial. A strong title word decides alone, unless the description reads
// like a release.
//
// \b is ASCII-only in JS ("leçon" has no word boundary after "le"), hence the
// Unicode letter/number lookarounds.
function wordsRe(alternation) {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, 'iu');
}
var TUTORIAL_STRONG_RE = wordsRe([
  'tutos?', 'tutorials?', 'tutoriels?', 'how ?to', 'howto',
  'how i (?:make|made|produce|produced|mix|mixed|write|wrote|play|played|use|used)',
  'reviews?', 'tests?', 'unboxing', 'reactions?', 'réactions?', 'vlogs?', 'explained', 'explications?',
  'cours', 'lessons?', 'leçons?', 'guides?', 'setup', 'walkthrough', 'gameplay', 'podcasts?', 'interviews?',
  'demos?', 'démos?', 'previews?', 'astuces?', 'tips', 'mixing', 'mastering', 'mixdown',
  'courses?', 'beginners?', 'débutants?', 'workflow', 'masterclass(?:es)?',
  'learn (?:how|to (?:play|make|produce|mix)|ableton|fl studio|logic|piano|guitar|drums|bass|music production)',
  'apprendre (?:à|a) (?:jouer|faire|mixer|produire|composer|utiliser)', 'comment (?:faire|jouer|créer|produire|mixer|composer)',
  'sound design', '(?:track|song) breakdown', 'breakdown of', 'from scratch', 'the making of',
  'making (?:a|an|my|the) (?:\\S+ ){0,2}(?:beats?|tracks?|songs?|tunes?|remix|melod(?:y|ies)|basslines?|leads?|kicks?)',
].join('|'));
// Tools, not lessons: a sign, not a verdict ("Ableton live set" is music).
var TUTORIAL_WEAK_RE = wordsRe('ableton|fl studio|logic pro|bitwig|cubase|pro tools|presets?|plugins?|vsts?|daw|sample packs?');
var TUTORIAL_DESC_RE = wordsRe([
  'in this (?:video|tutorial|lesson|course|episode)', 'dans (?:cette|ce) (?:vidéo|tuto|tutoriel|cours)',
  'project files?', 'fichiers? (?:du )?projet', 'download (?:the )?(?:project|presets?|samples?)',
  'sample packs?', 'preset packs?', 'free presets?', 'masterclass', 'online course', 'formation',
].join('|'));
var RELEASE_DESC_RE = wordsRe([
  'provided to youtube by', 'directed by', 'réalisé par', 'music video by', 'out now',
  '(?:stream|listen)(?: to)?(?: it| the (?:album|track|song|ep|single))? (?:on|now|here)',
  'lyrics ?:', 'paroles ?:', 'disponible (?:sur|partout)',
].join('|'));
var HOWTO_CATEGORIES = ['26', '27', '28'];   // Howto & Style, Education, Science & Technology
var TUTORIAL_SIGNALS = {
  titleStrong: 1.0,
  titleWeak: 0.6,
  tagsStrong: 0.6,
  tagsManyStrong: 1.0,
  tagsWeak: 0.3,
  description: 0.5,
  howtoCategory: 0.5,
  releaseDescription: -0.5,
};
var TUTORIAL_THRESHOLD = 1;

/** ≥ TUTORIAL_THRESHOLD reads as a tutorial. Inputs: title, tags[], description, categoryId. */
function tutorialScore(v) {
  v = v || {};
  const title = String(v.title || '');
  const tags = Array.isArray(v.tags) ? v.tags.map(String) : [];
  const desc = String(v.description || '');
  let score = 0;
  if (TUTORIAL_STRONG_RE.test(title)) score += TUTORIAL_SIGNALS.titleStrong;
  else if (TUTORIAL_WEAK_RE.test(title)) score += TUTORIAL_SIGNALS.titleWeak;
  // One stray tag proves little; tutorials tag themselves several times over.
  const strongTags = tags.filter(tg => TUTORIAL_STRONG_RE.test(tg)).length;
  if (strongTags >= 2) score += TUTORIAL_SIGNALS.tagsManyStrong;
  else if (strongTags === 1) score += TUTORIAL_SIGNALS.tagsStrong;
  else if (tags.some(tg => TUTORIAL_WEAK_RE.test(tg))) score += TUTORIAL_SIGNALS.tagsWeak;
  if (TUTORIAL_DESC_RE.test(desc)) score += TUTORIAL_SIGNALS.description;
  if (HOWTO_CATEGORIES.includes(String(v.categoryId))) score += TUTORIAL_SIGNALS.howtoCategory;
  if (RELEASE_DESC_RE.test(desc) || desc.includes('℗')) score += TUTORIAL_SIGNALS.releaseDescription;
  return Math.round(score * 100) / 100;
}

// Title keywords for music content. wordsRe(), not \b: \b is ASCII-only, so
// "live à Paris" never matched (no word boundary after "à").
var MUSIC_INCLUDE_RE = wordsRe(String.raw`official (?:video|music video|audio)|clip officiel|lyrics? video|concert|full album|album complet|mix|dj ?set|remix|audio|feat\.?|ft\.?|prod\.?|cover|acoustic|bande originale|ost|soundtrack`);
var MUSIC_LIVE_RE = wordsRe(String.raw`live\s*(?:at|@|in|from|au|aux|à)|\(live\)|\[live\]|live (?:session|set|concert|show|performance)|boiler room|unplugged|tiny desk`);

// Four kinds, after YouTube Music's videoType (the Data API does not expose
// it): a track (ATV: an artist's audio, a "- Topic" upload), a clip (OMV: a
// music video), live & sets (concerts, sessions, and any music over 20 min:
// sets, mixes, full albums), and other (not music). A song-length upload with
// no hint off a Topic channel is a clip: on YouTube that is the common case.
var MUSIC_KINDS = ['track', 'clip', 'live'];
var MUSIC_AUDIO_RE = wordsRe(String.raw`official audio|audio|visuali[sz]er|lyrics? video`);
var MUSIC_CLIP_RE = wordsRe(String.raw`official (?:music )?video|clip officiel|clip|music video|mv|m/v`);

/**
 * One video → { isMusic, isTrack, isTutorial, live, kind, tutorialScore, topicSegs }.
 * Inputs: title, channelTitle (or videoOwnerChannelTitle), durationSeconds,
 * categoryId, topics (topic URLs or bare Wikipedia page names), tags,
 * description. isTrack is the per-video #17 decision (musicScore); isMusic is
 * music content, which also counts mixes and live sets. A track is always
 * music, so the two cannot contradict.
 */
function classifyMusic(v) {
  v = v || {};
  const title = String(v.title || '');
  const channel = v.channelTitle || v.videoOwnerChannelTitle || '';
  const topicSegs = (Array.isArray(v.topics) ? v.topics : []).map(u => String(u).split('/').pop());
  const topicIsMusic = topicSegs.some(s => /music/i.test(s) || /^(Jazz|Reggae|Blues|Soul|Country)$/i.test(s));
  const tutScore = tutorialScore({ title, tags: v.tags, description: v.description, categoryId: v.categoryId });
  const isTutorial = tutScore >= TUTORIAL_THRESHOLD;
  const howtoCategory = HOWTO_CATEGORIES.includes(String(v.categoryId));
  const live = MUSIC_LIVE_RE.test(title);
  const includeMatched = MUSIC_INCLUDE_RE.test(title) || live;
  // Tutorials, reviews, podcasts… are not music, whatever else matched —
  // except on an auto-generated "- Topic" channel, which only holds tracks
  // (a song titled "Demo" or "Interlude (Live Review)" is still a song).
  const excluded = isTutorial && !isTopicChannel(channel);
  const isTrack = !excluded && musicScore(v) >= MUSIC_SCORE_THRESHOLD;
  // "mix", "audio", "remix" in an Education or Howto upload is a lesson about
  // them, not one of them.
  const isMusic = isTrack || (!excluded && (topicIsMusic || String(v.categoryId) === '10' || (includeMatched && !howtoCategory)));
  const isLive = live || /\bconcert\b/i.test(title);
  let kind = 'other';
  if (isMusic) {
    if (isLive || (Number(v.durationSeconds) || 0) > 1200) kind = 'live';
    else if (isTopicChannel(channel)) kind = 'track';
    else if (MUSIC_CLIP_RE.test(title) || /vevo$/i.test(String(channel).trim())) kind = 'clip';
    else if (MUSIC_AUDIO_RE.test(title)) kind = 'track';
    else kind = 'clip';
  }
  return { isMusic, isTrack, isTutorial, live: isLive, kind, tutorialScore: tutScore, topicSegs };
}

/**
 * Verdict for a whole playlist: 'music' | 'mixed' | 'video'.
 * Sampled over the first 50, per the spec — a 2 000-track playlist does not
 * need all of them to answer the question.
 * Counts music content (isMusic), not only tracks: a playlist of concerts or
 * live sets is a music playlist even though none of its videos is a track.
 * `classify` defaults to classifyMusic(); the app passes classifyVideoType(),
 * which fills category and topics in from its details cache.
 */
function playlistMusicVerdict(videos, classify) {
  const judge = classify || classifyMusic;
  const list = Array.isArray(videos) ? videos.slice(0, MUSIC_SAMPLE_SIZE) : [];
  if (!list.length) return { verdict: 'video', ratio: 0, sampled: 0, kinds: {}, dominant: null };
  const kinds = {};
  let hits = 0;
  for (const v of list) {
    const c = judge(v);
    if (!c.isMusic) continue;
    hits++;
    if (c.kind && c.kind !== 'other') kinds[c.kind] = (kinds[c.kind] || 0) + 1;
  }
  const ratio = hits / list.length;
  const verdict = ratio >= MUSIC_PLAYLIST_THRESHOLD ? 'music'
                : ratio >= MUSIC_MIXED_THRESHOLD ? 'mixed'
                : 'video';
  // The kind at least half of the music is; none of them → 'mixed'.
  const top = MUSIC_KINDS.find(k => (kinds[k] || 0) * 2 >= hits && kinds[k]);
  return { verdict, ratio, sampled: list.length, kinds, dominant: hits ? (top || 'mixed') : null };
}
