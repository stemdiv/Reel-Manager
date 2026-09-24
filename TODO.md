# TODO — after the September 2026 audit

State as of 2026-09-24: app v1.27.53, Reel Studio 0.7.6, 457 tests passing, i18n 785/785.
Details for each finding: `audit/2026-09/08-remediation.md` (on branch `audit/2026-09`).

## Merges

- [ ] Merge the lot PRs in stack order: #3 (Lot 4) → #4 (Lot 5) → #5 (Lot 6) → #6 (Lot 7) → #7 (Lot 8) → #8 (Lot 9).
  After each merge, bring `main` into the next branch. No CI in the repo: run `tests.html` locally.
- [ ] Merge #9 (backlogs v6.6) after #8. Open the `.docx` files in Word first: they were not checked visually.
- [ ] **Do not merge** #2 (audit).
- [ ] Open a PR for `claude/youthful-fermi-b0e5wy` (on top of #9): tutorial detection (1.27.52), local server and offline page (1.27.53).

## To investigate

- [ ] AUD-54: page error `Cannot set properties of null (setting 'textContent')` seen during test runs.
- [ ] "HORS LIGNE — CACHE LOCAL" appears when switching a playlist between Music and Video view.
  The toggle does not touch the token; only a page reload (or Logout) loses it, since the token lives in memory.
  To collect: does the page visibly reload on the switch? After **Reconnect**, does switching bring the banner back?
  Export the diagnostic log (Help) right after it happens: it records every page load and sign-in.
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
