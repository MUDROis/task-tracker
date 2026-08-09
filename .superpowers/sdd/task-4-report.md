# Task 4 Report

## Summary
Applied all 6 edits to `app.js` per the brief: added deadline strip classes (`deadlineStripClass`) to `createTaskCard` and `createReportCard`; added `completedAt`/`completedLate` stamping (via `isCompletedLate`) to `changeStatus` and `changeReportStatus` on `done`; and added `archive-row-done` + `doneStripClass` classes to `createArchiveTaskRow` and `createArchiveReportRow`. Syntax check and all tests pass; committed `app.js` only.

## Verification
- `node --check app.js` → no output, exit 0 (SYNTAX_OK).
- `node --test "tests/*.test.js"` → tests 5, pass 5, fail 0 (calendarDaysUntil x2, deadlineStripClass, isCompletedLate, doneStripClass).
- `git commit` → `[main 7795638] feat: deadline strip on cards and done records`, 1 file changed, 15 insertions(+), 6 deletions(-).

## Changes
- `app.js` (only file committed)

## Concerns
- none
