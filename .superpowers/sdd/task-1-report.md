# Task 1 Report: Deadline strip pure functions (`js/helpers.js`) with unit tests

## Status: DONE_WITH_CONCERNS

## What was implemented

- Created `js/helpers.js` — UMD module exposing `window.DeadlineHelpers` in the browser and `module.exports` in Node. Four pure functions:
  - `calendarDaysUntil(dueDateStr) → number|null` — calendar days until deadline (day-boundary, no time-of-day); `null` for empty/invalid dates.
  - `deadlineStripClass(daysLeft) → string` — one of `strip-ok | strip-warn | strip-orange | strip-coral | strip-red | strip-overdue | strip-none`.
  - `isCompletedLate(completedAtStr, dueDateStr) → boolean` — exact-time comparison.
  - `doneStripClass(completedAt, dueDate, completedLate) → string`.
- Created `tests/deadline.test.js` — 5 tests using Node's built-in `node:test` / `node:assert`.

Both files were extracted **byte-for-byte** from the two JS code blocks in the task brief (`.superpowers/sdd/task-1-brief.md`) via a PowerShell extraction script, so content matches the brief verbatim including function names, boundary conditions, strip class strings, and comments.

## TDD evidence

### RED

Command: `node --test tests\deadline.test.js` (helpers.js temporarily absent)

```
Error: Cannot find module '../js/helpers.js'
Require stack:
- C:\...\task-tracker\tests\deadline.test.js
    at Object.<anonymous> (C:\...\task-tracker\tests\deadline.test.js:3:11)
  code: 'MODULE_NOT_FOUND'
```

Failure reason: `js/helpers.js` did not exist yet, so `require('../js/helpers.js')` on line 3 of the test file failed. Exactly the expected failure.

### GREEN

Command: `node --test "tests/*.test.js"`

```
✔ calendarDaysUntil: считает календарные дни (15.2775ms)
✔ calendarDaysUntil: null для отсутствующей/неверной даты (0.1474ms)
✔ deadlineStripClass: диапазоны дней (0.1274ms)
✔ isCompletedLate: сравнение точного времени выполнения и срока (0.1741ms)
✔ doneStripClass: бордовая при просрочке, зелёная в срок, текущая срочность без отметки (0.8282ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 113.2765
```

5/5 passing. Output is pristine — no warnings, no noise.

## Files changed

- `js/helpers.js` (new, 57 lines) — UMD deadline-strip helpers.
- `tests/deadline.test.js` (new, 47 lines) — node:test unit tests.
- No other files touched.

## Commit

- `b411f91` — `feat: deadline strip helpers with unit tests` (2 files, 104 insertions).
- Only the two intended files staged; `.superpowers/` left untracked.
- LF→CRLF warnings on commit observed; harmless as noted in the task.

## Self-review findings

- Function names match brief: `calendarDaysUntil`, `deadlineStripClass`, `isCompletedLate`, `doneStripClass`.
- Strip class strings match: `strip-ok`, `strip-warn`, `strip-orange`, `strip-coral`, `strip-red`, `strip-overdue`, `strip-none`.
- Boundary conditions verified against tests: `>5→ok`, `>=4→warn`, `>=3→orange`, `>=2→coral`, `>=1→red`, `<=0→overdue`, `null/undefined→none`.
- `calendarDaysUntil` returns `null` for `''` and `'not-a-date'`; uses `Math.round` on day-boundary diff.
- `doneStripClass`: late→`strip-overdue`, completed→`strip-ok`, else delegates to `deadlineStripClass(calendarDaysUntil(dueDate))`.
- Byte-level extraction from the brief guarantees verbatim match of both files.

## Concerns

1. **Test run command differs from brief on this environment.** The brief's exact command `node --test tests/` fails on Windows + Node v26.3.0: the trailing-slash directory is treated as a module specifier, producing `Cannot find module '...\task-tracker\tests'` instead of discovering the test files. Working equivalents: `node --test tests\deadline.test.js`, `node --test "tests/*.test.js"`, or bare `node --test`. Recommend the plan/CI note use `node --test "tests/*.test.js"` (or add a `test` script) for cross-platform consistency.
2. The brief file is double-encoded (UTF-8 read as CP1251 and re-saved), so Russian text inside the brief and the resulting test names/comments is mojibake. Content was preserved verbatim as the brief instructs; functionality is unaffected. If clean Cyrillic text is desired, the brief file itself should be re-encoded.
