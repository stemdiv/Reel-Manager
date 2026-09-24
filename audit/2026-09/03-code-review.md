# Pass 3 — Code review (whole codebase, not a diff)

Base `origin/main` @ `9c824eb`, app **v1.27.3**. Read-only; no API call. The `engineering:code-review` skill is not installed, so I applied the handoff's checklist by hand. Every `:N` reference without a file name points to `youtube-playlist-manager.html`. Severity: P1 security / data loss / ToS · P2 functional or quota bug · P3 maintainability / performance · P4 cosmetic.

## Summary

| ID | Sev. | Area | Finding |
|---|---|---|---|
| AUD-13 | **P1** | ytApi / backup | Playlists over 1,000 items are silently truncated, and a failed later page returns a partial list. The truncated list is auto-saved and exported, which defeats the backup safety gate (#3). |
| AUD-28 | **P1** | YouTube ToS | Reel Studio: collapsing the player slides the video off-screen while audio keeps playing, and hidden-tab playback continues by design |
| AUD-14 | **P2** | Cache / bulk actions | Items rebuilt from the cache have **no playlistItem `id`**. Move copies again (the #G7 regression) and reorder, duplicate removal and ghost removal fail, until a manual full refresh. |
| AUD-15 | **P2** | Quota | `estimateQuotaCost()` has no entry for 6 action keys that callers use, so it falls back to `count` (1 unit). A caption upload is pre-flighted at 1 unit instead of 400, and `videos.insert` is checked against the pool instead of the upload bucket. |
| AUD-16 | **P2** | Bulk actions | `performMove()` aborts on the first failed insert without evicting caches or reporting how many items already moved |
| AUD-17 | P2 (« non vérifié ») | HTTP cache | Responses are cached only when the `ETag` **response header** is readable. Under CORS it may not be exposed, which would make the whole TTL cache inert. |
| AUD-18 | P3 | ytApi | `If-Match` is dead code: `cached` is always `null` for PUT/DELETE |
| AUD-19 | P3 | ytApi | POST is retried on 5xx and network errors, so `playlists.insert` / `playlistItems.insert` can duplicate (accepted in a comment, unmitigated) |
| AUD-20 | P3 | ytApi | 403 `rateLimitExceeded` / `userRateLimitExceeded` is shown as "session expired" with a reconnect prompt |
| AUD-21 | P3 | Quota | Charging rules differ: `ytApi` charges before the request (failures included), direct uploads only on success, and uploads skip the Pacific reset check |
| AUD-22 | P3 | Quota | Hard-coded copies of limits and costs: pre-#76 help card, "/ 10,000" diagnostic with 500/100 colour thresholds, restore at `50` literals with no bucket pre-flight |
| AUD-23 | P3 | Merge | Unloaded playlists contribute 0 videos silently, cross-source duplicates are inserted twice, and the estimate is off (counts a DELETE that never happens, omits `playlists.insert`) |
| AUD-24 | P3 | Ghosts #G8/#G9 | Classification relies on thumbnail presence, which the cache may lack. The scan and bulk clean include **bookmarked, non-owned** playlists (403s, quota charged). No live re-check before bulk delete. |
| AUD-25 | P3 | Music | Two independent music classifiers that can disagree: `classifyVideoType()` (#J1/#J2) and `musicScore()` (#17) |
| AUD-26 | P4 | Shorts #68 | `h > w` misses square Shorts |
| AUD-27 | P3 | i18n | ≥ 40 visible strings bypass `t()` beyond #80; CSV status labels are French-only; 45 FR values are identical to EN, several untranslated |
| AUD-29 | P4 | Player | The `#miniPlayer` bar is dead UI: it's only ever deactivated |
| AUD-30 | P3 | Service worker | Cross-origin font CSS in the pre-cache can fail install, and is never served anyway; offline navigation ignores `?bookmark=`; `CACHE_NAME` bumped by hand |
| AUD-31 | P4 | Cache | #81 trending: the comment promises a longer TTL that doesn't exist |
| AUD-01 | P3 | Quota | (Pass 0) #82 channel-playlist browsing up to 20 calls, no pre-flight |
| #78, #80 | — | — | Existing items reconfirmed (auto-categorize quota guard; classification strings) |

---

## 1. `ytApi`

### AUD-13 — silent truncation at 1,000 items, partial lists on error (P1)
- `:7517` `async function fetchAllPages(endpoint, params = {}, itemsKey = 'items', maxPages = 20) {`
- `:7900` `videos = await fetchAllPages('playlistItems', params);`: no `maxPages` override.
- `:7548` `` console.warn(`[fetchAllPages] Hit page cap (${maxPages}) … `` is the only signal, and it goes to the console.
- `:7541-7544` `if (pageCount === 0) throw err; console.error(...); break;`: a failure on page 2+ returns the pages already fetched as if complete.

YouTube playlists hold up to 5,000 items. The truncated array becomes `APP.allVideos[id]` and flows into `autoSaveCache` (`:7712`), manual backup (`:14445`), CSV export, merge, move, duplicates, ghosts and the Watch plan. `shouldSkipAutoSave()` (`:7674`) only guards against the empty case. A user whose playlists are big trusts a backup that's missing everything past item 1,000. That backup is the safety gate for destructive actions (backlog #3). **Fix:** pass `maxPages: 100` (5,000 / 50) for `playlistItems`, return `{ items, complete }` from `fetchAllPages`, refuse to overwrite the cache with an incomplete list, and flag partial playlists in the UI. **Effort** M.

### AUD-17 — cache depends on a CORS-exposed `ETag` header (P2, « non vérifié »)
- `:7492-7494` `const etag = res.headers.get('ETag'); if (etag) { … cacheSet(cacheKey, {` ; nothing is cached otherwise.

In a cross-origin `fetch`, only CORS-safelisted headers are readable unless the server lists others in `Access-Control-Expose-Headers`. I did not verify whether `www.googleapis.com` exposes `ETag`. If it doesn't, the fresh-hit path (`:7343`) never triggers and every TTL in `API_CACHE_CONFIG` is inert. That would silently cost quota everywhere, including the aggressive 5-min `search.GET` TTL (#76). **Check:** one read in DevTools; `API_CACHE.size` stays 0. **Fix:** fall back to `responseBody.etag`, which the YouTube API always returns in the body, and cache even without an etag when TTL > 0. **Effort** S.

### AUD-18 — `If-Match` never sent (P3)
- `:7340` `const cached = method === 'GET' ? cacheGet(cacheKey) : null;`
- `:7371` `if ((method === 'PUT' || method === 'DELETE') && cached?.etag) {`: unreachable. Even if it weren't, the key is the write URL, not the resource's GET URL.

The 412 branch (`:7419-7422`) is dead too. **Fix:** remove it, or look up the resource's cached etag by id. **Effort** S.

### AUD-19 — non-idempotent retries (P3)
`:7387-7391` comment: `// Idempotency caveat: POST/PUT/DELETE retries could theoretically duplicate … Accepted risk`. Network errors (`:7396-7407`) and 5xx (`:7425-7446`) retry any method. A lost response on `playlists.insert` creates two playlists, which "clean ghosts" does not clean. **Fix:** don't retry POST on network error or 5xx. Instead re-list and check whether the item exists. **Effort** S.

### AUD-20 — rate-limit 403 reported as expired session (P3)
`:7454-7468`: every 403 that isn't `quotaExceeded`/`accessNotConfigured` ends in `throw promptReconnect(new Error(t('error_session_expired')));`. The YouTube API returns **403** with reason `rateLimitExceeded` / `userRateLimitExceeded`, which are retryable, so the user is told to reconnect instead of waiting. **Fix:** treat those reasons like 429. **Effort** S.

### Correct
- 429 with `Retry-After` capped at 60 s and full-jitter backoff (`:5393-5421`, `:7428-7432`).
- Quota charged once per logical call, not per retry (`:7379-7383`).
- LRU with a 500-entry and 250 KB cap (`:5434-5490`).
- Write invalidation with cross-resource flush `playlistItems → playlists`, `subscriptions → channels` (`:5495-5518`).
- `fetchAllPages` propagates a first-page error (fixes the v1.11.0 empty-library bug).

## 2. Quota (#76)

**Model conformance ✅.** `QUOTA_BUCKETS` / `QUOTA_LIMITS` (`:5232-5239`) match #76 (pool 10,000 units; search 100 calls; upload 100 calls) plus the `stats` bucket for `batchGetStats` (#83). `normalizeEndpoint()` (`:5253-5259`) handles `videos/rate` and `videos:batchGetStats`. The Pacific reset uses `Intl` with `America/Los_Angeles` (`:5291-5301`). Migration: `readQuotaState()` moves legacy `quotaUnits` into `pool` exactly once and deletes the key even on a stale day (`:5362-5366`, `:5378`). Discover's search pre-flight uses the search bucket and refuses outright when it's empty (`:11788-11795`).

### AUD-15 — pre-flight keys missing, wrong bucket for uploads (P2)
`:6185` `return costs[action] || count;`. The table (`:6171-6184`) has no entry for these keys, which callers use:

| Caller | Key passed | Real cost | Estimated |
|---|---|---|---|
| `:9132` video update | `video_update` | 50 | 1 |
| `:9177` thumbnail | `thumbnail_set` | 50 | 1 |
| `:9254` caption upload | `caption_insert` (table has `caption_upload`) | **400** | 1 |
| `:9319` channel update | `channel_update` | 50 | 1 |
| `:9350` video upload | `video_insert`, bucket defaults to **pool** | 1 call, **upload** bucket | 1 unit of pool |
| `:10761` reorder | `reorder_video` | 50 | 1 |

With the pool at 9,990, a caption upload passes the pre-flight silently and overshoots by 390. With the upload bucket at 100/100, the video upload pre-flight still passes because it looks at the pool. **Fix:** add the keys, align `caption_insert`, pass `'upload'` at `:9350`, and make an unknown key throw in development. **Effort** S.

### AUD-21 — inconsistent charging rules (P3)
`ytApi` charges **before** `fetch` (`:7380`), so failures and network errors count too. Direct uploads charge **after** success (`:9201`, `:9275`, `:9410`, `:10027`) and never call `checkQuotaDailyReset()` (only `ytApi` does, `:7379`). The first upload of a new Pacific day is therefore added to yesterday's counters and wiped by the next `ytApi` call. CR4 asked to "count only on HTTP success". The code comment argues the opposite (Google bills invalid requests). Pick one rule and apply it everywhere. **Effort** S.

### AUD-22 — hard-coded limit and cost copies (P3)
- `:2612` Help card, English only and pre-#76: `YouTube API is limited to <strong …>10,000 units/day</strong>. Reads cost 1 unit, writes cost 50.`
- `:6509` diagnostic: `` ${quota} / 10,000 units `` with thresholds `quota > 500 ? red : quota > 100 ? yellow`, so 5 % of the pool shows red.
- `:14722-14723` and `:14762`: restore cost `selected.length * 50 + totalVideos * 50`, a literal 50, not `YT_QUOTA_COSTS`. `executeRestore()` does **not** call `checkQuotaBudget()`; it only asks `confirm()` (`:14768`).

**Fix:** derive everything from `QUOTA_LIMITS` / `YT_QUOTA_COSTS` and route restore through `checkQuotaBudget`. **Effort** S.

Also unguarded, low cost, P4: `videos.rate` (`:8644`, 50), `subscriptions.insert` (`:14202`, 50; its `subscribe` estimate at `:6178` is never used by a caller), `captions.list` (`:9218`, **50** units per read), single-item duplicate removal (`:12568`), single ghost removal (`:12514`).

## 3. Bulk actions

### AUD-14 — cache-rebuilt items lack `playlistItem.id` (P2, #G7 regression in practice)
- Serialization drops the item id. Auto-cache `:7712-7725`: `return { videoId, title: …, position: …, thumbnail: …, … addedAt: … };`. Manual backup `:14445-14456`: same fields.
- Rebuild `:5948-5963`: `APP.allVideos[pl.id] = pl.videos.map(v => ({ contentDetails: { videoId: …, duration: … }, snippet: { … } }))`, no `id`.
- Cache-first start never refetches (`:7579-7582` "Cache-first: if backup exists … skip API calls"), and `loadPlaylistVideos()` returns any non-empty cached array (`:7886-7889`).

Consequences in a normal session that started from cache (the default since #F2):
- **Move** (`:12426-12450`): the insert succeeds, then `if (!sourceItem?.id) { stuck.push(videoId); continue; }`. Every item is copied and not removed, reported as "stuck". This is #G7's original bug, with a warning this time.
- **Reorder** (`:10749-10756`): `dataset.itemId` is empty, so it fails with `'Missing item data'`.
- **Duplicate / ghost removal** (`:12514`, `:12568`): `ytApi('playlistItems', { id: undefined }, 'DELETE')` fails, **and is charged 50 units** first (AUD-21).

It works again only after "Dashboard full refresh" (`:7644`) or a write that evicts that playlist. The regression suite probably seeds API-shaped items; verified in Pass 5. **Fix:** persist `itemId` in both serializers and rebuild it as `id`. If it's missing, force-load the playlist before any item-level write. **Effort** S.

### AUD-16 — move aborts mid-way without cleanup (P2)
In `performMove()` the insert (`:12434`) is not in a per-item `try`. The first failure (quota, 409, network) jumps to the outer `catch` (`:12466`), which only toasts. `delete APP.allVideos[destId/sourceId]` (`:12456-12457`) and `loadAllPlaylists()` are skipped, so both views show stale content and the user doesn't learn how many items moved. **Fix:** per-item try/catch as in `performMerge`, with eviction in `finally`. **Effort** S.

### AUD-23 — merge edge cases (P3)
- `:12214` `const videos = APP.allVideos[sourceId] || [];`: a selected playlist never loaded (typically a bookmark) contributes 0. The UI does show `(0 vidéos)` (`:12145`), but doesn't load it.
- There's no de-duplication across sources.
- Estimate `:6173` `'merge': count * INSERT + DELETE, // … + 1 delete of source playlist`: no playlist is deleted, and the 50 for `playlists.insert` when creating a destination (`:12198`) is missing.

**Effort** S.

### AUD-24 — ghosts (#G8/#G9) (P3)
- `:9793-9796` `const hasThumb = …; const hasVideoDate = !!item?.contentDetails?.videoPublishedAt; if (hasThumb || hasVideoDate) return 'available';`. Cache-rebuilt items never have `videoPublishedAt` or `status` (`:5948-5963`), so "private" vs "deleted" is lost after a reload, and any cached item saved without a thumbnail becomes a "ghost". Deletion is currently blocked by AUD-14 (no id). Fixing AUD-14 alone would make those false positives deletable, so the two must ship together, with a live `videos.list` re-check of candidates before bulk delete.
- `:12487`, `:12537`: both loops cover `Object.entries(APP.allVideos)`, **bookmarked playlists included**. The user can't delete items from someone else's playlist: each attempt returns 403 and is pre-charged 50 units.

#G9's O(n²) is fixed: silent mode, one rescan (`:12547-12551`) ✅. #G7 is fixed at API level (`:12447` DELETE after insert) ✅, but see AUD-14.

## 4. Music Mode vs spec (see Pass 0 Table D)
Scoring and thresholds match the handoff's figures (`:10219-10228`).

### AUD-25 — two classifiers (P3)
`classifyVideoType()` (`:10356-10392`) drives the #J1 filter and the #J2 "Mode Musique" toggle. It is keyword/topic/category based and ignores "- Topic" channels and duration. `musicScore()` (`:10236-10246`) drives the #17 Music view and the playlist verdict. The same video can be music in one and not the other, e.g. a "- Topic" upload with no `categoryId` and no topic details. **Fix:** make `classifyVideoType` consume `musicScore` plus its own exclusion list. **Effort** M.

## 5. Shorts (#68)
✅ The heuristic `h > w && d <= 180` (`:10114-10121`), `maxHeight: 8192` (`:7934`) and system playlists `UUSH`/`UULF` (`:10137`) all match the backlog.
- **AUD-26** (P4): square Shorts (`h === w`) are classified as standard.
- HEAD fallback: not shipped and not feasible from the browser (Pass 0).
- `_isShort` survives the cache (`:7721`, `:5974`) ✅.

## 6. i18n — AUD-27 (P3)
**Parity ✅**, from a script that `eval`s `I18N` in Node:
- 688 FR keys and 688 EN keys, 0 missing on either side, 0 interpolation-parameter mismatches.
- Of 608 keys referenced statically, 1 is "missing" (`discover_sort_label_`, a dynamic prefix, false positive). 81 keys have no static reference; they may be dynamic, « non vérifié ».

**Strings outside `t()`**, beyond the eight listed in #80:
- Errors: `:7321` `'Accès en écriture requis — …'`, `:7421` `'Cette ressource a été modifiée ailleurs …'`, `:7445` `` `Server error (${res.status}) …` ``, `:7473` `` `Erreur API (${errCode})` ``, `:7509`, `:7406`, `:9387`, `:9403`, `:9405`, `:12084`, `:10756` `'Missing item data'`.
- Toasts: `:7601` `'Upgrading cache format — …'`, `:7769` `` `Cache FAILED: …` ``.
- Action names shown in `confirm()` via `checkBackupSafety`/`checkQuotaBudget`: FR `:10952`, `:10960`, `:11004`, `:11007`, `:12173`, `:12190`, `:12411`, `:12420`, `:12533`, `:12543`, `:14379`, `:14387`; EN `:9131`, `:9132`, `:9176`, `:9177`, `:9253`, `:9254`, `:9287`, `:9318`, `:9319`, `:9349`, `:9350`.
- Templates: `:8027` `items`, `:8029` `largest:`, `:12145` `vidéos`, `:12617` `'Unknown'`, `:12638` `Apparaît dans … playlists`, `:12702` `'Sans catégorie'`, `:12199` `'Merged playlist'`, `:14306`, `:14313` `vidéos`, `:15011`, `:9398` `Mo`, help card `:2612`.
- CSV status `'Supprimée' / 'Privée' / 'Disponible'` (`:14531`, `:15116`). Restore matches `'Supprim'` or `'Deleted'`, so the labels can't simply be translated without keeping that parser tolerant.

**Untranslated FR values** (45 identical to EN): mostly legitimate loanwords (Dashboard, Deck, Playlists), but e.g. `studio_upload_video: 'Upload video'`, `header_backup_tooltip: 'Backup'`, `beta_title: 'Feature Lab'`, `detail_duration_long: 'Long (> 20 min)'`.

**Effort** M.

## 7. YouTube ToS compliance

| Rule | App (`youtube-playlist-manager.html`) | Reel Studio |
|---|---|---|
| Player visible while playing (no audio-only) | ✅ `minimizePlayer()` docks, doesn't hide: `:8811-8813` "dock, do not hide … the embed must stay on screen", `.docked … padding-bottom: 180px` (`:440`) | ❌ **AUD-28**, see below |
| Pause when the page is hidden (#B12) | ✅ `:8427-8428` | ❌ by design: `reel-studio.html:1538-1540` pauses on `hidden` **only if** an external YouTube tab is alive |
| Attribution | ✅ "Powered by YouTube Data API v3" (`:1369`, `:1578`) | « non vérifié » (no string found by grep) |
| IFrame API params | `enablejsapi: 1, origin` (`:8437-8438`) ✅; `modestbranding` is deprecated (P4) | `origin: location.origin` (`reel-studio.html:1600`) ✅ |
| Data deletion / privacy | 🟡 AUD-03 | Studio keys not purged (AUD-03) |

### AUD-28 — Reel Studio plays audio with the video hidden (P1, ToS)
- `reel-studio.html:255` `.player-sheet { … transform: translate(-50%, 110%); … }`, and `:258` `.player-sheet.open { transform: translate(-50%, 0); }`: the collapsed sheet, which contains the iframe (`:489` `<div class="sheet-video"><div id="ytHost"></div></div>`), is moved fully off-screen.
- `reel-studio.html:1683` `const collapsePlayer = () => document.getElementById('playerSheet').classList.remove('open');`: playback isn't paused. A bottom `player-bar` with thumbnail, prev/play/next stays (`:505-514`), which gives audio-only listening with transport controls.
- `reel-studio.html:1538-1541`: a backgrounded tab keeps playing unless a YouTube tab opened from Studio exists. Backlog #B12 records this as intended ("it is a music UI, listening in the back…").

The YouTube API Services policies require the embedded player to be visible and forbid separating audio from video and background play. The exact clause numbers were not checked against the current policy text (« non vérifié »), but the backlog's own #17 row says "no audio-only — ToS". **Fix:** dock the sheet at ≥ 200×200 when collapsed, as the main app does, or pause on collapse. Pause on `visibilitychange` in Studio too. **Effort** S.

### AUD-29 — dead mini-player (P4)
`#miniPlayer` (`:2745-2757`) is only ever `classList.remove('active')`'d (`:8806`, `:8816`, `:8834`); nothing adds `active`. It's dead markup and CSS left over from before docking (`:506-535`, `:571-580`).

## 8. Service worker — AUD-30 (P3)
- ✅ HTML is network-first (`sw.js:44-57`), so a new release is served on the next online load. Since the app's CSS and JS are **inline**, the stale CSS/JS risk the handoff raised doesn't apply to the main app.
- `sw.js:12` pre-caches `https://fonts.googleapis.com/css2?...` via `cache.addAll` (`:19`). If that request fails at install (offline, blocked, CSP of the SW context), **the whole install fails**. The fetch handler also returns early for any `googleapis.com` host (`:39-43`), so the cached copy is never served.
- `sw.js:56` `.catch(() => caches.match(event.request))`: no `ignoreSearch`, so an offline `?bookmark=…` or `reel-studio.html?v=…` navigation finds no cached page. The app deliberately version-stamps Studio links (`:6773-6777`), and each version becomes a new cache entry.
- `sw.js:6` `CACHE_NAME = 'reel-manager-v32'` is bumped by hand, unrelated to `APP_VERSION` (`:4414`).

**Fix:** drop the cross-origin pre-cache entry, use `ignoreSearch: true` for navigations, and derive `CACHE_NAME` from the release. **Effort** S.

### AUD-31 (P4)
`:5456-5458` comment "The trending chart is refreshed by YouTube far less often than hourly; re-fetching it on every dashboard visit would spend units" is not followed by a TTL entry, so `chart=mostPopular` uses the generic `videos.GET` 5-min TTL (and none at all if AUD-17 holds).
