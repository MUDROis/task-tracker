### Summary
Applied the four markup edits to `index.html`: added the `#itemTypeToggle` task/report switch after `#taskId`, added `id="taskStatusGroup"` and the `<option value="reports">Отчёт</option>` to `#taskStatus`, added the `#reportStatus` select after the `#reportDesc` block, and added the `js/helpers.js` script tag before `app.js`. Anchors were located by real element ids rather than the brief's line numbers (which had shifted). Committed only `index.html`.

### Verification
- `Read index.html` — all 4 anchors confirmed present and unique before editing.
- `grep` for `itemTypeToggle|reportStatus|taskStatusGroup|value="reports"|js/helpers.js` — each appears exactly once in `index.html` (toggle line 130, status group 143, option 148, report select 190, script 263); no duplication.
- `git diff index.html` — only intended additions (17 insertions, 1 deletion), Cyrillic copied verbatim from file.
- `git add index.html; git commit -m "feat: type toggle and report status select markup"` — committed as `852a036` (1 file changed, +17/−1).
- `git show --stat HEAD` and `git show HEAD -- index.html` — confirm only the 4 intended additions in `index.html`.

### Changes
- `index.html` (committed as `852a036`)

### Concerns
- None. `.superpowers/` remains untracked (not part of this task, left untouched).
