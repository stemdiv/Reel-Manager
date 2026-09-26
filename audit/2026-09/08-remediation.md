# Pass 8 — Remediation status (Lots 4–9)

Status of every finding of this audit after the fix lots proposed in [`code-review-2026-09.md`](code-review-2026-09.md) §5, as of 24/09/2026. The pass reports 00–06 and the consolidated table are left as written: they describe the code at `9c824eb` (app v1.27.3). This report records what changed since, what the fixes revealed about the audit itself (errata), and the findings the fix work turned up.

French version: [`fr/08-remediation.md`](fr/08-remediation.md).

## 1. Summary

- Six lots, six stacked pull requests, **none merged yet**. Merge order: [#3](https://github.com/stemdiv/Reel-Manager/pull/3) → [#4](https://github.com/stemdiv/Reel-Manager/pull/4) → [#5](https://github.com/stemdiv/Reel-Manager/pull/5) → [#6](https://github.com/stemdiv/Reel-Manager/pull/6) → [#7](https://github.com/stemdiv/Reel-Manager/pull/7) → [#8](https://github.com/stemdiv/Reel-Manager/pull/8). This PR ([#2](https://github.com/stemdiv/Reel-Manager/pull/2)) stays unmerged, per the handoff.
- App v1.27.3 → **v1.27.51**, Reel Studio → **0.7.6**. One commit per item, each with tests; every new case was replayed on the commit before its fix and fails there, except the guards named below.
- `tests.html`: 281 cases → **447, all passing**, run headless with every host except `127.0.0.1` blocked (no YouTube API call, no quota).
- Of the 53 rows of the consolidated table: **44 fixed**, **3 partly fixed** (#G6, AUD-08, AUD-33), **1 false positive** (AUD-31), **5 open** (AUD-02, AUD-26, AUD-35, AUD-37, AUD-40, none of them in a lot).
- The fix work found **4 new findings** (AUD-51 to AUD-54). AUD-51 and AUD-52 were real bugs in production code, one of them an XSS (AUD-52). Three are fixed; AUD-54 is open and not investigated.

| Lot | PR | Branch | Commits | Tests after | App version after |
|---|---|---|---|---|---|
| 4 — Security & ToS | [#3](https://github.com/stemdiv/Reel-Manager/pull/3) | `lot4-security-tos` | 5 | 301 | 1.27.8 |
| 5 — Data integrity | [#4](https://github.com/stemdiv/Reel-Manager/pull/4) | `lot5-data-integrity` | 6 | 319 | 1.27.14 |
| 6 — Quota | [#5](https://github.com/stemdiv/Reel-Manager/pull/5) | `lot6-quota` | 10 | 344 | 1.27.23 |
| 7 — Hardening | [#6](https://github.com/stemdiv/Reel-Manager/pull/6) | `lot7-hardening` | 8 | 380 | 1.27.31 |
| 8 — Accessibility | [#7](https://github.com/stemdiv/Reel-Manager/pull/7) | `lot8-a11y` | 9 | 411 | 1.27.40 |
| 9 — i18n & debt | [#8](https://github.com/stemdiv/Reel-Manager/pull/8) | `lot9-debt` | 11 | 447 | 1.27.51 |

## 2. Status per finding

Status: **Fixed** · **Partial** (the part left open is named) · **Open** · **False positive**. Commits are on the lot branch named in the Lot column.

| ID | Sev. | Status | Lot | Commit | Notes |
|---|---|---|---|---|---|
| AUD-03 | P1 | Fixed | 4 | `4832302` | `APP_STORAGE_KEYS` / `APP_SESSION_KEYS` registries shared by both purge paths, Studio keys included; a test fails if any key written by either page is missing. |
| AUD-04 | P1 | Fixed | 4 | `2bc07d6` | `escapeJsAttr()` fixed and applied; **7 sites**, not the 2 listed (erratum E2). Exploit reproduced on the old code. |
| AUD-05 | P1 | Fixed | 4 | `31ecf7c` | `escapeHtml()` on chart and list attributes. |
| AUD-13 | P1 | Fixed | 5 | `bf69b98` | 100-page cap (5,000 items), `complete` flag, auto-save refuses to replace a longer cached list, backup/export warn. Old code measured: 1,000 of 3,000 items. |
| AUD-28 | P1 | Fixed | 4 | `d2fec92` | Collapsing docks the player at 356×200, visible; Studio pauses when the tab is hidden. |
| AUD-06 | P2 | Fixed | 7 | `2461e75` | `sanitizeBackup()` for import, startup load and restore; `schemaVersion: 1`; folder/tag/emoji sinks and every `<img src>` escaped. |
| AUD-07 | P2 | Fixed | 7 | `bfac8b8` | `escJs()` in Studio, 11 handler sites. Reel Studio 0.7.3. |
| #G6 | P2 | Partial | 7 | `b75d656` | `state` sent and checked (redirect and popup). **Open:** PKCE and the audience check (need a backend, Phase 4). |
| AUD-14 | P2 | Fixed | 5 | `02dafc0` | `itemId` kept through cache and backup; old caches reloaded once. Old code measured: Move sent 0 deletes. |
| AUD-15 | P2 | Fixed | 6 | `900fa77` | Six missing estimate keys (caption upload was estimated at 1 unit instead of 400); upload checked against the `upload` bucket. |
| AUD-16 | P2 | Fixed | 5 | `bc66203` | Move reports moved / copied-not-removed / not processed, and reloads both playlists. |
| AUD-17 | P2 | Fixed | 6 | `19fd743` | GET responses cached for their TTL with or without a readable `ETag`. « non vérifié »: whether Google exposes `ETag` to the page — the fix does not depend on it. |
| AUD-32 | P2 | Fixed | 5 | `9f3ee1d` | Music Mode state and toggle removed; `reelMusicMode` dropped at start-up. |
| AUD-01 | P3 | Fixed | 6 | `bd33480` | Channel playlists capped at 3 pages, pre-flighted. The old #82 test accepted 20 calls; it now requires 3. |
| AUD-02 | P3 | **Open** | — | — | Event delegation is Track L. Until then `'unsafe-inline'` stays; AUD-44/50 give keyboard access without it. |
| AUD-08 | P3 | Partial | 7 | `1701e14` | `form-action 'none'` on all four pages; CSPs on the two tool pages (the estimator by script hash). **Open:** `frame-ancestors` needs an HTTP header from the host. |
| AUD-09 | P3 | Fixed | 7 | `b1e4d53` | Chart.js vendored (npm 4.4.1, unmodified) with `integrity`; SRI on cdnjs was not possible here (erratum E6). |
| AUD-10 | P3 | Fixed | 7 | `bdcb9d1` | Unanchored token patterns, `msg` redacted, titles no longer logged; `diagnosticLog` purged since AUD-03. |
| #G13 | P3 | Fixed | 4 | `9942c2a` | Hash read and cleared before `init()` awaits anything. |
| AUD-18 | P3 | Fixed | 6 | `039531b` | `If-Match` / 412 path removed (it could never run). |
| AUD-19 | P3 | Fixed | 6 | `e9a502f` | A POST is retried only after an explicit 429. |
| AUD-20 | P3 | Fixed | 6 | `0a1fcdb` | `rateLimitExceeded` / `userRateLimitExceeded` 403s retried like 429. |
| AUD-21 | P3 | Fixed | 6 | `2ce4031` | `chargeCall()`: every billed request charged before it is sent, after the Pacific reset check, uploads included. |
| AUD-22 | P3 | Fixed | 6, 9 | `d155169`, `f947283` | Every displayed limit and cost derived from the quota tables. Two copies the audit missed (erratum E3). |
| AUD-23 | P3 | Fixed | 5 | `9ffc40d` | Merge loads every source, inserts each video once, estimates what it will insert. |
| AUD-24 | P3 | Fixed | 5 | `7f3d630` | Bookmarks excluded; candidates re-checked live (1 unit / 50 videos); nothing deleted if the check fails. Old code measured: 13 items deleted where 1 was a real ghost. |
| AUD-25 | P3 | Fixed | 9 | `d011aa8` | One classifier answering two nested questions: `isTrack` (#17) and `isMusic` (#J1). A single yes/no would have broken one of the two specs (a 2-hour set is music for #J1, not a track for #17). |
| AUD-27 | P3 | Fixed | 9 | `f947283` | ~130 strings (the audit counted 40+) and #80's eight; CSV headers/status, genre labels, suggested tags, dates. The developer cache-diagnostic panel stays English on purpose. |
| AUD-30 | P3 | Fixed | 9 | `741be04` | Same-origin pre-cache (with `shared/core.js`), `ignoreSearch` offline, cache named after the release, scripts/JSON network-first. The install failure reproduced live in the test runner, where Google hosts are blocked. |
| AUD-33 | P3 | Partial | 9 | `02b6ce3` | Pure helpers (colour maths, thumbnails, durations) moved to `shared/core.js`. **Open:** theme application, the colour-picker widget and the IndexedDB readers (erratum E5). |
| AUD-34 | P3 | Fixed | 9 | `11f9489` | One formatter, two styles; one ISO parser. The dashboard had a copy the audit missed (erratum E4). |
| AUD-35 | P3 | **Open** | — | — | Track L. |
| AUD-36 | P3 | Fixed | 9 | `a42b893` | `swallow(tag, err, level)`; 72 empty catches at fix time (the audit's 59 plus those added by Lots 4–8), 56 routed through it, 6 in the logger commented; a lint-style test. |
| AUD-37 | P3 | **Open** | — | — | Track L. The app is ~47 KB lighter since AUD-41. |
| AUD-39 | P3 | Fixed | 9 | `06a4c43` | Frozen `CONFIG` block; the key registry shipped with AUD-03. |
| AUD-40 | P3 | **Open** | — | — | Track L. |
| AUD-42 | P3 | Fixed | 8 | `93756c9` | Tokens re-picked per theme; `--accent-text` clamps any accent by relative colour syntax (≥ 4.9:1 on light, ≥ 5.2:1 on dark for every hue). |
| AUD-43 | P3 | Fixed | 8 | `93756c9` | Primary-button fill clamped so its dark text keeps ≥ 6:1; field edges at 3:1. No picker warning needed. |
| AUD-44 | P3 | Fixed | 8 | `b8998c5` | One central pass gives every inline click target a tab stop and a role (`link` when it holds other controls), Enter/Space activate; ↑/↓ reorder buttons. |
| AUD-45 | P3 | Fixed | 8 | `e9894a9` | Dialog role/name, focus in and back, rest of the page `inert`, Escape docks the player. Not a native `<dialog>` (erratum E7). |
| AUD-46 | P3 | Fixed | 8 | `c67f33d` | Global `:focus-visible` ring, app and Studio; no `outline: none` left. |
| AUD-47 | P3 | Fixed | 8 | `00dda9f` | `lang` follows the UI; privacy policy in FR and EN. |
| AUD-48 | P3 | Fixed | 8 | `0f2574f` | Live region, errors as alerts, countdown paused under pointer/focus. |
| AUD-50 | P3 | Fixed | 8 | `9314ee9` | Studio: control names, slider seek bars, keyboard cards, landmarks. |
| #J3 | P3 | Fixed | 9 | `fbd1c3b` | The auto-categorizer suggests a playlist's shared genre as a tag. |
| AUD-11 | P4 | Fixed | 7 | `6fa9d63` | The deep link keeps only a valid playlist id. |
| AUD-12 | P4 | Fixed | 7 | `eb35508` | RFC 4180 reader; `Map`. |
| AUD-26 | P4 | **Open** | — | — | Square Shorts: in no lot. |
| AUD-29 | P4 | Fixed | 9 | `7258db3` | Dead mini-player removed, with its progress timer. |
| AUD-31 | P4 | **False positive** | 6 | `9fc23e7` | The 1-hour trending TTL existed (`buildTrendingParams`); it only took effect once AUD-17 was fixed. Comment corrected, test added (erratum E1). |
| AUD-38 | P4 | Fixed | 9 | `7258db3` | Unused helpers removed; the shadowed `updateProgress` renamed. |
| AUD-41 | P4 | Fixed | 9 | `370d555` | `changelog.json`, FR (accents restored, checked mechanically) and EN, loaded on demand and escaped. The English translation has not been reviewed by a person. |
| AUD-49 | P4 | Fixed | 8 | `e0e3b8a` | Reduced motion stops keyframes and smooth scrolling; the card flash becomes a static outline. |

Existing backlog items touched on the way: **#80** fixed with AUD-27; **#78 / #79** (auto-categorize quota guard) still open — AUD-36 makes that failure visible in the log but does not add the guard.

## 3. New findings

| ID | Sev. | Status | Lot | Commit | Finding |
|---|---|---|---|---|---|
| AUD-51 | P2 | Fixed | 6 | `c0260cd` | **Custom playlist covers (#I1) could never be uploaded.** The CSP `img-src` lacked `blob:`, so the chosen image could not be decoded and every attempt ended on "Cette image n'a pas pu être lue." The #I1 tests never reached that step. Found while testing AUD-15. |
| AUD-52 | P1 | Fixed | 9 | `39da97f` | **XSS in the Subscriptions view.** The first 100 characters of each channel's description went into `innerHTML` unescaped; a channel owner controls that text. Missed by the audit's sink inventory (titles were covered, descriptions were not). Found while routing that view through `t()` (AUD-27). |
| AUD-53 | P3 | Fixed | 8 | `2e9f846` | An axe-core 4.13 pass (WCAG 2.0/2.1 A/AA, seeded library, dark and light) after the Lot 8 items: unlabelled Backup fields, beta tags on an undefined `--warning` variable (2:1 on white), the active library lens at 2.6:1 in light, Studio's greeting line and unnamed sort menu. Violations went 175 → 0 (app contrast) and 44 → 0 (Studio contrast); labels 42 → 0. |
| AUD-54 | P4 | **Open** | — | — | Every `tests.html` run reports one page error, `Cannot set properties of null (setting 'textContent')`. Present before Lot 4 and after Lot 9. « non vérifié »: which call raises it and whether a user can hit it. |

## 4. Errata to the audit

| # | Where | Correction |
|---|---|---|
| E1 | AUD-31 | **False positive.** The trending TTL was set in `buildTrendingParams` (`_ttlMs`). What made it ineffective was AUD-17 (no cache without a readable `ETag`). |
| E2 | AUD-04 | Undercounted: **7** inline-handler sites used the broken escaper, not 2. |
| E3 | AUD-22 | Two more hard-coded copies: Discover's "create playlist" cost, and the dashboard quota tile's "/ 10k". |
| E4 | AUD-34 | A fourth ISO-duration parser in the dashboard totals. |
| E5 | AUD-33 | Of the 16 functions listed as duplicated, **5 were identical**; the others had already drifted (fallback colours, a `hexToHsl` that threw on a non-string, different signatures for the picker). The "shared modules" fix is an extraction for the pure helpers and a design change for the rest. |
| E6 | AUD-09 | SRI on the cdnjs file could not be computed from this environment (cdnjs unreachable); a guessed hash would block the script. Vendoring, the audit's alternative, was used. |
| E7 | AUD-45 | The recommended native `<dialog>` was not used: `showModal()` puts the dialog in the top layer, above the toast area, so an error toast raised from a modal would be dimmed and unreachable. `inert` on the rest of the page gives the same containment. |
| E8 | AUD-25 | "One score" would break a spec: #J1 counts mixes and live sets as music, #17 keeps them out of the Music view. The fix keeps one classifier with two nested answers. |
| E9 | AUD-27 | The count was ~130 visible strings, not 40+. |
| E10 | AUD-36 | 72 empty catches at fix time (59 at `9c824eb`, plus some added by Lots 4–8). |
| E11 | 05-testing §4 | The Playwright runner must block service workers (`serviceWorkers: 'block'`): once `sw.js` installed correctly (AUD-30), its requests bypassed `route()`. `sw.js` is now tested by running it against a fake worker scope. YouTube API and sign-in hosts never pass through the worker, so the zero-quota guarantee was not affected. |

## 5. Still open

- **Track L:** AUD-02 (event delegation, then a strict CSP), AUD-35 (long functions), AUD-37 (file split), AUD-40 (state out of declaration order), and the Phase 4 prerequisites of `04-tech-debt.md` §5.
- **Partial items:** #G6 (PKCE, audience check), AUD-08 (`frame-ancestors` header at the host), AUD-33 (themes, picker, cache readers).
- **Not in any lot:** AUD-26 (square Shorts), #78/#79 (auto-categorize quota guard), AUD-54.
- **Documents:** the backlog `.docx` files are not updated; the English changelog needs a human read.
- **CI:** the Playwright runner is still a local script; `05-testing.md` §4 recommends committing it as a CI gate (with the service-worker block of E11).
