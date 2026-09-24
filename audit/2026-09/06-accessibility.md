# Pass 6 — Accessibility (WCAG 2.1 AA, code reading)

Base `origin/main` @ `9c824eb`, app **v1.27.3**. The `design:accessibility-review` skill is not installed, so I applied the handoff's checklist by hand. This pass is **static analysis only**: no screen reader, no browser rendering. Contrast ratios are computed from the CSS tokens with a scratch script (oklch → linear sRGB → WCAG relative luminance). Every `:N` reference without a file name points to `youtube-playlist-manager.html`.

## Summary

| ID | Sev. | WCAG | Finding |
|---|---|---|---|
| AUD-42 | P3 | 1.4.3 | **Light theme:** accent and semantic colours used as text fall to 1.7–2.6:1; `--text3` 3.9:1. `--text4` fails in every theme (2.3–2.6:1). |
| AUD-43 | P3 | 1.4.3 / 1.4.11 | User-picked accents (custom skin, Studio themes) have no contrast guard. `.btn-primary` text is fixed at `#1a0a06`. Borders are 1.4:1 against surfaces. |
| AUD-44 | P3 | 2.1.1 / 4.1.2 | 86 clickable `div`/`span`/`img` elements are not focusable (0 `tabindex`, 0 `role="button"`). Reorder is drag-only. |
| AUD-45 | P3 | 2.4.3 / 4.1.2 | Modals: no `role="dialog"`/`aria-modal`, focus is not moved in, trapped or restored. The player overlay ignores Escape. |
| AUD-46 | P3 | 2.4.7 | No `:focus-visible` style anywhere. Form fields set `outline: none` and replace it with a 40 %-alpha border tint. |
| AUD-47 | P3 | 3.1.1 | `<html lang="fr">` is never updated when the UI switches to English. The privacy policy is French-only, hard-coded. |
| AUD-48 | P3 | 4.1.3 | Toasts (all feedback) have no `aria-live`, and action toasts auto-dismiss after 10 s |
| AUD-49 | P4 | 2.3.3 (AAA) / good practice | `prefers-reduced-motion` covers hover transforms and `--dur`, but not the 0.3 s view/modal/toast keyframes, the 1.6 s card flash, or smooth scrolling |
| AUD-50 | P3 | 4.1.2 / 2.1.1 | Reel Studio: 0 ARIA / role / tabindex attributes, 17 clickable non-focusable elements |
| — | ✅ | 2.5.5 (AAA) / mobile | 44 px minimum touch targets under 768 px for `.btn`, `.btn-icon`, `.sidebar-item` and form controls |
| — | ✅ | 1.4.3 | Dark theme and Studio themes: body text passes comfortably. `.btn-primary` passes on every preset skin. |

The ARIA inventory for the whole app shows how thin it is: **1** `aria-label` (the hamburger, `:1383`), **1** `role` (`role="group"`), **4** `aria-pressed`, and **0** of `aria-modal`, `aria-live`, `aria-expanded` and `tabindex`. There are 155 `<button>` elements.

---

## 1. Contrast per theme and skin

Tokens: dark theme `:root` (`:23-35`), light theme `body.light-theme` (`:80-92`), Studio base (`:6787-6796`), skins `SKINS` (`:7089-7100`, accent = `oklch(0.72 C H)` via `setSkinVars` `:7116-7122`), Studio presets `THEME_PRESETS` (`:6799-6800`).

### 1.1 Text tokens (AA: 4.5:1 normal text, 3:1 large text / UI)

