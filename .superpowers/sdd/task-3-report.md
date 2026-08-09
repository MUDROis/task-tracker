### Summary
Replaced the `.task-card.priority-high/medium/low` border-left-color rules in `style.css` with the seven `.task-card.strip-*` rules (strip-ok/warn/orange/coral/red/overdue/none) verbatim from the brief. Appended the "TYPE TOGGLE (Задача | Отчёт)" and "ARCHIVE DONE ROW" blocks (`.item-type-toggle`, `.item-type-btn`, `.archive-row` base border-left, `.archive-row-done`, `.archive-row.strip-*`) at the end of the file. Committed only `style.css` with the exact message.

### Verification
- `git show --stat HEAD` → `style.css | 57 +++++++++++++++++++--------`, 1 file changed, 48 insertions(+), 9 deletions(-).
- `git show HEAD -- style.css` → diff shows exactly the priority→strip replacement and the appended toggle/archive blocks; no other rules touched; the pre-existing `.archive-row` block (lines 885-894) is preserved and the new `.archive-row` rule overrides its `border` via later source order.
- Re-read changed regions (lines 370-376 and 936-975) — match the brief verbatim, including the two UTF-8 section-header comments.

### Changes
- `style.css`

### Concerns
- none
