### Summary
Applied all 4 edits from task-5-brief.md to `app.js`: added global `let currentItemMode = 'task';` after `var blockedMessage = null;` (line 19), inserted `taskToReport(task)` and `reportToTask(report, status)` functions right after `updateTask`, replaced the entire `reportForm` submit handler (converts urgent/in_progress reports to tasks via reportToTask, first-create-then-delete), and replaced the entire `taskForm` submit handler (report mode creates report directly, 'reports' status on existing task → taskToReport + removeTask, 'reports' on new → saveReport). Committed `app.js` only.

### Verification
- `node --check app.js` → no output, exit code 0.
- `git add app.js; git commit -m "feat: task-to-report and report-to-task conversion"` → committed as `d44f074`, 1 file changed, 112 insertions, 13 deletions.
- `git show d44f074` → verified `currentItemMode`, `taskToReport`, `reportToTask`, `reportStatus` logic present; Cyrillic alert string `'Вы не можете редактировать эту задачу'` preserved.
- `git status --short` → only untracked `.superpowers/` remains; no other changes.

### Changes
- `app.js` (committed, commit `d44f074`)

### Concerns
- none
