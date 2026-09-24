# Pass 5 — Testing strategy

Base `origin/main` @ `9c824eb`, app **v1.27.3**. The `engineering:testing-strategy` skill is not installed, so I applied the handoff's checklist by hand. No test was written, as instructed. `tests.html` was **run locally** (details in §1).

## 1. Current suite: recount and local run

**Recount.** The handoff says "54 cases on 16 September". That figure is outdated. PR [stemdiv/Reel-Manager#1](https://github.com/stemdiv/Reel-Manager/pull/1) already reported 281, and the recount confirms it:
- **28 suites / 281 cases**, from the `SUITES` array in `tests.html:418`.
- The runner is at `tests.html:2983`. It loads `youtube-playlist-manager.html` in a same-origin iframe (`tests.html:66`) and calls the app's globals as `w.<fn>`.

**Local run, 24 Sept 2026, on this branch:**
- Server: `python3 -m http.server 8099 --bind 127.0.0.1` from the repo root, as in `.claude/launch.json`.
- Browser: headless Chromium via Playwright 1.56.1. **Every request to a host other than 127.0.0.1 was aborted**, so no quota or OAuth traffic was possible.
- Driver: a throwaway script in the scratchpad that waits for "ready", clicks `#run` and reads `#summary` plus every `.case.fail` row.

```
"summary": "281 passed · 0 failed",  "total": 281,  "groups": 28,  "fails": [],
"blockedCount": 4,  "blockedHosts": ["fonts.googleapis.com"],  "pageErrors": []
```

The only outbound attempts were 4 font stylesheet requests. No `googleapis.com/youtube`, `oauth2` or `accounts.google.com` request was made, so the suite's stubs hold.

**Cases per suite:**

| Suite | Cases | Suite | Cases |
|---|---|---|---|
| #tags-auto | 5 | #B13 #B14 | 13 |
| #76 auto-cache | 10 | #68 Shorts | 14 |
| #G8 ghosts | 14 | #I3 like | 9 |
| #G9 bulk ghosts | 3 | batchGetStats | 14 |
| #G18 merge by id | 6 | #I2 subscribe | 10 |
| #G7 move | 6 | #G14 popup | 12 |
| #G10 CSV | 20 | #G11 IndexedDB | 11 |
| #G13 hash | 3 | #17 music | 23 |
| #G15 parseDuration | 9 | #17 #18 p2 | 14 |
| #G16 | 1 | #81 trending | 11 |
| #G17 | 1 | #82 discover entities | 16 |
| #G19 | 2 | #I1 covers | 14 |
| #76b buckets | 13 | #73 Discover filters | 11 |
| videoCategories | 6 | thumbnails | 9 |

(A static `awk` count finds 280 because one case is declared on a line with a different shape; the runtime count is authoritative.)

**Strengths.**
- Regression cases go down to real `fetch` or DOM where it matters (#B13/#B14, batchGetStats).
- Storage is snapshotted and restored, IndexedDB included (`tests.html:83-117`).
- The security boundary of #G14 is tested (12 cases on `isValidOAuthMessage`).

## 2. Coverage map of critical behaviours

A static reference count of each function name in `tests.html` (0 = never named) is a proxy, not line coverage. There is no coverage tool, « non vérifié ».

| Area | Covered | **Not covered (0 references)** |
|---|---|---|
| Quota | `getQuotaCost` (22), `chargeQuota` (5), `checkQuotaBudget` (4), `loadQuotaState` (3), `checkQuotaDailyReset` (2), `estimateQuotaCost` (2: only `subscribe`, `tests.html:1795`) | `readQuotaState` edge cases; `estimateQuotaCost` for the 6 missing keys (AUD-15); upload bucket pre-flight; restore cost |
| `ytApi` transport | 403/401 mapping, no-token gate (#B13/#B14), batchGetStats fallback | `fetchAllPages` (page cap, partial page, AUD-13); `computeBackoffDelay`, `parseRetryAfter`, `isRetryableStatus`; 429/5xx retry loop; `cacheGet`/`cacheSet` LRU; `invalidateCacheForWrite`; ETag caching (AUD-17) |
| Writes | `performMove` (3), `performMerge` (3), `removeGhostVideo` (3) with API-shaped items | **Items rebuilt from cache (no `id`) → AUD-14 is invisible**: the move fixture seeds `{ id: 'ITEM_A', … }` (`tests.html:198`). `cleanAllGhosts` bookmark exclusion; `removeDuplicateFromPlaylist`; `onVideoDrop` reorder; `executeRestore`; move abort mid-way (AUD-16) |
| State migration | `quotaUnits` → buckets (`tests.html:170-171`), legacy `autoCache` → IDB (#G11), `shouldSkipAutoSave` (9) | `loadBackupFromStorage` (0); old-format cache without thumbnails; `reelMusicMode` stale key (AUD-32) |
| Backup import/export | CSV guard via `csvRow` (20), `csvUnescapeCell` (7) | `createBackup` (0), `parseJSONForRestore` (0), `parseCSVForRestore`/`parseCSVLine` (0), `importBackupFromLoginScreen` (0), schema rejection (AUD-06), `__proto__` titles (AUD-12), round-trip JSON export → import |
| URL parsing | — | `extractPlaylistId` (0), `?bookmark=` deep link (0), `addBookmark` (0) |
| Music scoring | `parseArtistTitle` (10), `playlistMusicVerdict` (6), `musicScore` (3), `classifyVideoType` (1) | Threshold boundaries (0.7 / 0.8 / 0.5 exactly), long-form penalty, agreement between the two classifiers (AUD-25) |
| Security | `isValidOAuthMessage` (11), `checkAuth` hash cleanup (2) | `escapeHtml`/`escapeJsAttr` (0); sink-level XSS (AUD-04/05); `_logRedact` (0); `deleteAllUserData`/`checkAutoPurge` key coverage (0, AUD-03); token-in-hash timing in `init()` (#G13 reopen) |
| ToS / player | docked player (#17 p2), #B12 « non vérifié » | Reel Studio has **no test harness at all** (AUD-28) |

## 3. Cases to add (name · input · expected), not written

Priority follows the handoff: quota, writes, state migration, backup import/export, URL parsing, music scoring. Then security, then the regressions opened by this audit. Each row is written so it can be pasted as a `tests.html` case with a stubbed `ytApi`/`fetch`.

### 3.1 Quota
| # | Name | Input | Expected |
|---|---|---|---|
| Q1 | every pre-flight key has a cost | each `action` string passed to `checkQuotaBudget(...)` in the app (`video_update`, `thumbnail_set`, `caption_insert`, `channel_update`, `video_insert`, `reorder_video`, `cover_set`, …) | `estimateQuotaCost(key, 1)` ≠ 1 fallback; equals the `YT_QUOTA_COSTS` entry (50 / 400 / 1) |
| Q2 | video upload pre-flights the upload bucket | `APP.quota = { pool: 0, search: 0, upload: 100, stats: 0 }`, call the upload path with `confirm` stubbed to record | `confirm` called with the `confirm_quota_exceed` text; no `fetch` |
| Q3 | caption upload near pool limit is caught | `pool: 9_990`, `caption_insert` pre-flight | `checkQuotaBudget` asks, cost 400, remaining 10 |
| Q4 | restore uses the pre-flight | 2 playlists × 3 videos, `pool: 9_900` | `checkQuotaBudget` called with cost 400; no literal `50` path |
| Q5 | legacy key and fresh state both present | `quotaUnits='500'`, `quotaState='{"pool":10}'`, same Pacific day | `APP.quota.pool === 10`; `quotaUnits` removed |
| Q6 | corrupt `quotaState` | `quotaState='{not json'` | all buckets 0, no throw |
| Q7 | Pacific boundary | fake `Date` at 2026-09-24T06:59:59Z vs 07:00:01Z (PDT) | `getPacificDateString()` returns `2026-09-23` then `2026-09-24`; the reset clears all 4 buckets |
| Q8 | first call of the day is an upload | stale `quotaResetDate`, then `chargeQuota('videos','POST')` via the upload path | the reset happens before charging (upload = 1, pool = 0) |
| Q9 | charging rule is uniform | `ytApi` with `fetch` rejecting (network) and an upload with `res.ok=false` | both charge, or neither, per the chosen rule (AUD-21) |

### 3.2 `ytApi` transport and cache
| # | Name | Input | Expected |
|---|---|---|---|
| T1 | `fetchAllPages` fetches beyond 20 pages for playlistItems | stub returning `nextPageToken` for 60 pages of 50 | 3,000 items returned; `complete: true` |
| T2 | partial pagination is reported | page 3 throws | the result is flagged incomplete, and auto-save refuses to overwrite a fuller cache |
| T3 | 429 honours `Retry-After` with a cap | first response 429 `Retry-After: 120`, then 200 | one retry after a delay of 60,000 ms (sleep stubbed), quota charged once |
| T4 | 5xx backoff bounded | 3× 503 then 200 | 4 fetches; delays ≤ 1,000/2,000/4,000 (jitter upper bound) |
| T5 | POST is not blindly retried | `playlists` POST → 503 then 200 | a single POST, or a pre-retry existence check (AUD-19) |
| T6 | 403 rateLimitExceeded is retryable | body `errors[0].reason='rateLimitExceeded'` | retried like 429; no reconnect toast (AUD-20) |
| T7 | cache works without an ETag header | 200 with body `{etag:'x', items:[…]}`, no `ETag` header | the second identical GET within the TTL makes no `fetch` (AUD-17) |
| T8 | LRU eviction | 501 distinct cacheable GETs | `API_CACHE.size === 500`, the oldest key evicted |
| T9 | write invalidation | cached `playlists?…` and `playlistItems?playlistId=P`, then POST `playlistItems` for P | both entries flushed; an unrelated `videos?id=Z` kept |

### 3.3 Writes and bulk actions
| # | Name | Input | Expected |
|---|---|---|---|
| W1 | **move after a cache-first start** | seed via `loadBackupFromStorage()` from `SAMPLE_CACHE()` (no item ids), then `performMove` | POST + DELETE issued (item id recovered or playlist force-loaded); nothing reported "stuck" (AUD-14) |
| W2 | reorder after a cache-first start | same seeding, `onVideoDrop` | `playlistItems` PUT with a real id, not `'Missing item data'` |
| W3 | move aborts cleanly | the 2nd of 3 inserts throws | the 1st is fully moved; caches of source and dest evicted; toast reports 1 moved / 2 not (AUD-16) |
| W4 | ghost bulk skips bookmarks | `APP.allVideos` holds a ghost in an owned playlist and one in a bookmarked one | exactly 1 DELETE; estimate = 50 (AUD-24) |
| W5 | ghost re-check before delete | a candidate is available per a live `videos.list` stub | not deleted |
| W6 | duplicate removal | 2 instances across playlists | 1 DELETE with the right item id; cache updated |
| W7 | merge loads unloaded sources | a source with `APP.allVideos[id] === undefined` | `loadPlaylistVideos(id)` called before inserting (AUD-23) |
| W8 | merge de-duplicates | the same videoId in 2 sources | 1 insert |
| W9 | read-only mode blocks every write path | `readOnlyMode=true`, call move/merge/restore/upload | 0 `fetch`; localized error |

### 3.4 State migration and startup
| # | Name | Input | Expected |
|---|---|---|---|
| M1 | cache round-trip preserves item ids | `autoSaveCache()` then `loadBackupFromStorage()` | each `APP.allVideos[pl][i].id` equals the original playlistItem id |
| M2 | cache round-trip preserves ghost state | a private item (`status.privacyStatus='private'`, no thumbs) | still `ghostStatus === 'private'` after reload |
| M3 | old cache without thumbnails, with a token | `SAMPLE_CACHE` minus thumbnails, token set | a full refresh is triggered once |
| M4 | stale `reelMusicMode` | `reelMusicMode='1'` in storage, `resetVideoFilters()` | `filterType.value === 'all'`; key removed (AUD-32) |
| M5 | IDB unavailable | `indexedDB.open` throws | the localStorage fallback is used, app boots, `cacheStore` reports the backend |

### 3.5 Backup import / export
| # | Name | Input | Expected |
|---|---|---|---|
| B1 | JSON export → import round-trip | `createBackup()` output fed to `parseJSONForRestore()` | same playlists, titles, videoIds, tags, folders |
| B2 | schema rejects hostile fields | `playlistObjects[0].id = "x');alert(1);//"`, `folders[0].name = '<img src=x onerror=…>'` | import refused, or values sanitised; nothing rendered unescaped (AUD-06) |
| B3 | `__proto__` title in CSV | CSV row with playlist `__proto__` | parsed as a normal playlist (Map-based); no throw (AUD-12) |
| B4 | quoted newline in CSV | a title cell `"line1\nline2"` | one video, title with a newline |
| B5 | CSV formula guard round-trip with import | titles `=A1`, `'Round Midnight` | exported cell `'=A1`; re-import yields `=A1` and `'Round Midnight` unchanged |
| B6 | status labels survive a language switch | export in EN then restore | deleted rows still skipped (`'Deleted'` and `'Supprimée'`) |
| B7 | login-screen import refuses non-JSON / empty | `.csv` file; `{playlists:[]}` | `toast_import_invalid`; storage untouched |

### 3.6 URL parsing
| # | Name | Input | Expected |
|---|---|---|---|
| U1 | raw ids | `PLabcdefghij`, `LLxxxxxxxxxx`, `RDxxxxxxxxxx` | returned as is |
| U2 | full URLs | `https://www.youtube.com/playlist?list=PL…`, `https://youtu.be/xyz?list=PL…&t=3`, `https://music.youtube.com/playlist?list=OLAK5…` | the id |
| U3 | rejects junk | `PL`, `javascript:alert(1)`, `list=<script>`, `https://evil/?list=PL"onx=` | `null` |
| U4 | deep link opens the modal only | `?bookmark=PLabc…` on boot | `showAddBookmarkModal` called, no `ytApi` until confirm |
| U5 | deep link prefill is inert | `?bookmark="><img src=x onerror=alert(1)>` | the input value equals the raw string; no element injected |

### 3.7 Music scoring
| # | Name | Input | Expected |
|---|---|---|---|
| S1 | per-video threshold boundary | categoryId `'10'` only, 30 s | score 0.7 → music (≥) |
| S2 | long-form penalty | "X - Topic", 25 min | 0.9 − 0.5 = 0.4 → not music |
| S3 | track-length bounds | 119 s / 120 s / 420 s / 421 s with only the artist-title pattern | 0.2 / 0.4 / 0.4 / 0.2 |
| S4 | playlist verdict boundaries | 40/50 music → 0.8; 25/50 → 0.5; 24/50 | `music` / `mixed` / `video` |
| S5 | override beats detection | verdict `music`, override `video` | `effectiveViewMode === 'video'` |
| S6 | classifiers agree | a "- Topic" video with no categoryId or topics | `classifyVideoType().isMusic === isMusicVideo()` (AUD-25) |

### 3.8 Security and privacy
| # | Name | Input | Expected |
|---|---|---|---|
| X1 | `escapeJsAttr` breaks no string | `a\'b`, `a\\`, `"x"`, newline | the handler string evaluates back to the input |
| X2 | Discover card handlers | a result title `x\');window.__pwn=1;//` rendered, then the card clicked | `window.__pwn` undefined; `playVideo` receives the exact title (AUD-04) |
| X3 | dashboard legend attribute | a playlist title `a" onmouseover="window.__pwn=1` | the attribute value equals the title; no extra attribute (AUD-05) |
| X4 | Reel Studio tag handler | tag `a';window.__pwn=1;'` | no execution (AUD-07); needs a Studio harness |
| X5 | delete-my-data clears every app key | set all 34 known keys (32 app + 2 Studio) + an IDB record, run `deleteAllUserData` with `confirm` stubbed | `localStorage` holds no app key; IDB empty (AUD-03) |
| X6 | auto-purge matches delete-my-data | `lastLoginTimestamp` 31 days ago | the same key set cleared |
| X7 | `_logRedact` catches embedded tokens | `{ source: 'https://x/#access_token=ya29.abc&x=1' }`, `msg` containing `Bearer ya29.x` | both redacted |
| X8 | hash cleared before any await | spy on `history.replaceState` and on `cacheStore.migrateLegacy` | `replaceState` runs first (#G13) |
| X9 | `state` round-trip (when #G6 ships) | a hash without, or with the wrong, `state` | token rejected |

## 4. Structural recommendations

1. **Make fixtures come from the app's own writers.** The #G7 suite builds items by hand in API shape (`tests.html:198-199`), so it cannot see what the cache drops (AUD-14). Seed through `autoSaveCache()` → `loadBackupFromStorage()` wherever a cache-first session is the realistic case.
2. **Run the suite in CI.** The Playwright driver used in §1 is ~40 lines: serve, block every non-local host, click, assert "0 failed". Committing it with a GitHub Action would have made the 281 cases a merge gate. Currently they're a manual click (`tests.html:58`).
3. **Add a Reel Studio harness.** Studio has zero tests and carries AUD-07 and AUD-28.
4. **Pure-module extraction (Pass 4 rank 5)** lets the quota, parsing, music and CSV cases run in Node without a browser, in milliseconds.
5. **Coverage.** Run Chromium with `page.coverage.startJSCoverage()` in the same driver to replace the static proxy in §2 with real line coverage.