| Theme | `--text` | `--text2` | `--text3` | `--text4` | border vs surface |
|---|---|---|---|---|---|
| Dark (bg) | 16.81 ✅ | 10.25 ✅ | 4.78 ✅ | **2.55 ❌** | 1.40 |
| Dark (on `--surface2`) | 15.19 | 9.26 | **4.32 ❌** | **2.31 ❌** | — |
| Light (bg) | 16.19 ✅ | 8.02 ✅ | **3.91 ❌** | **2.39 ❌** | 1.50 |
| Light (on `--surface2`) | 15.10 | 7.48 | **3.64 ❌** | **2.23 ❌** | — |
| Studio Bi/Duo/Tri (bg) | 17.17 ✅ | 10.47 ✅ | 4.88 ✅ | **2.61 ❌** | 1.39 |

Usage:
- `color: var(--text3)` appears 74 times, including metadata, counts and hints.
- `color: var(--text4)` appears 18 times, e.g. the dashboard mini-bars `:8006` `font-size:9px;color:var(--text4)`.
- There are 58 declarations at 8–10 px font size, so "large text" relief never applies to them.

### 1.2 Accent and semantic colours used as text

| Skin (`oklch 0.72 C H`) | on dark bg | on **light** bg | `.btn-primary` text `#1a0a06` on accent |
|---|---|---|---|
| coral | 7.26 | **2.57** | 7.10 |
| amber | 7.57 | **2.47** | 7.41 |
| lime | 8.30 | **2.25** | 8.13 |
| teal | 8.39 | **2.23** | 8.21 |
| ocean | 8.17 | **2.29** | 7.99 |
| indigo | 7.83 | **2.39** | 7.66 |
| violet | 7.59 | **2.46** | 7.43 |
| rose | 7.34 | **2.54** | 7.19 |
| mono | 7.94 | **2.35** | 7.77 |
| gold | 7.81 | **2.39** | 7.65 |

| Semantic | on dark bg | on light bg |
|---|---|---|
| `--green` | 9.71 | **1.92** |
| `--yellow` | 11.13 | **1.68** |
| `--orange` | 9.23 | **2.02** |
| `--blue` | 8.14 | **2.29** |
| `--danger` | 5.54 | 3.37 (large text only) |

`color: var(--accent)` appears 47 times (links, active states, counts). The **quota indicator**, the one number in the header, is drawn in green, yellow or danger (`:6155` `` `<span style="color:${color}" …>${APP.quota.pool} / ${QUOTA_LIMITS.pool}</span>` ``). In the light theme it sits at 1.7–3.4:1.

Studio themes are a locked black base, so their presets pass on dark: 5.2–16.4:1 as text, and 5.0–15.7:1 for `.btn-primary`. But `body.light-theme` still overrides surfaces under a Studio theme (comment `:7013-7014` "so body.light-theme keeps overriding surfaces in light mode"). There, the presets as text drop to **1.16–3.67:1**. For example `#e8e8e8` gives 1.16 and `#f5e642` gives 1.22.

### AUD-42 (P3) — fix
- Derive a separate `--accent-text` for the light theme: same hue, L ≈ 0.50 in oklch, which gives ≥ 4.5:1 on `#f8f9fa`.
- Darken semantic text colours in light mode the same way.
- Raise `--text3` to ≈ `#6b6e76` (light) and `--text4` so both reach 4.5:1, or keep `--text4` for disabled/decorative use only.

**Effort** S (tokens) + M (audit the 47 accent-as-text uses).

