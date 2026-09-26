# TODO — after the September 2026 audit

State as of 2026-09-24: app v1.27.51, Reel Studio 0.7.6, 447 tests passing, i18n 785/785.
Details for each finding: `audit/2026-09/08-remediation.md` (on branch `audit/2026-09`).

## Merges

- [ ] Merge the lot PRs in stack order: #3 (Lot 4) → #4 (Lot 5) → #5 (Lot 6) → #6 (Lot 7) → #7 (Lot 8) → #8 (Lot 9).
  After each merge, bring `main` into the next branch. No CI in the repo: run `tests.html` locally.
- [ ] Merge #9 (backlogs v6.6) after #8. Open the `.docx` files in Word first: they were not checked visually.
- [ ] **Do not merge** #2 (audit).

## To investigate

- [ ] AUD-54: page error `Cannot set properties of null (setting 'textContent')` seen during test runs.

## Open findings

- [ ] Track L: AUD-02, AUD-35, AUD-37, AUD-40.
- [ ] AUD-26.
- [ ] Backlog #78 and #79.

## Partially fixed

- [ ] #G6: add PKCE (the OAuth `state` is already in place, Lot 7).
- [ ] AUD-08: `frame-ancestors` must be sent as an HTTP header by the host (a `<meta>` CSP cannot carry it).
- [ ] AUD-33: move the themes, the picker and the cache readers to `CONFIG` / `shared/core.js`.
