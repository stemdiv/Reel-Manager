# TODO — after the September 2026 audit

State as of 2026-09-24: app v1.27.55, Reel Studio 0.7.6, 462 tests passing, i18n 785/785.
Details for each finding: `audit/2026-09/08-remediation.md` (on branch `audit/2026-09`).

## Merges

- [ ] Merge the lot PRs in stack order: #3 (Lot 4) → #4 (Lot 5) → #5 (Lot 6) → #6 (Lot 7) → #7 (Lot 8) → #8 (Lot 9).
  After each merge, bring `main` into the next branch. No CI in the repo: run `tests.html` locally.
- [ ] Merge #9 (backlogs v6.6) after #8. Open the `.docx` files in Word first: they were not checked visually.
- [ ] **Do not merge** #2 (audit).
- [ ] Merge #10 (`claude/youthful-fermi-b0e5wy`, on top of #9): tutorial detection (1.27.52), local server and offline page (1.27.53), AUD-54 (1.27.54), sign-in kept across page loads (1.27.55).

## To investigate

- [x] AUD-54: page error `Cannot set properties of null (setting 'textContent')`: the storage estimate beat the IndexedDB read in the cache diagnostic. Fixed in 1.27.54.
- [x] "HORS LIGNE — CACHE LOCAL" after switching between Reel Studio and Reel Manager, or any reload: the token lived
  in memory only. Fixed in 1.27.55: kept in `sessionStorage` for the tab, restored while valid. The log now records
  how each page was opened (`navigation`) and the last control clicked before leaving ("page left").
- [ ] The app used day to day is **GitHub Pages** (`stemdiv.github.io/Reel-Manager/`), which serves `main` (v1.27.3):
  none of the fixes reach it until the PRs are merged. Until then, use `LANCER-APP.bat` (localhost) to test them.
- [ ] Music detection v1.27.52: check the Ableton playlist with the Type filter; send any tutorial titles still read as music (to add as tests).
  Option: make auto-categorize tag mostly-tutorial playlists "Tutorials" instead of the YouTube category.

## Open findings

- [ ] Track L: AUD-02, AUD-35, AUD-37, AUD-40.
- [ ] AUD-26.
- [ ] Backlog #78 and #79.

## Partially fixed

- [ ] #G6: add PKCE (the OAuth `state` is already in place, Lot 7).
- [ ] AUD-08: `frame-ancestors` must be sent as an HTTP header by the host (a `<meta>` CSP cannot carry it).
- [ ] AUD-33: move the themes, the picker and the cache readers to `CONFIG` / `shared/core.js`.
