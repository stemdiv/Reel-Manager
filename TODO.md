# TODO — after the September 2026 audit

State as of 2026-09-27: `main` at v1.27.57 (what GitHub Pages serves); branch `fix/category-cache` at v1.27.64, pushed,
not merged. tests.html: 496 cases, 494 passing (the 2 failures are the quota estimator's, see "To investigate").
Backlogs: v6.7 (items #85 to #96, next free number #97).
Details for each finding: `08-remediation.md` in the audit report, kept outside this public repo
(local folder `YouTube Playlist Manager - audits/2026-09/`).

## Merges

- [x] Merge the lot PRs in stack order: #3 (Lot 4) → #4 (Lot 5) → #5 (Lot 6) → #6 (Lot 7) → #7 (Lot 8) → #8 (Lot 9).
  After each merge, bring `main` into the next branch. No CI in the repo: run `tests.html` locally.
- [x] Merge #9 (backlogs v6.6) after #8. Open the `.docx` files in Word first: they were not checked visually.
- [x] #2 (audit): not to be merged. Merged by mistake on 2026-09-26, reverted (`6d51c4e`); branch deleted, report moved out of the repo.
- [x] Merge #10 (`claude/youthful-fermi-b0e5wy`, on top of #9): tutorial detection (1.27.52), local server and offline page (1.27.53), AUD-54 (1.27.54), sign-in kept across page loads (1.27.55).
- [x] Push `fix/category-cache` (1.27.58 → 1.27.64, with the v6.7 backlogs) — 2026-09-27.
- [ ] Open a PR from `fix/category-cache` into `main` and merge it once the checks below pass. GitHub Pages serves `main`:
  until then, the site stays on v1.27.57. **Export a backup from the live site before the first visit after the merge**
  (1.27.62 migrates the tags to ids; see below).

## To test before merging `fix/category-cache`

Run them on `LANCER-APP.bat` (localhost), which serves the branch.

- [ ] 1.27.58: run the auto-categorisation twice in a row (Tags view). The first run
  may still cost units (older backups carry no categories); the second must leave the quota counter unchanged. Then reload
  the page and use the Type or Category filter in the global search: no "analysing" call for videos already known.
  Run `tests.html` (4 new cases, `category-cache`).
- [ ] 1.27.59: with your real library, pick the Music then Videos filter right after loading, without opening
  anything. Concert playlists should be under Music. In Tags, try a chip cross, Rename (onto an existing tag too),
  Remove from… and Delete everywhere.
- [ ] 1.27.60: in Reel Studio (Playlists), the All / Videos / Music chips should list the same playlists as the
  Reel Manager lens. After the merge, open GitHub Pages once: the page must load `shared/core.js?v=1.27.64` (DevTools, Network).
- [ ] 1.27.62 (tag ids): **export a backup first** — once migrated, an older version (GitHub Pages until the merge)
  shows `yt:10` instead of "Musique". Then open the app on your real library: the FR/EN pairs should be one tag each
  (Tags view, and Reel Studio). Switch FR ↔ EN: names follow. Translate one of your own tags, switch again.
  Run auto-categorisation in English: no English duplicate. (The 1.27.61 merge button is gone: the migration replaces it.)
- [ ] 1.27.63: in Tags, a tag you translated shows "· EN" after its count. In Reel Studio, the FR/EN button
  switches the language (the page reloads on the same view) and Reel Manager follows on its next load. On a phone, the
  Studio top bar wraps (brand, search, buttons) and nothing sits under the Palette button.
- [ ] 1.27.64 (four kinds): on your real library, pick Music then Tracks / Clips / Live & sets (Reel Manager and
  Studio): does each playlist land where you expect? Note the misfiled ones (title and channel of a few videos) to tune the
  rules. Open a mixed playlist in Music view: the chips filter the tracklist, Clip and Live badges look right.

## To investigate

- [x] AUD-54: page error `Cannot set properties of null (setting 'textContent')`: the storage estimate beat the IndexedDB read in the cache diagnostic. Fixed in 1.27.54.
- [x] "HORS LIGNE — CACHE LOCAL" after switching between Reel Studio and Reel Manager, or any reload: the token lived
  in memory only. Fixed in 1.27.55: kept in `sessionStorage` for the tab, restored while valid. The log now records
  how each page was opened (`navigation`) and the last control clicked before leaving ("page left").
- [x] The app used day to day is **GitHub Pages** (`stemdiv.github.io/Reel-Manager/`), which serves `main`:
  it now runs v1.27.55 with all the fixes (checked 2026-09-26). `LANCER-APP.bat` (localhost) remains the way to test before pushing.
- [ ] Music detection v1.27.52: check the Ableton playlist with the Type filter; send any tutorial titles still read as music (to add as tests).
  Option: make auto-categorize tag mostly-tutorial playlists "Tutorials" instead of the YouTube category.
- [ ] tests.html, quota estimator: 2 cases fail on every run since at least 1.27.58 — "Chart.js loads from this origin"
  (Chart.js does not load; a wrong integrity hash blocks it too) and "the estimator's inline script matches the hash its CSP
  allows" (the CSP hash is stale). Recompute the script hash and check the Chart.js file and its SRI.

## Open findings

- [ ] Track L: AUD-02, AUD-35, AUD-37, AUD-40.
- [ ] AUD-26.
- [ ] Backlog #78 and #79.

## Partially fixed

- [ ] #G6: add PKCE (the OAuth `state` is already in place, Lot 7).
- [ ] AUD-08: `frame-ancestors` must be sent as an HTTP header by the host (a `<meta>` CSP cannot carry it).
- [ ] AUD-33: move the themes, the picker and the cache readers to `CONFIG` / `shared/core.js`. (Since 1.27.60–1.27.64,
  the music classifier and the tag-name tables live there too.)
