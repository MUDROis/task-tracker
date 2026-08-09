### Task 4: Полоски на карточках, отметка выполнения, архив

**Files:**
- Modify: `app.js:1162-1166` (createTaskCard), `app.js:1839-1842` (createReportCard), `app.js:1304-1314` (changeStatus), `app.js:427-434` (changeReportStatus), `app.js:719-722` (createArchiveTaskRow), `app.js:756-759` (createArchiveReportRow)

**Interfaces:**
- Consumes: `DeadlineHelpers` из Task 1 (глобал `DeadlineHelpers`), CSS-классы из Task 3.
- Produces: карточки с классом `strip-*`; записи с `completedAt`/`completedLate`; строки архива с классами `archive-row-done` и `strip-*`.

- [ ] **Step 1: Полоска в `createTaskCard`**

Заменить строку 1164:

```js
        div.className = 'task-card priority-' + (task.priority || 'medium');
```

на:

```js
        var stripClass = DeadlineHelpers.deadlineStripClass(DeadlineHelpers.calendarDaysUntil(task.dueDate));
        div.className = 'task-card priority-' + (task.priority || 'medium') + ' ' + stripClass;
```

- [ ] **Step 2: Полоска в `createReportCard`**

Заменить строку 1841:

```js
        div.className = 'task-card report-card priority-' + (report.priority || 'medium');
```

на:

```js
        var stripClass = DeadlineHelpers.deadlineStripClass(DeadlineHelpers.calendarDaysUntil(report.dueDate));
        div.className = 'task-card report-card priority-' + (report.priority || 'medium') + ' ' + stripClass;
```

- [ ] **Step 3: Отметка выполнения в `changeStatus`**

Заменить тело функции (строки 1304-1314):

```js
    function changeStatus(id, newStatus) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;
        var updated = Object.assign({}, task);
        if (newStatus === 'done') {
            updated.previousStatus = task.status;
        }
        updated.status = newStatus;
        updated.updatedAt = new Date().toISOString();
        saveTask(updated);
    }
```

на:

```js
    function changeStatus(id, newStatus) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;
        var updated = Object.assign({}, task);
        if (newStatus === 'done') {
            updated.previousStatus = task.status;
            updated.completedAt = new Date().toISOString();
            updated.completedLate = DeadlineHelpers.isCompletedLate(updated.completedAt, task.dueDate);
        }
        updated.status = newStatus;
        updated.updatedAt = new Date().toISOString();
        saveTask(updated);
    }
```

- [ ] **Step 4: Отметка выполнения в `changeReportStatus`**

Заменить строки 427-434:

```js
    function changeReportStatus(id, newStatus) {
        var report = reports.find(function(r) { return r.id === id; });
        if (!report) return;
        saveReport(Object.assign({}, report, {
            status: newStatus,
            updatedAt: new Date().toISOString()
        }));
    }
```

на:

```js
    function changeReportStatus(id, newStatus) {
        var report = reports.find(function(r) { return r.id === id; });
        if (!report) return;
        var updated = Object.assign({}, report, {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
        if (newStatus === 'done') {
            updated.completedAt = new Date().toISOString();
            updated.completedLate = DeadlineHelpers.isCompletedLate(updated.completedAt, report.dueDate);
        }
        saveReport(updated);
    }
```

- [ ] **Step 5: Классы в `createArchiveTaskRow`**

Заменить строку 720:

```js
        div.className = 'archive-row';
```

на:

```js
        div.className = 'archive-row archive-row-done ' + DeadlineHelpers.doneStripClass(task.completedAt, task.dueDate, task.completedLate);
```

- [ ] **Step 6: Классы в `createArchiveReportRow`**

Заменить строку 762:

```js
        div.className = 'archive-row';
```

на:

```js
        div.className = 'archive-row archive-row-done ' + DeadlineHelpers.doneStripClass(report.completedAt, report.dueDate, report.completedLate);
```

- [ ] **Step 7: Проверка синтаксиса и логики**

Run: `node --check app.js`
Expected: нет вывода (файл синтаксически корректен).

Run: `node --test "tests/*.test.js"`
Expected: 5 тестов PASS.

- [ ] **Step 8: Commit**

```bash
git add app.js
git commit -m "feat: deadline strip on cards and done records"
```

---

