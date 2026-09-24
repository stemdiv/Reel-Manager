# Pass 4 — Technical debt

> **Status (24/09/2026):** this report describes the code at `9c824eb` (app v1.27.3). Fixes since, errata and new findings: [`08-remediation.md`](08-remediation.md).

Base `origin/main` @ `9c824eb`, app **v1.27.3**. Read-only. The `engineering:tech-debt` skill is not installed, so I applied the handoff's checklist by hand. Metrics come from throwaway scripts in the scratchpad (function-length scan with naive brace matching, reference counting, 6-line duplicate windows, an `I18N` eval). Every `:N` reference without a file name points to `youtube-playlist-manager.html`.

## 1. Size and shape

| Part of `youtube-playlist-manager.html` | Lines | Bytes |
|---|---|---|
| Whole file | 15,457 | 784,106 |
| CSS `<style>` (:22–1321) | 1,300 | 60 KB |
| HTML body (:1323–2759) | 1,437 | 128 KB |
| JS `<script>` (:2760–15454) | 12,695 | 595 KB |
| — of which `I18N` fr+en (:2774–4331) | 1,558 | 78 KB |
| — of which `CHANGELOG` (:4418–4610) | 193 | 27 KB, **French only**, shown to EN users too (`:6732` `CHANGELOG.map(...)`) |
| Comment lines (`^\s*//`) | 1,139 | — |

Code-level counts:
- 461 named functions in the app script; 10 are over 100 lines and 34 over 50.
- 322 inline `on*=` handlers (AUD-02) and 724 inline `style="` attributes.
- 389 `document.getElementById(` calls.
- **59 empty `catch` blocks** (`catch (e|_|err) { }`).
- Reel Studio: 1,786 lines, with **16 functions re-implemented** from the app.

## 2. Backlog items #G15–#G19 (verification)

| Item | Status | Evidence | Residue |
|---|---|---|---|
| #G15 dedupe `parseDuration` + formatters | 🟡 | One `parseDuration` (`:9801`) ✅. But **three** duration formatters remain: `formatDuration` (`:9808`), `formatIsoDuration` (`:13924`, Watch plan, `h:mm:ss`) and an inline one in `performDiscoverSearch` (`:11873-11874`). Reel Studio has its own `parseDuration` (`reel-studio.html:889`). | → AUD-34 |
| #G16 remove dead code | ✅ | `drawBarChart` is gone (grep: only in CHANGELOG `:4561`) | New dead code found, → AUD-38 |
| #G17 `APP.lang` | ✅ | `:8922-8924` `// #G17: APP.lang was never assigned … const lang = currentLang \|\| 'fr';`, and no other `APP.lang` | — |
| #G18 merge by id | ✅ | `:12193-12205` (Pass 3) | — |
| #G19 dirty flag on auto-cache | ✅ | `:7762` `APP_DIRTY = false;   // #G19: the cache write IS the save` | — |

## 3. Findings

### AUD-32 — orphaned "Mode Musique" state (P2, functional; corrects Pass 0 #J2)
- `tests.html:2367-2370`: the test `'the old dedicated music button is gone from the detail header'` asserts `!w.document.getElementById('musicModeBtn')`. The #J2 button was **removed** and replaced by the #17 library lens.
- `:10657` `function toggleMusicMode()` now has **0 references** (script count: 1 = the definition), yet
- `:10650` `musicMode = (… localStorage.getItem('reelMusicMode') === '1');` is still read, and
- `:10673` `resetVideoFilters()` does `if (ft) ft.value = musicMode ? 'music' : 'all';`, then `:10678` `if (musicMode) { onFilterTypeChange(); }`.

A user who turned the toggle on before its removal can no longer turn it off: "Reset filters" resets **to** Music. Pass 0 marked #J2 ✅ on the strength of the code. In fact #J2 was superseded by #17, and this residue is a bug. **Fix:** delete `musicMode`, `updateMusicModeBtn` and `toggleMusicMode`, remove the `reelMusicMode` key once at boot, and add it to the purge list (AUD-03). **Effort** S.

