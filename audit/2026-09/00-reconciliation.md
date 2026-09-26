# Pass 0 — Reconciliation of lots 1–3 against the code

> **Status (24/09/2026):** this report describes the code at `9c824eb` (app v1.27.3). Fixes since, errata and new findings: [`08-remediation.md`](08-remediation.md).

Audit branch `audit/2026-09`, base `origin/main` @ `9c824eb`. Code under review: `youtube-playlist-manager.html` **v1.27.3** (`APP_VERSION`, l.4414; the handoff quoted v1.12.1, which was the version *before* lots 1–3). Read-only pass; no API call made.

## 0. Sources and their gaps

| Reference asked for by the handoff | Present? | What was used instead |
|---|---|---|
| `claude_handoff-lot1/2/3-claude-code.md` | **Missing** | PR [stemdiv/Reel-Manager#1](https://github.com/stemdiv/Reel-Manager/pull/1) description (the merged "Lots 1–3" PR, 23 commits, v1.12.0 → v1.27.3) + backlog v6.5 §"Shipped — session of 16 September 2026" |
| `YouTube-API-Usage-Map-v2`, `Unused-API-Opportunity-Analysis-v2` | **Missing** | Cost table in code (`YT_QUOTA_COSTS`, l.5175) — used in Pass 1 |
| `Music Mode — Design Spec v1` (`Reel-Music-Mode-Design-Spec.docx`) | **Missing** | Backlog #17 row + the handoff's own figures (+0.9 / +0.7 / 2–7 min / 80 % / 50–80 %) |
| May 2026 code/API audit | **Missing** | Backlog appendix "Session of 14 May 2026" (items #47–#60) |
| `CLAUDE.md` | **Missing** | — |
| Backlogs | Present | `Backlog-YT-Playlist-Manager{,-EN}.docx` v6.5 (16 Sept 2026), text-extracted |

Consequences:
- **Lot boundaries are « non vérifié ».** PR #1 merges lots 1, 2 and 3 into one list without saying which item belongs to which lot. The tables below are therefore grouped by PR #1's own sections (Quota/API, Features, Production fixes), not by lot number.
- **Next free backlog number is #85, not #77.** Backlog v6.5 already uses #77–#84 ("Reminder — next free backlog number: #85"). The handoff's "#77 if #76 is the last" is outdated. Provisional `AUD-xx` IDs stay as instructed.
- The handoff speaks of a **three-bucket** model. The code (and backlog #83) has **four**: `pool`, `search`, `upload`, `stats` (l.5239). Not a defect: `videos.batchGetStats` got its own bucket in June 2026.

Legend: ✅ shipped · 🟡 partial · ❌ not shipped · ⚪ non vérifié.

---

## Table A — Lots 1–3, section "Quota & API" (PR #1)

| Item | Status | Evidence (`file:line` — excerpt) | Note |
|---|---|---|---|
| **#76** three-bucket quota | ✅ | `youtube-playlist-manager.html:5232` — `const QUOTA_BUCKETS = { 'search.GET': 'search', 'videos.POST': 'upload', 'videos.batchGetStats.GET': 'stats' }`<br>`:5239` — `const QUOTA_LIMITS = { pool: 10000, search: 100, upload: 100, stats: 10000 };` | Single entry point `chargeQuota()` l.5273. Legacy `quotaUnits` migrated once in `readQuotaState()` l.5362–5365. Pacific reset l.5291/5303. Full conformance review → Pass 3. |
| #76 side fix: `videos/rate` billed to upload bucket | ✅ | `:5258` — `return String(endpoint).split('?')[0].split(/[/:]/).filter(Boolean).join('.');`<br>`:5225` — `'videos.rate.POST': 50,` | Sub-paths and `:custom` methods are now kept. |
| **#73** Discover filters actually sent | ✅ | `:11659-11661` — `params.videoDefinition = f.definition; … params.videoCaption … params.videoLicense`<br>`:11666` — `if (after) params.publishedAfter = after;` | |
| `fields=` partial responses | ✅ | `:7896` — `fields: 'nextPageToken,items(id,contentDetails(videoId,videoPublishedAt),snippet(…`<br>`:7906` — `'playlistItems with fields= failed, retrying without it'` | A retry without `fields=` protects against a bad selector. |
| Region/language follow UI language (categories + search) | ✅ | `:13621-13624` — `ytApi('videoCategories', { part: 'snippet', regionCode: lr.regionCode, hl: lr.relevanceLanguage })`<br>`:11602` — `fr: { regionCode: 'FR', relevanceLanguage: 'fr' },` | Backlog #77 notes a residual defect: the tag label depends on the scan language (open item, not a regression). |
| fhd/qhd thumbnails, single `pickThumb()` | ✅ | `:9827` — `function pickThumb(thumbs, want) {`<br>`:7896` — `…thumbnails(medium(url),high(url),default(url),fhd(url),qhd(url)` | Reel Studio side ⚪ non vérifié (Pass 3). |

## Table B — Lots 1–3, section "Features" (PR #1)

| Item | Status | Evidence | Note |
|---|---|---|---|
| **#68** Shorts — (1) system playlists | ✅ | `:10137` — `const CHANNEL_SYSTEM_PLAYLISTS = { uploads: 'UU', longForm: 'UULF', shorts: 'UUSH', live: 'UULV' };` | |
| #68 — (2) heuristic `embedHeight > embedWidth && ≤ 180 s` | ✅ | `:10120` — `return h > w && d <= SHORT_MAX_SECONDS;`<br>`:10108` — `const SHORT_MAX_SECONDS = 180;`<br>`:7934` — `maxHeight: 8192,` | Matches backlog #68 exactly. |
| #68 — (3) fallback `HEAD youtube.com/shorts/{id}` | ❌ | No `HEAD` / `youtube.com/shorts` anywhere in the file (grep: 0 hits). | Backlog labels it "verification only, unofficial". From a browser it can't be done anyway: cross-origin without CORS, and `connect-src` (l.10) does not allow `youtube.com`. It would need the Phase 4 backend. **Not a defect, a scope gap** — to be reclassified in the backlog. |
| **#I3** like in player (`getRating` / `rate`) | ✅ | `:5196` — `'videos.getRating.GET': 1,`<br>`:8644` — `await ytApi('videos/rate', { id: item.videoId, rating: next }, 'POST');` | |
| **#I2** subscribe from Discover | ✅ | `:14202` — `const data = await ytApi('subscriptions', { part: 'snippet' }, 'POST', {`<br>`:6178` — `'subscribe': count * YT_QUOTA_COSTS['subscriptions.POST'],` | |
| **#G14** write-scope upgrade in popup + resume | ✅ | `:6650` — `function openOAuthPopup(scope) {`<br>`:6623-6628` — `window.opener.postMessage({ type: OAUTH_POPUP_MESSAGE, token, … }, window.location.origin);`<br>`:6640` — `if (!event \|\| event.origin !== (expectedOrigin \|\| window.location.origin)) return false;` | Origin-pinned in both directions. Security depth → Pass 2. |
| **#G11** autoCache → IndexedDB + fallback + migration | ✅ | `:5672` — `const CACHE_DB_NAME = 'ytpm';`<br>`:5576` — `const m = await cacheStore.migrateLegacy();`<br>`reel-studio.html:943` — `req = indexedDB.open('ytpm');` | Delete-my-data clears the DB too (`:6292`). |
| **#17** Music Mode (tracklist view, detection, override, lens, docked player) | ✅ | `:10220-10228` — `topicChannel: 0.9, musicCategory: 0.7, … MUSIC_PLAYLIST_THRESHOLD = 0.8; MUSIC_MIXED_THRESHOLD = 0.5;`<br>`:10210` — `if (override === 'music' \|\| override === 'video') return override;`<br>`:440` — `.player-modal-overlay.docked .player-video-wrap { padding-bottom: 180px; }` | Detail in Table D. |
| **#18** transfer-ready CSV preset | ✅ | `:15031` — `var TRANSFER_CSV_HEADERS = ['title', 'artist', 'album', 'isrc'];`<br>`:9717` — `sel.value = currentDetailViewMode === 'music' ? 'csv-transfer' : 'csv';` | Preselected in Music view as specified. |
| **#81** Trending tile (`chart=mostPopular`) | ✅ | `:8114` — `chart: 'mostPopular',`<br>`:8088` — `// videos.list?chart=mostPopular is 1 unit from the pool — not the search bucket,` | ⚠ The TTL comment at l.5456–5458 ("re-fetching it on every dashboard visit would spend units") is **not followed by any TTL entry**. `chart=mostPopular` shares the `videos.GET` key (5 min). → Pass 3. |
| **#82** Discover playlists/channels + channel-playlists browsing with "page cap" | 🟡 | `:11479-11481` — `// 1 unit per page, capped: a channel with hundreds of playlists must not quietly turn one click into twenty calls.`<br>`for (let p = 0; p < 20; p++) {` | **The cap is 20 pages**, so one click *can* become twenty calls, contradicting both the comment and backlog #82 ("so one click cannot become twenty calls"). No `checkQuotaBudget()` before the loop. → **AUD-01** (P3, quota). |
| **#I1** custom playlist covers | ✅ | `:9884` — `var FEATURES = { playlistCovers: true };`<br>`:10001` — `async function uploadPlaylistCover(playlistId, file) {` | Feature flag is **on** by default. |
| **#B13** honest 403 mapping | ✅ | `:7465-7468` — `if (reason === 'accessNotConfigured' \|\| … ) { throw new Error(t('error_not_registered')); }`<br>`throw promptReconnect(new Error(t('error_session_expired')));` | Neighbouring line `:7473` `` `Erreur API (${errCode})` `` is hard-coded French → i18n, Pass 3. |
| **#B14** session lost after reload → offline state + reconnect prompt | ✅ | `:4872-4875` — `function applyOfflineCacheState() { const offline = !APP.accessToken; … classList.toggle('offline-cache', offline);`<br>`:5644` — `if (applyOfflineCacheState()) {` | |

## Table C — Lots 1–3, section "Production fixes" (PR #1)

| Fix | Status | Evidence | Note |
|---|---|---|---|
| v1.27.1 `videos:batchGetStats` colon form + fallback on network error | ✅ | `:11580` — `const data = await ytApi('videos:batchGetStats', {`<br>`:11553-11557` — `// A method the browser cannot reach at all fails the CORS preflight … counts as unavailable too` | |
| v1.27.2 Discover type switch no longer empties the view | ✅ | `:11731-11736` — each refinement is hidden by id, `discoverEmbeddable` by its own `label`, never by a shared parent | |
| v1.27.3 auto-categorize reads the details map | ✅ | `:13708-13709` — `const details = await getVideoDetails(videoIds); … for (const detail of Object.values(details)) {` | Silent-on-quota-exhaustion remains, already tracked as **#78**/#79. Hard-coded French progress label `:13693` is tracked as **#80**. |

---

## Table D — "Probably done" items the handoff asked to confirm

| Item | Status | Evidence | Note |
|---|---|---|---|
| **CR1 / #G1** XSS escaping | 🟡 (escaping ✅, delegation ❌) | `:14961` — `function escapeHtml(str) {` (escapes `& < > " '`)<br>`:14952` — `function escapeJsAttr(str) {` | #G1's fix list also said "replace inline onclick with event delegation". **263 `onclick="…"` and 322 inline `on*=` handlers remain.** The sink-by-sink XSS audit is Pass 2. |
| **#G12** CSP | 🟡 | `:10` — `script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com;`<br>`:7-9` — `'unsafe-inline' is required for now … needs the event-delegation refactor tracked in the backlog.` | #G12 asked to "forbid inline handlers"; `'unsafe-inline'` nullifies that part. **The "event-delegation refactor" the comment cites has no backlog entry** (not in v6.5 FR or EN). → **AUD-02** (tracking gap). |
| **CR3 / #G3** cache invalidated after writes | ✅ | `:7885-7886` — `// opts.force bypasses the cache after a write (reorder/merge/move). if (!opts?.force) {`<br>`:10779` — `loadPlaylistVideos(currentDetailPlaylistId, { force: true });`<br>`:12456-12457` — `delete APP.allVideos[destId]; … delete APP.allVideos[sourceId];` | Also: merge `:12232`, Discover-create `:12104`, trending-add `:8241`, delete playlist `:11018`, ghost/duplicate removal filters in place `:12517`, `:12570`. HTTP-cache flush `invalidateCacheForWrite()` `:5495`. |
| **CR2 / #G2** play a whole playlist | ✅ | `:8534-8537` — `// APP.allVideos holds raw playlistItems … videoId: v.contentDetails?.videoId \|\| v.snippet?.resourceId?.videoId,` | |
| **CR5 / #G5** GDPR purge of `userInfo` | 🟡 | `:6287` — `'oauthScope', 'lastLoginTimestamp', 'recentSearches', 'userInfo'` (Delete my data)<br>`:6312` — same list ends with `'userInfo'` (30-day auto-purge) | CR5 (userInfo) ✅. **#G5's second half ("appLang … ideally clear all app-owned keys") ❌**: the app writes 32 distinct localStorage keys, and 15 are in neither list: `appLang`, `quotaState`, `apiCalls`, `quotaResetDate`, `diagnosticLog`, `bookmarkedPlaylists`, `discoverFilters`, `reelMusicMode`, `playlistViewMode`, `libraryLens`, `showPlaylistViews`, `trendingCategory`, `readOnlyMode`, `writeScopeAtLogin`, `appNamedTheme`/`themeAccents` (the last two are purged by Delete but not by auto-purge). `diagnosticLog` and `bookmarkedPlaylists` hold user data. → **AUD-03** (P1 candidate, GDPR — Pass 2 confirms). |
| **#J1** content-type / music filter | ✅ | `:10356` — `function classifyVideoType(v) {`<br>`:1690` — `<select … id="filterType" … onchange="onFilterTypeChange()">` | |
| **#J2** one-click Mode Musique | ✅ | `:10649-10650` — `let musicMode = false; … localStorage.getItem('reelMusicMode') === '1'`<br>`:10657` — `function toggleMusicMode() {` | Scope is the detail view; "eventually deck/search" was optional. |
| **#J3** genre via `topicDetails` | 🟡 | `:7932` — `part: 'contentDetails,snippet,topicDetails,player',`<br>`:10390` — `if (gseg) genre = (GENRE_LABELS[gseg] \|\| gseg.replace(/_/g,' '));`<br>`:10555` — genre rendered as a card badge | "Confirm music" ✅. **"Auto-tag genre" ❌**: the genre is shown as a badge and never written into `playlistTags`. Backlog marks #J3 ✅, so either it's partial or the spec was narrowed (non vérifié without the Music-Filter-Design doc). |

### Music Mode scoring vs spec (the values from the handoff)

| Spec value | Code | Match |
|---|---|---|
| "- Topic" +0.9 | `:10220` `topicChannel: 0.9` | ✅ |
| categoryId 10 +0.7 | `:10221` `musicCategory: 0.7` | ✅ |
| Duration 2–7 min | `:10243` `if (seconds >= 120 && seconds <= 420) score += MUSIC_SIGNALS.trackLength;` (+0.2) | ✅ (weight ⚪ not in handoff) |
| "Artist - Title" pattern | `:10244` `if (hasArtistTitlePattern(v.title \|\| '')) score += MUSIC_SIGNALS.artistTitle;` (+0.2) | ✅ (weight ⚪) |
| Thresholds 80 % / 50–80 % | `:10227-10228` | ✅ |
| Permanent overrides | `:10197` `localStorage.getItem('playlistViewMode')` — persisted, and wins over detection `:10210` | ✅ (not purged: see AUD-03) |
| Per-video threshold 0.7, sample 50, long-form −0.5 | `:10224-10229` | ⚪ not in handoff; spec doc missing |

---

## New provisional IDs opened in this pass

| ID | Short | Proposed severity |
|---|---|---|
| AUD-01 | #82 channel-playlist browsing: cap of 20 pages contradicts "cannot become twenty calls", no quota pre-flight | P3 |
| AUD-02 | "Event-delegation refactor" cited by the CSP comment has no backlog entry; 263 inline `onclick` keep `'unsafe-inline'` necessary | P3 (security posture; re-rated in Pass 2) |
| AUD-03 | GDPR purge misses 15 of 32 app-owned localStorage keys (incl. `diagnosticLog`, `bookmarkedPlaylists`, `appLang` named by #G5) | P1 candidate |

Existing items confirmed still open: **#G6** (PKCE/state, ⏸ waiting on #75), **#78**, **#79**, **#80**.

## Tally

- Lots 1–3 (PR #1, 20 lines): **18 ✅, 1 🟡 (#82), 1 ❌ (#68 HEAD fallback, not feasible client-side)**.
- "Probably done" (8 lines): **4 ✅ (CR2, CR3, J1, J2), 4 🟡 (CR1/#G1, #G12, CR5/#G5, #J3)**.
