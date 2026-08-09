# Полоска срока, конверсия «задача ↔ отчёт», подсветка выполненных — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Левая полоска карточек показывает близость срока (зелёный → бордовый), задачи получают статус «Отчёт» с конверсией в полноценный отчёт (и обратно), а выполненные записи подсвечиваются в архиве светло-зелёным (с бордовой полоской при просрочке).

**Architecture:** Чистые функции расчёта срока выносятся в новый файл `js/helpers.js` (доступен и в браузере как `window.DeadlineHelpers`, и в Node-тестах через `require`). DOM-часть остаётся в `app.js`, стили — в `style.css`, разметка — в `index.html`.

**Tech Stack:** Vanilla JS + Firebase Realtime Database (PWA), Node.js встроенный тест-раннер `node:test` для чистых функций.

## Global Constraints

- Без новых npm-зависимостей и без сборки. Тесты — `node --test "tests/*.test.js"` (Node ≥ 18, у нас v26).
- Стиль кода как в `app.js`: IIFE, `var`, конкатенация строк, русские подписи.
- Полоска карточки окрашивается ТОЛЬКО по сроку; приоритет полоску не красит.
- Значения статусов: `urgent`, `in_progress`, `reports`, `done`.
- Файлы: изменяются `index.html`, `app.js`, `style.css`; создаются `js/helpers.js`, `tests/deadline.test.js`.
- Частые коммиты: один на задачу, стиль сообщений как в истории (префиксы `feat:`/`fix:`/`docs:`).

---

### Task 1: Чистые функции срока (`js/helpers.js`) с тестами

**Files:**
- Create: `js/helpers.js`
- Test: `tests/deadline.test.js`

**Interfaces:**
- Produces (используются всеми следующими задачами):
  - `DeadlineHelpers.calendarDaysUntil(dueDateStr) → number|null` (календарные дни до срока, без времени суток; `null` при отсутствии/неверной дате)
  - `DeadlineHelpers.deadlineStripClass(daysLeft) → string` (один из: `strip-ok`, `strip-warn`, `strip-orange`, `strip-coral`, `strip-red`, `strip-overdue`, `strip-none`)
  - `DeadlineHelpers.isCompletedLate(completedAtStr, dueDateStr) → boolean`
  - `DeadlineHelpers.doneStripClass(completedAt, dueDate, completedLate) → string`

- [ ] **Step 1: Создать каталог и написать падающий тест**