### AUD-33 — app ↔ Reel Studio duplication (P3)
Functions defined in **both** files: `hexToHsl`, `hsl`, `categoricalsFor`, `accentsFor`, `applyTheme`, `hexToRgb`, `rgbToHsv`, `hsvToRgb`, `openPicker`, `closePicker`, `renderPicker`, `cpFromHex`, `cpFromRgb`, `cpDrag`, `pickThumb`, `parseDuration`. Both define `const THEMES` (`:6802`, `reel-studio.html:625`), and 37 identical 6-line windows are shared. Every theme or picker fix (#70, #72, #74) has had to land twice. The IndexedDB reader is also duplicated (`reel-studio.html:936` vs `cacheStore`). **Fix:** extract `theme.js`, `picker.js`, `thumbs.js` and `cache-read.js` as plain ES modules served next to the pages (no bundler needed). **Effort** M.

### AUD-34 — three duration formatters (P3, #G15 residue)
See §2. The outputs differ for the same input: `formatDuration(3725)` gives `1h02m`, the Watch plan gives `1:02:05`, Discover gives `1:02:05`. **Fix:** one `formatDuration(seconds, style)`. **Effort** S.

### AUD-35 — long functions (P3)
| Function | Line | Lines |
|---|---|---|
| `ytApi` | :7302 | 214 |
| `runCacheDiagnostic` | :6322 | 195 |
| `executeRestore` | :14755 | 173 |
| `performDiscoverSearch` | :11768 | 159 |
| `refreshDashboard` | :7953 | 133 |
| `showAutoCategorizerModal` | :13644 | 124 |
| `loadBackupFromStorage` | :5889 | 122 |
| `generateStatisticsCharts` | :12698 | 122 |
| `exportLibrary` | :15054 | 115 |
| `generateDashboardCharts` | :8249 | 104 |

`ytApi` is long but coherent; split it along its own banners (gates / cache / charge / fetch-retry / map-error / post-process) when it moves server-side. `executeRestore` and `showAutoCategorizerModal` mix I/O, quota, progress UI and DOM strings in one body. That mixing is why #78 (no quota guard on the scan) and AUD-22 (restore skips `checkQuotaBudget`) went unnoticed. **Effort** M each.

### AUD-36 — silent error swallowing (P3)
There are 59 empty `catch` blocks. Many are legitimate: storage writes, `try { showToast(...) } catch (e) {}`. The same pattern hid the v1.27.3 bug ("the catch fell back … without a word in the console", CHANGELOG `:4419+`) and hides #78's quota failure (`getVideoDetails` returns `{}` on error). **Fix:** a `swallow(tag)` helper that at least calls `log('debug', …)`, and a lint rule against empty catches outside storage wrappers. **Effort** S.

### AUD-37 — single-file monolith (P3)
784 KB in one file: the i18n tables (78 KB), CHANGELOG (27 KB), CSS (60 KB) and templates all ship on every load and all diff in one file. Globals couple everything (Pass 1 A1/A2). Splitting is blocked chiefly by the 322 inline handlers (AUD-02), which need global function names. `tests.html` also reaches into `w.<fn>` globals, so any module split must keep a `window` export surface or the 281 tests break. **Effort** L (staged, see §5).

### AUD-38 — dead code (P4)
- `toggleMusicMode` / `updateMusicModeBtn` (`:10651-10665`): see AUD-32.
- `addToQueueFromCard` (`:8853`): 0 references.
- `isCategoryAssignable` (`:9851`): 0 references (backlog 10 Aug lists it as shipped API).
- `#miniPlayer` markup + CSS (AUD-29).
- The `If-Match` / 412 branches (AUD-18).
- `updateProgress` is defined twice: global at `:13769`, and an inner function in `executeRestore` at `:14813` that shadows it.

Not dead: `onYouTubeIframeAPIReady` (`:8417`) is the IFrame API's global callback.

### AUD-39 — magic constants (P3)
- Quota copies: AUD-22 (`:2612`, `:6509`, `:14722`, `:14762`).
- Page caps: `maxPages = 20` default (`:7517`) and the literal `p < 20` (`:11481`). See AUD-13 and AUD-01.
- Retention: `daysSinceLogin > 30` (`:6306-6307`), backup age `hours >= 24` (`:6099`, `checkBackupSafety`), OAuth resume window `600_000` (`:6711`).
- Timers: toast lives `3000` / `10000` (`:15258`, `:15265`), and 10 `setTimeout(…, ≥100)` literals.
- Storage key names: 32 string literals spread across the file (AUD-03 needs a registry).
- Batch size 50: `slice(0, 50)`, `i + 50` in ~10 places.

The handoff's "hard-coded lines cited in the handoffs" can't be cross-checked because the lot handoffs are missing (« non vérifié »). **Fix:** a `CONFIG` block next to `QUOTA_LIMITS` (limits, caps, retention, timers) and an `APP_STORAGE_KEYS` registry. **Effort** S.

### AUD-40 — declaration-order coupling (P3)
`:5521` `// Video details cache — MUST be declared before loadBackupFromStorage() to avoid TDZ`, and `var cacheStore` (`:5678`) uses `var` on purpose for hoisting. Module-level `let` state (`videoDetailsCache`, `currentDetailVideos`, `moveVideosCache`, `musicMode`, `PLAYER`, `restoreData`…) is read across sections. Reordering code for a split can introduce TDZ errors that only show at runtime. **Fix:** move this state into `APP` (or a small `state` module) before any split. **Effort** M.

### AUD-41 — CHANGELOG French-only and accent-stripped (P4)
`:4418-4610` holds user-visible release notes in ASCII-folded French ("Categorisation auto", "desormais"), rendered in the version modal whatever `currentLang` is. **Fix:** move it out of the app bundle into a `changelog.json` (FR/EN), or keep the notes in the backlog only. **Effort** S.

## 4. Cost / benefit ranking

Benefit is scored against risk reduction and Phase 4 readiness; cost is S ≈ ≤ ½ day, M ≈ 1–3 days, L ≈ > 1 week.

| Rank | Item | Benefit | Cost | Why now |
|---|---|---|---|---|
| 1 | AUD-39 `CONFIG` + `APP_STORAGE_KEYS` registry | High: unblocks AUD-03 (P1 GDPR), AUD-22, AUD-13 | S | Pure data, no behaviour change |
| 2 | AUD-32 + AUD-38 dead code removal | Medium: fixes a user-visible stuck state | S | Deletion only |
| 3 | AUD-36 `swallow()` helper | Medium: makes the next #78-class bug visible | S | Mechanical |
| 4 | AUD-34 one duration formatter | Low-medium | S | Pure function, easy to test |
| 5 | Extract pure modules (quota tables, `normalizeEndpoint`, `getQuotaCost`, `parseDuration`/formatters, `musicScore`, `parseArtistTitle`, `detectShort`, `csvCell`, `escapeHtml`/`escapeJsAttr`) into `lib/*.js`, still exposed on `window` for the page and `tests.html` | High: shared with Studio, reusable by the Node proxy, testable in Node | M | Prerequisite for Phase 4 |
| 6 | AUD-33 shared theme/picker/thumbs modules for app + Studio | Medium | M | Uses step 5's mechanism |
| 7 | AUD-40 move loose state into `APP` | Medium: de-risks every later move | M | Before splitting views |
| 8 | AUD-02 inline handlers → event delegation (`data-action`) per view | High: enables a strict CSP and fixes the XSS class structurally (AUD-04/05/06) | L | View by view, one commit each |
| 9 | AUD-35 split the long functions | Medium | M | Alongside the view each belongs to |
| 10 | AUD-37 file split (CSS file, `i18n/fr.json`, `i18n/en.json`, per-view scripts) | Medium: load time, diff noise | L | Last, once 5–9 have made it mechanical |
| 11 | AUD-41 changelog out of the bundle | Low | S | Any time |

## 5. Refactoring order compatible with the Phase 4 backend extraction

The Pass 1 §6 extraction order is auth → proxy → Redis → PostgreSQL. The refactors that make each step cheap:

1. **Before auth/proxy:** ranks 1, 5 and 3. The quota model, endpoint normalisation and error mapping become importable by both the browser and the Node proxy, so the proxy reuses the tested code instead of re-deriving it. `ytApi`'s signature stays the seam (Pass 1).
2. **While the proxy lands:** split `ytApi` (AUD-35) into `transport` (becomes the `fetch('/api/yt/…')` call) and `policy` (cache, quota, retry, which move server-side). Fix AUD-17/18/19/20 on the way; they are all in that function.
3. **Before PostgreSQL:** rank 7 (state in `APP`) plus a **versioned backup schema** (AUD-06). The same schema becomes the SQL model and the IndexedDB offline mirror, and must carry `itemId` (AUD-14) and `complete` (AUD-13).
4. **Independent UI track, any time:** ranks 2, 4, 6, 8, 9, 10, 11. The inline-handler removal (8) is what finally allows `script-src 'self'` without `'unsafe-inline'`.

Throughout, keep `window.<fn>` exports until `tests.html` is migrated to import modules. Otherwise the 281-case safety net is lost at exactly the moment it's needed.