### AUD-43 (P3) — user-chosen colours and borders
- `setAccentVars(hex)` accepts any colour from the in-page picker (#74), and `.btn-primary { background: var(--accent); color: #1a0a06; }` (`:144`) keeps dark text. A custom accent like `#1f2a6b` gives dark-on-dark buttons. **Fix:** pick `#1a0a06` or `#fff` by computed luminance, and warn in the picker below 4.5:1.
- Borders: 1.39–1.50:1 against surfaces. Where a border is the only visible boundary of an input (`.form-control`, `:927-930`), 1.4.11 asks for 3:1.

**Effort** S.

## 2. Keyboard navigation

### AUD-44 — non-focusable click targets (P3)
The full-markup scan counts `onclick` on 77 `<div>`, 8 `<span>` and 1 `<img>`. There are **0** `tabindex` and **0** `role="button"`. Examples:
- `:8296` dashboard legend rows `<div class="dash-pl-row" … onclick="…drillFromDashboard(…)">`
- playlist cards, stat cards (`.stat-card[onclick]` is styled at `:268+`)
- Watch-plan thumbnails, the whole Discover result tile (`:11947` `<div … onclick="event.stopPropagation();playVideo(…)">`)
- mini-thumb `:2747` `<img class="mini-thumb" … onclick="expandPlayer()">`

A keyboard user can't open a playlist from the dashboard, drill into stats, or play a Discover result from its thumbnail.
- **Reorder** is drag-and-drop only (`:10561` `draggable="true" ondragstart=…`, the single draggable site). There's no button or keyboard alternative, which fails 2.1.1.
- **Deck** columns are built from the same clickable-`div` pattern (`:13312+`), « non vérifié » item by item.

**Fix:** make these `<button>`s or `<a href>`s (this lands naturally with the AUD-02 event-delegation refactor), and add "move up / down" buttons in reorder mode. **Effort** M.

### AUD-45 — modals and player overlay (P3)
- `:2678` `<div class="modal-overlay" id="modalOverlay" onclick="closeModal(event)">`: no `role="dialog"`, no `aria-modal`, no label.
- `openModal()` (`:15188-15191`) sets `innerHTML` and adds `.active`. **Focus is not moved into the dialog**, not trapped, and not returned to the trigger on close (`:15243-15247`).
- Escape closes the generic modal (`:15372-15373` `} else if (e.key === 'Escape') { closeModal(); }`) ✅, but **not** the player overlay (`:2686`). The docked player (`:425-452`) is reachable by Tab only if focus happens to be near it.

**Fix:** use a native `<dialog>` with `showModal()` (built-in focus trap, Escape, `::backdrop`), and restore focus to `document.activeElement` captured on open. **Effort** S–M.

### Keyboard shortcuts
Ctrl/Cmd+K opens search and Ctrl/Cmd+B opens backup (`:15362-15371`). Ctrl+B shadows the browser's bookmarks shortcut in Firefox (P4). They're documented only in « non vérifié » places.

## 3. ARIA on icon buttons
- 44 buttons contain only an SVG. 39 carry `title=` or `data-i18n-title=`, which browsers use as the accessible name.
- **4 have no name at all:** `:2753-2756` (prev / play-pause / next / close of `#miniPlayer`), dead UI per AUD-29.
- Several `title` values in JS templates are English literals, not `t()`: `:9578` `title="Rename"`, `:12870` `title="Edit tags"`, `:13087` `title="Edit"`. The accessible name stays English in the French UI (ties to AUD-27).
- Toggle state: `aria-pressed` is used 4 times (the old music button, `:10655`, is dead). The library lens, Shorts filter and theme/skin swatches expose no pressed or selected state, « non vérifié » exhaustively.

**Fix:** give icon buttons `aria-label` via `t()` and add `aria-pressed` on toggles. **Effort** S.

## 4. Focus visible — AUD-46 (P3)
- `grep` finds **no** `:focus-visible` rule in the app.
- Buttons are reset (`:105` `button { … border: none; background: none; }`); UA focus rings survive on them, but inconsistently across themes. Dark UA rings on `#0a0b0d` are hard to see, « non vérifié » visually.
- Inputs: `:927` `outline: none;` then `:930` `.form-control:focus { border-color: var(--accent-line); … }`. `--accent-line` is the accent at **40 % alpha** (`:39`). On a 1.4:1 border baseline, the focus change is subtle. Same pattern for the colour-picker fields (`:198-200`) and the client-ID input (`:297-298`).

**Fix:** add a global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` and remove the `outline: none` declarations. **Effort** S.

## 5. Touch targets — ✅ with gaps
- `@media (max-width: 768px)`: `.sidebar-item { … min-height: 44px; }` (`:1293`), `.btn { min-height: 44px; … }` (`:1294`), `.btn-icon { min-width: 44px; min-height: 44px; … }` (`:1296`), form controls 44 px (`:1297`). #72 adds larger targets in the Studio palette.
- Gaps: `.btn-sm` (`:152` `padding: 5px 10px; font-size: 12px`) is used for most row actions (rename, delete, edit tags). Whether `.btn`'s mobile min-height reaches it depends on the element carrying both classes, which it does in the templates read (`class="btn btn-secondary btn-sm"`).
- The docked player's controls shrink to `padding: 5px 7px` with 14 px icons (`:445`, `:488`), about 28 px.
- Subscribe pills and chips are « non vérifié ».

## 6. Language — AUD-47 (P3)
- `:2` `<html lang="fr">` (and `reel-studio.html:2`). `applyLanguage()` (`:4342+`) updates text and `langToggle` but never sets `document.documentElement.lang`, so an English UI is read with French pronunciation (3.1.1, level A).
- The privacy policy modal is hard-coded French (`:15198-15199` `Politique de confidentialité — Playlist Manager`, `toLocaleDateString('fr-FR')`). It is also a legal text shown to EN users (backlog #8).

**Fix:** set `lang` in `applyLanguage`, and move the policy into `I18N`. **Effort** S.

## 7. Status messages — AUD-48 (P3)
`showToast()` (`:15251-15270`) appends a `<div class="toast">` with `textContent`. The container has no `role="status"`/`aria-live`, so success, error and quota warnings are silent for screen-reader users (4.1.3). Life is 3 s, or 10 s when the toast carries an action (`:15258`, `:15265`). An action the user can't reach in 10 s, such as "Reconnect" (`:7297`), disappears (2.2.1). **Fix:** `aria-live="polite"` (errors `assertive`), and pause dismissal on hover or focus. **Effort** S.

## 8. `prefers-reduced-motion` — AUD-49 (P4)
Covered ✅:
- `:76-78` `--dur: 0ms`
- `:268-280` Studio-theme hover lifts
- `applyTheme()` skips motion tokens (`:7023-7026`)
- Reel Studio covers its ticker, EQ, cards and hover effects (`reel-studio.html:36, 69, 85, 91, 103, 172, 187, 217, 385`)

Not covered:
- keyframe animations with fixed durations not tied to `--dur`: `:587` `.view.active { … animation: fadeIn 0.3s; }`, `:893` modal `fadeIn 0.2s`, `:905` `slideUp 0.3s`, `:945` toast `slideInRight 0.3s`, `:868` `plCardFlash 1.6s`
- `:95` `html { scroll-behavior: smooth; }` and `:8380` `scrollIntoView({ behavior: 'smooth' … })`

These are small fades, so AAA-level only, but the intent to honour the preference is already in the code. Extend it: `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation: none !important; scroll-behavior: auto !important; } }`. **Effort** S.

## 9. Reel Studio — AUD-50 (P3)
`reel-studio.html` contains **0** `aria-*`, `role` or `tabindex` attributes and 17 clickable `<div>/<span>/<article>` elements (e.g. `:1136` `<article class="card pl-card reactive" onclick="go('playlists','…')">`, `:1483`). Its player sheet collapses off-screen (AUD-28), and the bottom bar's transport buttons are text glyphs (`⏮ ▶ ⏭`, `reel-studio.html:512-514`) with `title` only. It has the same needs as the app: buttons/links for cards, `aria-label`s, `lang`, focus styles. **Effort** M.

## Not verified
- Real rendering: the UA focus-ring visibility per theme, the actual computed contrast of translucent overlays (`--accent-soft` backgrounds), and text over thumbnails (duration badges `rgba(0,0,0,0.8)` over images, `:10569`).
- Screen-reader behaviour of the YouTube IFrame player controls (third-party).
- Deck and Watch-plan interactions item by item.