Создать `tests/deadline.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/helpers.js');

function daysFromNow(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
}

test('calendarDaysUntil: считает календарные дни', function() {
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(6)), 6);
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(3)), 3);
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(0)), 0);
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(-2)), -2);
});

test('calendarDaysUntil: null для отсутствующей/неверной даты', function() {
    assert.strictEqual(H.calendarDaysUntil(''), null);
    assert.strictEqual(H.calendarDaysUntil('not-a-date'), null);
});

test('deadlineStripClass: диапазоны дней', function() {
    assert.strictEqual(H.deadlineStripClass(6), 'strip-ok');
    assert.strictEqual(H.deadlineStripClass(5), 'strip-warn');
    assert.strictEqual(H.deadlineStripClass(4), 'strip-warn');
    assert.strictEqual(H.deadlineStripClass(3), 'strip-orange');
    assert.strictEqual(H.deadlineStripClass(2), 'strip-coral');
    assert.strictEqual(H.deadlineStripClass(1), 'strip-red');
    assert.strictEqual(H.deadlineStripClass(0), 'strip-overdue');
    assert.strictEqual(H.deadlineStripClass(-5), 'strip-overdue');
    assert.strictEqual(H.deadlineStripClass(null), 'strip-none');
});

test('isCompletedLate: сравнение точного времени выполнения и срока', function() {
    assert.strictEqual(H.isCompletedLate(daysFromNow(2), daysFromNow(3)), false);
    assert.strictEqual(H.isCompletedLate(daysFromNow(3), daysFromNow(2)), true);
    assert.strictEqual(H.isCompletedLate('', daysFromNow(2)), false);
    assert.strictEqual(H.isCompletedLate(daysFromNow(2), ''), false);
});

test('doneStripClass: бордовая при просрочке, зелёная в срок, текущая срочность без отметки', function() {
    assert.strictEqual(H.doneStripClass(daysFromNow(2), daysFromNow(3), true), 'strip-overdue');
    assert.strictEqual(H.doneStripClass(daysFromNow(2), daysFromNow(3), false), 'strip-ok');
    assert.strictEqual(H.doneStripClass('', daysFromNow(10), undefined), 'strip-ok');
    assert.strictEqual(H.doneStripClass('', '', undefined), 'strip-none');
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `node --test "tests/*.test.js"`
Expected: FAIL — `Error: Cannot find module '../js/helpers.js'`

- [ ] **Step 3: Создать `js/helpers.js`**

```js
// Чистые функции расчёта полоски срока и отметки просрочки.
// В браузере доступны как window.DeadlineHelpers, в Node — через require().
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DeadlineHelpers = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var DAY_MS = 24 * 60 * 60 * 1000;

    function startOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }

    function calendarDaysUntil(dueDateStr) {
        if (!dueDateStr) return null;
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return null;
        var now = new Date();
        return Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
    }

    function deadlineStripClass(daysLeft) {
        if (daysLeft === null || typeof daysLeft === 'undefined') return 'strip-none';
        if (daysLeft > 5) return 'strip-ok';
        if (daysLeft >= 4) return 'strip-warn';
        if (daysLeft >= 3) return 'strip-orange';
        if (daysLeft >= 2) return 'strip-coral';
        if (daysLeft >= 1) return 'strip-red';
        return 'strip-overdue';
    }

    function isCompletedLate(completedAtStr, dueDateStr) {
        if (!completedAtStr || !dueDateStr) return false;
        var completed = new Date(completedAtStr);
        var due = new Date(dueDateStr);
        if (isNaN(completed.getTime()) || isNaN(due.getTime())) return false;
        return completed.getTime() > due.getTime();
    }

    function doneStripClass(completedAt, dueDate, completedLate) {
        if (completedLate) return 'strip-overdue';
        if (completedAt) return 'strip-ok';
        return deadlineStripClass(calendarDaysUntil(dueDate));
    }

    return {
        calendarDaysUntil: calendarDaysUntil,
        deadlineStripClass: deadlineStripClass,
        isCompletedLate: isCompletedLate,
        doneStripClass: doneStripClass
    };
}));
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `node --test "tests/*.test.js"`
Expected: 5 тестов PASS

- [ ] **Step 5: Commit**

```bash
git add js/helpers.js tests/deadline.test.js
git commit -m "feat: deadline strip helpers with unit tests"
```

---

### Task 2: Разметка — переключатель, статусы, подключение helpers.js

**Files:**
- Modify: `index.html` (модалка задачи 123-165, модалка отчёта 168-203, подключение скриптов 247-249)

**Interfaces:**
- Consumes: нет (чистый HTML).
- Produces: элементы, которые использует app.js:
  - `#itemTypeToggle` + кнопки `.item-type-btn[data-type=task|report]`
  - `#taskStatusGroup` (обёртка селекта статуса задачи)
  - `<option value="reports">Отчёт</option>` в `#taskStatus`
  - `#reportStatus` (селект статуса отчёта)
  - подключённый `js/helpers.js` перед `app.js`

- [ ] **Step 1: Добавить переключатель «Задача | Отчёт» в модалку задачи**

В `#taskForm`, сразу после `<input type="hidden" id="taskId">` (строка 128), вставить:

```html
                    <div class="form-group">
                        <div class="item-type-toggle" id="itemTypeToggle">
                            <button type="button" class="item-type-btn active" data-type="task">Задача</button>
                            <button type="button" class="item-type-btn" data-type="report">Отчёт</button>
                        </div>
                    </div>
```

- [ ] **Step 2: Добавить id обёртке статуса и вариант «Отчёт»**

Заменить блок статуса (строки 137-143):

```html
                    <div class="form-group" id="taskStatusGroup">
                        <label for="taskStatus">Статус</label>
                        <select id="taskStatus">
                            <option value="urgent">Срочные</option>
                            <option value="in_progress" selected>В работе</option>
                            <option value="reports">Отчёт</option>
                        </select>
                    </div>
```

- [ ] **Step 3: Добавить селект статуса в модалку отчёта**

В `#reportForm`, сразу после блока `#reportDesc` (после строки 181), вставить:

```html
                    <div class="form-group">
                        <label for="reportStatus">Статус</label>
                        <select id="reportStatus">
                            <option value="urgent">Срочные</option>
                            <option value="in_progress">В работе</option>
                            <option value="reports" selected>Отчёт</option>
                        </select>
                    </div>
```

- [ ] **Step 4: Подключить `js/helpers.js`**

Заменить (строка 248):

```html
    <script src="app.js"></script>
```

на:

```html
    <script src="js/helpers.js"></script>
    <script src="app.js"></script>
```

- [ ] **Step 5: Проверка разметки**

Синтаксис JS проверится в следующих задачах (`node --check app.js`). Разметку проверить в браузере на Task 7 (сквозная проверка). Здесь достаточно убедиться, что блоки вставлены без дублирования: переключатель `#itemTypeToggle` один, опция `reports` одна в `#taskStatus`, селект `#reportStatus` один, `helpers.js` подключён один раз.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: type toggle and report status select markup"
```

---

### Task 3: Стили — полоски срока, переключатель, выполненная запись

**Files:**
- Modify: `style.css` (правила приоритета 370-378, блок `.task-card` 336-345, блок `.archive-row` 885-894, конец файла)

**Interfaces:**
- Consumes: классы из Task 1 (`strip-ok`, `strip-warn`, `strip-orange`, `strip-coral`, `strip-red`, `strip-overdue`, `strip-none`), разметка из Task 2.
- Produces: CSS-классы для карточек/строк и переключателя.

- [ ] **Step 1: Убрать приоритетную окраску полоски, добавить классы срока**

Заменить строки 370-378:

```css
.task-card.priority-high {
    border-left-color: #22c55e;
}
.task-card.priority-medium {
    border-left-color: #3b82f6;
}
.task-card.priority-low {
    border-left-color: #94a3b8;
}
```

на:

```css
.task-card.strip-ok { border-left-color: #22c55e; }
.task-card.strip-warn { border-left-color: #a3e635; }
.task-card.strip-orange { border-left-color: #f97316; }
.task-card.strip-coral { border-left-color: #fb7185; }
.task-card.strip-red { border-left-color: #ef4444; }
.task-card.strip-overdue { border-left-color: #7f1d1d; }
.task-card.strip-none { border-left-color: #94a3b8; }
```

- [ ] **Step 2: Добавить стили переключателя**

Добавить в конец `style.css`:

```css
/* ===== TYPE TOGGLE (Задача | Отчёт) ===== */
.item-type-toggle {
    display: flex;
    background: #f1f5f9;
    border-radius: 0.6rem;
    padding: 0.25rem;
    gap: 0.25rem;
}
.item-type-btn {
    flex: 1;
    border: none;
    background: transparent;
    padding: 0.45rem 0.5rem;
    border-radius: 0.45rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    color: #64748b;
    transition: background 0.15s, color 0.15s;
}
.item-type-btn.active {
    background: #fff;
    color: #1e293b;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}

/* ===== ARCHIVE DONE ROW ===== */
.archive-row {
    border-left: 4px solid transparent;
}
.archive-row-done {
    background: #f0fdf4;
}
.archive-row.strip-ok { border-left-color: #22c55e; }
.archive-row.strip-warn { border-left-color: #a3e635; }
.archive-row.strip-orange { border-left-color: #f97316; }
.archive-row.strip-coral { border-left-color: #fb7185; }
.archive-row.strip-red { border-left-color: #ef4444; }
.archive-row.strip-overdue { border-left-color: #7f1d1d; }
.archive-row.strip-none { border-left-color: #94a3b8; }
```

Примечание: правило `.archive-row { border-left: 4px solid transparent; }` добавлено отдельным селектором ниже, чтобы перебить `border: 1px solid #e2e8f0` из существующего блока (одинаковая специфичность — побеждает более поздний порядок в файле). Не удалять существующий блок `.archive-row`.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: deadline strip and archive-done styles"
```

---

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

### Task 5: Конверсия «задача ↔ отчёт» в submit-обработчиках

**Files:**
- Modify: `app.js` (добавить функции `taskToReport`/`reportToTask` рядом с CRUD-секцией ~строки 1315-1322; обработчик `taskForm` submit 1562-1610; обработчик `reportForm` submit 1524-1560)

**Interfaces:**
- Consumes: `generateId()`, `computeReportNumber()`, `saveTask`, `saveReport`, `removeTask`, `removeReport`, `currentUser`, `tasks`, `reports` (все уже в app.js).
- Produces: `taskToReport(task) → Promise`, `reportToTask(report, status) → Promise`, глобал `currentItemMode` ('task' | 'report').

- [ ] **Step 1: Добавить глобал режима и функции конверсии**

Объявить глобал режима. В блок глобальных переменных (после `var blockedMessage = null;`, строка 19) вставить:

```js
    let currentItemMode = 'task'; // 'task' | 'report' — режим модалки добавления
```

После функции `updateTask` (после строки 1322) вставить функции конверсии:

```js
    function taskToReport(task) {
        return saveReport({
            id: generateId(),
            title: task.title,
            description: task.description || '',
            priority: task.priority || 'medium',
            reportNumber: computeReportNumber(),
            dueDate: task.dueDate || '',
            assignedTo: task.assignedTo || '',
            delegated: !!task.delegated,
            delegatedBy: task.delegatedBy || '',
            createdBy: task.createdBy,
            status: 'active',
            createdAt: task.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    function reportToTask(report, status) {
        return saveTask({
            id: generateId(),
            title: report.title,
            description: report.description || '',
            status: status,
            previousStatus: '',
            delegated: !!report.delegated,
            delegatedBy: report.delegatedBy || '',
            createdBy: report.createdBy,
            assignedTo: report.assignedTo || '',
            priority: report.priority || 'medium',
            dueDate: report.dueDate || '',
            createdAt: report.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
```

- [ ] **Step 2: Обработка «Отчёт» в `taskForm` submit**

Заменить тело обработчика `taskForm.addEventListener('submit', ...)` (строки 1562-1610) на:

```js
    taskForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var id = taskId.value;
        var title = taskTitle.value.trim();
        if (!title) return;
        var description = taskDesc.value.trim();
        var status = taskStatus.value;
        var priority = taskPriority.value;
        var dueDate = taskDueDate.value;
        var assignee = taskAssignee.value;

        if (currentItemMode === 'report') {
            saveReport({
                id: generateId(),
                title: title,
                description: description,
                priority: priority,
                reportNumber: computeReportNumber(),
                dueDate: dueDate,
                assignedTo: assignee || '',
                createdBy: currentUser.login,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            taskModal.classList.remove('active');
            return;
        }

        if (id) {
            var task = tasks.find(function(t) { return t.id === id; });
            if (task) {
                if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
                    alert('Вы не можете редактировать эту задачу');
                    return;
                }
                if (status === 'reports') {
                    taskToReport(task).then(function() { removeTask(task.id); });
                    taskModal.classList.remove('active');
                    return;
                }
                var updates = {
                    title: title,
                    description: description,
                    priority: priority,
                    dueDate: dueDate,
                    assignedTo: assignee || ''
                };
                if (status !== task.status) {
                    updates.previousStatus = task.status;
                    updates.status = status;
                }
                updateTask(id, updates);
                if (assignee && assignee !== task.assignedTo) {
                    sendEmailNotification(assignee, { title: title, description: description, priority: priority, dueDate: dueDate });
                }
            }
        } else {
            if (status === 'reports') {
                saveReport({
                    id: generateId(),
                    title: title,
                    description: description,
                    priority: priority,
                    reportNumber: computeReportNumber(),
                    dueDate: dueDate,
                    assignedTo: assignee || '',
                    createdBy: currentUser.login,
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            } else {
                var newTask = addTask({
                    title: title,
                    description: description,
                    status: status,
                    priority: priority,
                    dueDate: dueDate,
                    assignee: assignee || ''
                });
                if (assignee) {
                    sendEmailNotification(assignee, newTask);
                }
            }
        }
        taskModal.classList.remove('active');
    });
```

(Использует `currentItemMode`, объявленный в Step 1 этой задачи.)

- [ ] **Step 3: Обработка «Срочно/В работе» в `reportForm` submit**

Заменить всё тело обработчика `reportForm.addEventListener('submit', ...)` (строки 1524-1560) на:

```js
    reportForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var id = reportId.value;
        var title = reportTitle.value.trim();
        if (!title) return;
        var desc = reportDesc.value.trim();
        var priority = reportPriority.value;
        var dueDate = reportDueDate.value;
        var assignee = reportAssignee.value;
        var reportStatus = document.getElementById('reportStatus').value;

        if (reportStatus === 'urgent' || reportStatus === 'in_progress') {
            if (id) {
                var rep = reports.find(function(r) { return r.id === id; });
                if (rep) {
                    reportToTask(rep, reportStatus).then(function() { removeReport(rep.id); });
                }
            } else {
                reportToTask({
                    title: title,
                    description: desc,
                    priority: priority,
                    dueDate: dueDate,
                    assignedTo: assignee || '',
                    createdBy: currentUser.login,
                    createdAt: new Date().toISOString()
                }, reportStatus);
            }
            reportModal.classList.remove('active');
            return;
        }

        if (id) {
            var rep2 = reports.find(function(r) { return r.id === id; });
            if (!rep2) return;
            saveReport(Object.assign({}, rep2, {
                title: title,
                description: desc,
                priority: priority,
                dueDate: dueDate,
                assignedTo: assignee || '',
                updatedAt: new Date().toISOString()
            }));
        } else {
            saveReport({
                id: generateId(),
                title: title,
                description: desc,
                priority: priority,
                reportNumber: computeReportNumber(),
                dueDate: dueDate,
                assignedTo: assignee || '',
                createdBy: currentUser.login,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        reportModal.classList.remove('active');
    });
```

- [ ] **Step 4: Проверка синтаксиса**

Run: `node --check app.js`
Expected: нет вывода.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: task-to-report and report-to-task conversion"
```

---

### Task 6: Режим «Задача | Отчёт» и кнопки добавления

**Files:**
- Modify: `app.js` (глобальные переменные ~строки 177-201; `openTaskModal` 1478-1500; `openReportModal` 1502-1522; обработчики кнопок 1612-1621, 1631-1635)

**Interfaces:**
- Consumes: классы из Task 1 (`strip-ok`, `strip-warn`, `strip-orange`, `strip-coral`, `strip-red`, `strip-overdue`, `strip-none`), разметка из Task 2.
- Produces: `currentItemMode` ('task' | 'report') — уже объявлен в Task 5; DOM-ссылки `itemTypeToggle`, `taskStatusGroup`; `openTaskModal(taskData, x, y, mode)` с режимом.

- [ ] **Step 1: Объявить DOM-ссылки переключателя**

После строки 201 (блок DOM-элементов, после `const newPassword = ...`) вставить:

```js
    const itemTypeToggle = document.getElementById('itemTypeToggle');
    const taskStatusGroup = document.getElementById('taskStatusGroup');
```

- [ ] **Step 2: Переписать `openTaskModal` с параметром `mode`**

Заменить строки 1478-1500:

```js
    function openTaskModal(taskData, x, y) {
        if (taskData) {
            modalTitle.textContent = 'Редактировать задачу';
            taskId.value = taskData.id;
            taskTitle.value = taskData.title;
            taskDesc.value = taskData.description || '';
            taskStatus.value = taskData.status || 'in_progress';
            taskPriority.value = taskData.priority || 'medium';
            taskDueDate.value = taskData.dueDate || '';
            taskAssignee.value = taskData.assignedTo || '';
        } else {
            modalTitle.textContent = 'Новая задача';
            taskId.value = '';
            taskTitle.value = '';
            taskDesc.value = '';
            taskStatus.value = 'in_progress';
            taskPriority.value = 'medium';
            taskDueDate.value = '';
            taskAssignee.value = '';
        }
        taskModal.classList.add('active');
        positionModalAtPoint(taskModal, x, y);
    }
```

на:

```js
    function openTaskModal(taskData, x, y, mode) {
        currentItemMode = mode || 'task';
        if (taskData) currentItemMode = 'task';
        var isReport = currentItemMode === 'report';
        if (itemTypeToggle) {
            itemTypeToggle.querySelectorAll('.item-type-btn').forEach(function(btn) {
                btn.classList.toggle('active', btn.dataset.type === currentItemMode);
            });
        }
        if (taskStatusGroup) {
            taskStatusGroup.style.display = isReport ? 'none' : '';
        }
        if (isReport) {
            modalTitle.textContent = 'Новый отчёт';
            taskId.value = '';
            taskTitle.value = '';
            taskDesc.value = '';
            taskStatus.value = 'reports';
            taskPriority.value = 'medium';
            taskDueDate.value = '';
            taskAssignee.value = '';
        } else if (taskData) {
            modalTitle.textContent = 'Редактировать задачу';
            taskId.value = taskData.id;
            taskTitle.value = taskData.title;
            taskDesc.value = taskData.description || '';
            taskStatus.value = taskData.status || 'in_progress';
            taskPriority.value = taskData.priority || 'medium';
            taskDueDate.value = taskData.dueDate || '';
            taskAssignee.value = taskData.assignedTo || '';
        } else {
            modalTitle.textContent = 'Новая задача';
            taskId.value = '';
            taskTitle.value = '';
            taskDesc.value = '';
            taskStatus.value = 'in_progress';
            taskPriority.value = 'medium';
            taskDueDate.value = '';
            taskAssignee.value = '';
        }
        taskModal.classList.add('active');
        positionModalAtPoint(taskModal, x, y);
    }
```

- [ ] **Step 3: Сброс статуса отчёта при открытии**

В `openReportModal`, в ветке `if (reportData)` добавить после `reportAssignee.value = ...` (строка 1510):

```js
            document.getElementById('reportStatus').value = 'reports';
```

и в ветке `else` (после строки 1518, перед `reportModal.classList.add`):

```js
            document.getElementById('reportStatus').value = 'reports';
```

- [ ] **Step 4: Переключатель внутри модалки**

После объявления `openTaskModal` (после строки 1522) вставить обработчик переключателя:

```js
    if (itemTypeToggle) {
        itemTypeToggle.addEventListener('click', function(e) {
            var btn = e.target.closest('.item-type-btn');
            if (!btn) return;
            currentItemMode = btn.dataset.type;
            itemTypeToggle.querySelectorAll('.item-type-btn').forEach(function(b) {
                b.classList.toggle('active', b === btn);
            });
            if (taskStatusGroup) {
                taskStatusGroup.style.display = currentItemMode === 'report' ? 'none' : '';
            }
            modalTitle.textContent = currentItemMode === 'report' ? 'Новый отчёт' : 'Новая задача';
        });
    }
```

- [ ] **Step 5: Кнопки добавления**

Заменить обработчик `addTaskBtn` (строки 1612-1614):

```js
    addTaskBtn.addEventListener('click', function(e) {
        openTaskModal(null, e.clientX, e.clientY, 'task');
    });
```

Заменить обработчик `addReportBtn` (строки 1616-1621):

```js
    var addReportBtn = document.getElementById('addReportBtn');
    if (addReportBtn) {
        addReportBtn.addEventListener('click', function(e) {
            openTaskModal(null, e.clientX, e.clientY, 'report');
        });
    }
```

Заменить обработчик `mobileAddBtn` (строки 1631-1635):

```js
    if (mobileAddBtn) {
        mobileAddBtn.addEventListener('click', function(e) {
            openTaskModal(null, e.clientX, e.clientY, 'task');
        });
    }
```

- [ ] **Step 6: Проверка синтаксиса**

Run: `node --check app.js`
Expected: нет вывода.

Run: `node --test "tests/*.test.js"`
Expected: 5 тестов PASS.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: task/report mode toggle in add modal"
```

---

### Task 7: Сквозная ручная проверка

**Files:** нет изменений — сквозная ручная проверка результата.

- [ ] **Step 1: Проверить полоски срока на доске**

Создать задачи сроками: через 6+ дней (зелёная), 4-5 дней (зелёно-жёлтая), 3 дня (оранжевая), 2 дня (коралловая), 1 день (огненно-рыжая), на сегодня (бордовая), без срока (серая). Проверить на карточках задач и отчётов.

- [ ] **Step 2: Проверить конверсию задача → отчёт**

Создать задачу со статусом «Отчёт» — должна появиться в колонке «Отчёты» с номером и без записи в задачах. У существующей задачи в настройках сменить статус на «Отчёт» — задача исчезает из колонки, появляется отчёт.

- [ ] **Step 3: Проверить конверсию отчёт → задача**

Открыть отчёт (⚙️), выбрать статус «Срочные» — отчёт исчезает, в колонке «Срочные» появляется задача с тем же содержимым. Повторить со статусом «В работе».

- [ ] **Step 4: Проверить переключатель «Задача | Отчёт»**

Кнопка «➕ Новая задача» и мобильная ➕ открывают модалку с переключателем. Режим «Отчёт» скрывает поле статуса и создаёт отчёт. Кнопка ➕ в шапке «Отчёты» сразу открывает режим «Отчёт».

- [ ] **Step 5: Проверить выполненные записи в архиве**

Выполнить задачу со сроком в будущем — в архиве светло-зелёный фон и зелёная полоска. Выполнить задачу после срока — фон светло-зелёный, полоска бордовая. Отчёты — аналогично. Проверить «Вернуть» (задача возвращается на доску, полоска считается заново).

- [ ] **Step 6: Зафиксировать результат**

Если в ходе проверки вносились правки — закоммитить их с сообщением `fix: manual verification fixes`. Если правок не было — коммит не требуется.
