# Отчёты, архив, сортировка по сроку, модалки под курсором — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить колонку «Выполнено» на блок «Отчёты», добавить архив (модальное окно с поиском и выгрузкой), сортировать задачи и отчёты по сроку, а на ПК открывать модальные окна под курсором.

**Architecture:** Отчёты хранятся в отдельной коллекции Firebase `teams/<TEAM_ID>/reports` (свой listener, отдельный рендер) — логика задач не затрагивается. Выполненные задачи и отчёты (status `done`) показываются в модальном окне архива. Позиционирование модалок на ПК — inline-стили `.modal-content` по координатам клика; на мобильных — прежнее центрирование.

**Tech Stack:** vanilla JS (IIFE, `'use strict'`), Firebase Realtime Database, SheetJS (XLSX), HTML/CSS. Тестового фреймворка нет — проверка вручную через `index.html`.

## Global Constraints

- Приложение: PWA без сборки; открывается файлом `index.html`, логин admin/admin.
- Стиль кода: ES5-совместимый JS внутри одного IIFE в `app.js`, никаких модулей/импортов.
- Без комментариев в коде (кроме существующих).
- Русский текст интерфейса; эмодзи в интерфейсе допустимы (используются в проекте).
- Поля задач и отчётов сохраняются в Firebase как есть (без миграций).
- Каждая задача завершается ручной проверкой в браузере (шаги «Verify») и коммитом.

---

### Task 1: Слой данных отчётов (listener + save/remove)

**Files:**
- Modify: `app.js` (глобальные переменные, Firebase-пути, `initFirebaseListeners`, logout)

**Interfaces:**
- Produces: глобальный массив `reports`; функции `getReportsRef()`, `saveReport(report)`, `removeReport(reportId)`, `changeReportStatus(id, status)`.

- [ ] **Step 1: Добавить состояние и Firebase-путь**

В `app.js` рядом с `let tasks = [];` (строка ~11) добавьте `let reports = [];`.

Рядом с `getUsersRef()` (строка ~159) добавьте:

```js
function getReportsRef() {
    return firebase.database().ref('teams/' + TEAM_ID + '/reports');
}
```

- [ ] **Step 2: Добавить listener отчётов в `initFirebaseListeners`**

После блока `getUsersRef().on('value', ...)` (перед закрывающей скобкой функции `initFirebaseListeners`, строка ~291) добавьте:

```js
getReportsRef().on('value', function(snapshot) {
    var data = snapshot.val();
    reports = data ? Object.values(data) : [];
    reports = reports.map(function(r) {
        return Object.assign({}, r, {
            status: r.status || 'active',
            title: r.title || '',
            description: r.description || '',
            period: r.period || '',
            reportNumber: r.reportNumber || 0,
            dueDate: r.dueDate || '',
            createdBy: r.createdBy || ''
        });
    });
    if (initialLoadDone) renderBoard();
});
```

- [ ] **Step 3: Сброс при выходе**

В обработчике `logoutBtn` (строка ~545) после `getUsersRef().off();` добавьте:

```js
getReportsRef().off();
```

и после `tasks = ...`-сбросов в том же обработчике — `reports = [];`.

- [ ] **Step 4: Функции записи отчётов**

Рядом с `removeTask` (строка ~375) добавьте:

```js
function saveReport(report) {
    return getReportsRef().child(report.id).set(report)
        .then(function() {
            console.log('Отчёт сохранён:', report.id);
            return report;
        })
        .catch(function(error) {
            console.error('Ошибка сохранения отчёта:', error);
            alert('Ошибка сохранения отчёта: ' + error.message);
            throw error;
        });
}

function removeReport(reportId) {
    getReportsRef().child(reportId).remove();
}

function changeReportStatus(id, newStatus) {
    var report = reports.find(function(r) { return r.id === id; });
    if (!report) return;
    saveReport(Object.assign({}, report, {
        status: newStatus,
        updatedAt: new Date().toISOString()
    }));
}
```

- [ ] **Step 5: Verify**

Откройте `index.html`, войдите admin/admin, в консоли браузера (F12 → Console) проверьте:

```js
firebase.database().ref('teams/team_main/reports').push().set({id:'x', status:'active'}).then(function(){ console.log('ok'); });
```

Ожидание: в консоли `ok`; после перезагрузки страницы в `app.js` переменная `reports` содержит запись. Запишите тестовую запись с ключом `id:'x'`, потом удалите её через консоль:

```js
firebase.database().ref('teams/team_main/reports').child('x').remove();
```

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: add reports data layer with firebase listener"
```

---

### Task 2: Разметка доски, кнопки «Архив», селект статусов

**Files:**
- Modify: `index.html`
- Modify: `style.css`

**Interfaces:**
- Consumes: —
- Produces: элементы `#list_reports`, `#count_reports`, `#addReportBtn`, `#archiveBtn`, `#mobileArchiveBtn`, `#archiveModal`, `#archiveSearch`, `#archiveExportBtn`, `.archive-tab`, `#archiveList`.

- [ ] **Step 1: Заменить колонку «Выполнено» на «Отчёты»**

В `index.html` замените блок колонки `data-status="done"` (строки 106–112) на:

```html
<div class="column" data-status="reports">
    <div class="column-header">
        <h3>📄 Отчёты</h3>
        <div class="column-header-actions">
            <button id="addReportBtn" class="column-add-btn" title="Новый отчёт">➕</button>
            <span class="count" id="count_reports">0</span>
        </div>
    </div>
    <div class="task-list" id="list_reports"></div>
</div>
```

- [ ] **Step 2: Убрать «Выполнено» из статусов задачи**

В `index.html` из `<select id="taskStatus">` удалите строку `<option value="done">Выполнено</option>` (строка 136).

- [ ] **Step 3: Кнопка «Архив» в панели инструментов**

В `index.html` после кнопки `manageUsersBtn` (строка 74) добавьте:

```html
<button id="archiveBtn" class="btn outline btn-sm">🗂 Архив</button>
```

- [ ] **Step 4: Кнопка «Архив» в мобильной панели**

В `index.html` в `.mobile-bar` перед кнопкой настроек (строка 81) добавьте:

```html
<button id="mobileArchiveBtn" class="mobile-bar-btn" title="Архив">🗂</button>
```

- [ ] **Step 5: Разметка модального окна архива**

В `index.html` после закрытия `#usersModal` (перед закрытием `</div>` приложения, строка 187) добавьте:

```html
<!-- Модальное окно архива -->
<div id="archiveModal" class="modal">
    <div class="modal-content archive-content">
        <span class="close-modal">&times;</span>
        <h3>🗂 Архив</h3>
        <div class="archive-toolbar">
            <div class="archive-tabs">
                <button class="archive-tab active" data-tab="tasks">Задачи</button>
                <button class="archive-tab" data-tab="reports">Отчёты</button>
            </div>
            <input type="text" id="archiveSearch" placeholder="Поиск…">
            <button id="archiveExportBtn" class="btn secondary btn-sm">📤 Выгрузить Excel</button>
        </div>
        <div id="archiveList" class="archive-list"></div>
    </div>
</div>
```

- [ ] **Step 6: Стили**

В `style.css` после блока `.column-header .count` (строка ~301) добавьте:

```css
.column-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.column-add-btn {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 0.5rem;
    background: #dbeafe;
    color: #1e40af;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
}
.column-add-btn:hover {
    background: #bfdbfe;
}
```

В конец `style.css` добавьте стили архива:

```css
/* ===== ARCHIVE ===== */
.archive-content {
    max-width: 640px !important;
}
.archive-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
}
.archive-tabs {
    display: flex;
    gap: 0.25rem;
}
.archive-tab {
    padding: 0.4rem 1rem;
    border: 1px solid #e2e8f0;
    background: #f1f5f9;
    border-radius: 0.6rem;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.archive-tab:hover {
    background: #e2e8f0;
}
.archive-tab.active {
    background: #2563eb;
    color: #fff;
    border-color: #2563eb;
}
#archiveSearch {
    flex: 1;
    min-width: 160px;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.6rem;
    font-size: 0.9rem;
}
#archiveSearch:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.2);
}
.archive-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 55vh;
    overflow-y: auto;
}
.archive-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 0.6rem 0.75rem;
}
.archive-row-main {
    min-width: 0;
}
.archive-row-actions {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
    flex-wrap: wrap;
}
.btn-archived {
    background: #cbd5e1;
    color: #475569;
    border: none;
    padding: 0.3rem 0.6rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}
.btn-archived:hover {
    background: #94a3b8;
    color: #1e293b;
}
.archive-empty {
    color: #94a3b8;
    font-size: 0.9rem;
    text-align: center;
    padding: 1rem 0;
}
```

- [ ] **Step 7: Verify**

Откройте `index.html`. Ожидание:
- На доске три колонки: «Срочные», «В работе», «📄 Отчёты» (с кнопкой ➕ и счётчиком).
- В панели инструментов кнопка «🗂 Архив», в мобильной панели (при узком окне) — иконка 🗂.
- В форме задачи в выпадающем «Статус» только «Срочные» и «В работе».
- По нажатию «🗂 Архив» открывается модальное окно со вкладками «Задачи»/«Отчёты», поиском и кнопкой выгрузки (без контента — список появится в Task 7).

- [ ] **Step 8: Commit**

```bash
git add index.html style.css
git commit -m "feat: add reports column, archive button and archive modal markup"
```

---

### Task 3: Сортировка задач по сроку

**Files:**
- Modify: `app.js` (`renderBoard`, строка ~796)

**Interfaces:**
- Consumes: —
- Produces: функция `sortByDueDate(a, b)`, вызов `renderReports()` из `renderBoard`.

- [ ] **Step 1: Добавить вспомогательные функции**

Рядом с `formatUserName` (строка ~1345) добавьте:

```js
function sortByDueDate(a, b) {
    var aDue = a.dueDate ? new Date(a.dueDate).getTime() : null;
    var bDue = b.dueDate ? new Date(b.dueDate).getTime() : null;
    if (aDue === null && bDue === null) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
    if (aDue === null) return 1;
    if (bDue === null) return -1;
    if (aDue !== bDue) return aDue - bDue;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' + d.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
}
```

- [ ] **Step 2: Заменить сортировку колонок и добавить рендер отчётов**

В `renderBoard` (строка ~796) замените блок с `const columns = ['urgent', 'in_progress', 'done'];` (строки 808–830) на:

```js
const columns = ['urgent', 'in_progress'];
columns.forEach(function(status) {
    const list = document.getElementById('list_' + status);
    const countEl = document.getElementById('count_' + status);
    if (!list || !countEl) return;
    const filtered = userTasks.filter(function(t) { return t.status === status; });
    filtered.sort(sortByDueDate);
    countEl.textContent = filtered.length;
    list.innerHTML = '';
    if (filtered.length === 0) {
        list.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem;text-align:center;padding:1rem 0;">Нет задач</p>';
        return;
    }
    filtered.forEach(function(task) {
        list.appendChild(createTaskCard(task));
    });
});
renderReports();
```

- [ ] **Step 3: Защитить архивированные задачи от автоперевода в «Срочно»**

В `renderBoard` строку:

```js
if (t.priority === 'high' && t.status !== 'urgent') {
    t.status = 'urgent';
}
```

замените на:

```js
if (t.priority === 'high' && t.status !== 'urgent' && t.status !== 'done') {
    t.status = 'urgent';
}
```

- [ ] **Step 4: Verify**

Откройте `index.html` (admin/admin). Создайте три задачи в «В работе» со сроками: сегодня 18:00, завтра 09:00, без срока. Ожидание: в колонке порядок — сегодня, завтра, без срока (снизу). Установите на первую задачу приоритет «Высокий» — она перейдёт в «Срочные», порядок в «В работе» сохранится по сроку.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: sort tasks by due date within columns"
```

---

### Task 4: Модальное окно отчёта (создание/редактирование) и нумерация

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `saveReport`, `reports`, `computeReportNumber` (создаётся здесь), `generateId`, `currentUser`, `positionModalAtPoint` (Task 8 — заглушка не нужна, вызов добавить сейчас, функцию определит Task 8).
- Produces: `formatPeriod(period)`, `computeReportNumber(period)`, `openReportModal(reportDataOrNull, x, y)`, `addReportBtn`-обработчик.

- [ ] **Step 1: Хелперы формата периода и номера**

Рядом с `sortByDueDate` добавьте:

```js
function formatPeriod(period) {
    if (!period) return '';
    var m = new Date(period + '-01T00:00:00');
    if (isNaN(m.getTime())) return period;
    return m.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function computeReportNumber(period) {
    var max = 0;
    reports.forEach(function(r) {
        if (r.period === period && r.reportNumber > max) max = r.reportNumber;
    });
    return max + 1;
}
```

- [ ] **Step 2: Модальное окно отчёта**

Рядом с `openTaskModal` (строка ~1118) добавьте функцию:

```js
function openReportModal(reportData, x, y) {
    var editing = !!reportData;
    var modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML =
        '<div class="modal-content report-modal" style="max-width:420px;">' +
            '<span class="close-modal">&times;</span>' +
            '<h3>' + (editing ? 'Редактировать отчёт' : 'Новый отчёт') + '</h3>' +
            '<form id="reportForm">' +
                '<input type="hidden" id="reportId" value="' + (editing ? escapeHtml(reportData.id) : '') + '">' +
                '<div class="form-group">' +
                    '<label for="reportTitle">Название *</label>' +
                    '<input type="text" id="reportTitle" value="' + (editing ? escapeHtml(reportData.title || '') : '') + '" required>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label for="reportDesc">Описание</label>' +
                    '<textarea id="reportDesc" rows="3">' + (editing ? escapeHtml(reportData.description || '') : '') + '</textarea>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label for="reportPeriod">Месяц</label>' +
                    '<input type="month" id="reportPeriod" value="' + (editing ? (reportData.period || '') : '') + '" required>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label for="reportDueDate">Срок сдачи</label>' +
                    '<input type="datetime-local" id="reportDueDate" step="900" value="' + (editing ? (reportData.dueDate || '') : '') + '">' +
                '</div>' +
                '<button type="submit" class="btn primary">Сохранить</button>' +
            '</form>' +
        '</div>';
    document.body.appendChild(modal);
    if (positionModalAtPoint) positionModalAtPoint(modal, x, y);

    modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    modal.querySelector('#reportForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var id = modal.querySelector('#reportId').value;
        var title = modal.querySelector('#reportTitle').value.trim();
        var desc = modal.querySelector('#reportDesc').value.trim();
        var period = modal.querySelector('#reportPeriod').value;
        var dueDate = modal.querySelector('#reportDueDate').value;
        if (!title) return;
        if (id) {
            var rep = reports.find(function(r) { return r.id === id; });
            if (!rep) return;
            saveReport(Object.assign({}, rep, {
                title: title,
                description: desc,
                period: period,
                dueDate: dueDate,
                updatedAt: new Date().toISOString()
            }));
        } else {
            saveReport({
                id: generateId(),
                title: title,
                description: desc,
                period: period,
                reportNumber: computeReportNumber(period),
                dueDate: dueDate,
                createdBy: currentUser.login,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        modal.remove();
    });
}
```

- [ ] **Step 3: Обработчик кнопки «➕»**

Рядом с `addTaskBtn.addEventListener` (строка ~1191) добавьте:

```js
var addReportBtn = document.getElementById('addReportBtn');
if (addReportBtn) {
    addReportBtn.addEventListener('click', function(e) {
        openReportModal(null, e.clientX, e.clientY);
    });
}
```

- [ ] **Step 4: Verify**

Откройте `index.html` (admin/admin). Нажмите «➕» в колонке «Отчёты». Ожидание: открывается модальное окно «Новый отчёт» с полями Название, Описание, Месяц, Срок сдачи. Создайте два отчёта за «2026-08». Ожидание: у первого номер №1, у второго №2 (видно после Task 5 на карточках; сейчас проверьте в консоли `reports`). Войдите под сотрудником — отчёт также можно создать.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add report create/edit modal with monthly numbering"
```

---

### Task 5: Карточка отчёта и рендер колонки «Отчёты»

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `renderReports` (заглушка создаётся здесь), `reports`, `currentUser`, `sortByDueDate`, `formatPeriod`, `formatDateTime`, `escapeHtml`, `formatUserName`, `removeReport`, `changeReportStatus`, `openReportModal`, `showReportDetails` (Task 6), `positionModalAtPoint` (Task 8), `getTasksForUser`-логика видимости.
- Produces: `isMyReport(report)`, `createReportCard(report)`, `renderReports()`.

- [ ] **Step 1: Видимость и карточка отчёта**

Рядом с `createTaskCard` (строка ~837) добавьте:

```js
function isMyReport(report) {
    if (currentUser.role === 'admin') return true;
    return report.createdBy === currentUser.login;
}

function createReportCard(report) {
    const div = document.createElement('div');
    div.className = 'task-card report-card priority-medium';
    div.dataset.id = report.id;

    var periodLabel = formatPeriod(report.period);
    var numberLabel = report.reportNumber
        ? '№' + report.reportNumber + (periodLabel ? ' за ' + periodLabel : '')
        : 'Отчёт';

    div.innerHTML =
        '<div class="task-title">' + escapeHtml(report.title || 'Без названия') + '</div>' +
        '<div class="task-meta">' +
            '<span>📄 ' + escapeHtml(numberLabel) + '</span>' +
            (report.dueDate ? '<span>⏳ ' + formatDateTime(report.dueDate) + '</span>' : '') +
            '<span>👤 ' + escapeHtml(formatUserName(report.createdBy)) + '</span>' +
        '</div>' +
        '<div class="task-actions-row1">' +
            '<button class="btn-done" data-action="done">✅ В архив</button>' +
        '</div>' +
        '<div class="task-actions-row2">' +
            (currentUser.role === 'admin'
                ? '<button class="btn-delete" data-action="delete" title="Удалить">🗑</button>'
                : '') +
            '<button class="btn-settings" data-action="settings" title="Изменить">⚙️</button>' +
            '<button class="btn-open" data-action="open" title="Открыть">⭕</button>' +
        '</div>';

    div.querySelectorAll('[data-action]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var action = this.dataset.action;
            var x = e.clientX;
            var y = e.clientY;
            if (action === 'delete') {
                if (confirm('Удалить отчёт?')) {
                    removeReport(report.id);
                }
            } else if (action === 'done') {
                changeReportStatus(report.id, 'done');
            } else if (action === 'open') {
                showReportDetails(report, x, y);
            } else if (action === 'settings') {
                openReportModal(report, x, y);
            }
        });
    });

    return div;
}
```

- [ ] **Step 2: Рендер колонки отчётов**

Рядом с `createReportCard` добавьте:

```js
function renderReports() {
    const list = document.getElementById('list_reports');
    const countEl = document.getElementById('count_reports');
    if (!list || !countEl) return;
    const visible = reports.filter(function(r) {
        return r.status === 'active' && isMyReport(r);
    });
    visible.sort(sortByDueDate);
    countEl.textContent = visible.length;
    list.innerHTML = '';
    if (visible.length === 0) {
        list.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem;text-align:center;padding:1rem 0;">Нет отчётов</p>';
        return;
    }
    visible.forEach(function(r) {
        list.appendChild(createReportCard(r));
    });
}
```

- [ ] **Step 3: Verify**

Откройте `index.html` (admin/admin), создайте отчёты за август и сентябрь 2026. Ожидание: в колонке «📄 Отчёты» карточки с названием, номером («№1 за август 2026»), сроком и автором; порядок по сроку. Сотрудник (не админ): видит только свои отчёты, на карточке нет кнопки 🗑.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: render report cards in reports column"
```

---

### Task 6: Детали отчёта

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `reports`, `escapeHtml`, `formatPeriod`, `formatDateTime`, `formatUserName`, `positionModalAtPoint` (Task 8).
- Produces: `showReportDetails(report, x, y)`.

- [ ] **Step 1: Модалка деталей отчёта**

Рядом с `showTaskDetails` (строка ~996) добавьте:

```js
function showReportDetails(report, x, y) {
    var periodLabel = formatPeriod(report.period);
    var numberLabel = report.reportNumber
        ? '№' + report.reportNumber + (periodLabel ? ' за ' + periodLabel : '')
        : 'Отчёт';
    var modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML =
        '<div class="modal-content" style="max-width:450px;">' +
            '<span class="close-modal">&times;</span>' +
            '<h3>' + escapeHtml(report.title) + '</h3>' +
            '<div style="margin-top:1rem;font-size:0.95rem;color:#334155;">' +
                '<p><strong>Номер:</strong> ' + escapeHtml(numberLabel) + '</p>' +
                '<p><strong>Описание:</strong> ' + (report.description ? escapeHtml(report.description) : '<em>нет</em>') + '</p>' +
                (report.dueDate ? '<p><strong>Срок сдачи:</strong> ' + formatDateTime(report.dueDate) + '</p>' : '') +
                '<p><strong>Автор:</strong> ' + escapeHtml(formatUserName(report.createdBy)) + '</p>' +
                '<p><strong>Создан:</strong> ' + formatDateTime(report.createdAt) + '</p>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
    if (positionModalAtPoint) positionModalAtPoint(modal, x, y);
    modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}
```

- [ ] **Step 2: Verify**

Откройте `index.html` (admin/admin). Нажмите «⭕» на карточке отчёта. Ожидание: модальное окно с номером, описанием, сроком, автором и датой создания; закрывается по крестику и клику мимо окна.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add report details modal"
```

---

### Task 7: Модальное окно архива (вкладки, поиск, действия, выгрузка Excel)

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: элементы архива из Task 2 (`#archiveModal`, `#archiveSearch`, `#archiveExportBtn`, `#archiveList`, `.archive-tab`), `tasks`, `reports`, `currentUser`, `changeStatus`, `removeTask`, `removeReport`, `changeReportStatus`, `showTaskDetails`, `showReportDetails`, `formatDateTime`, `formatUserName`, `escapeHtml`, `formatPeriod`, `XLSX`, `positionModalAtPoint` (Task 8).
- Produces: `openArchive(x, y)`, `renderArchive()`, `createArchiveTaskRow(task)`, `createArchiveReportRow(report)`, обработчики `#archiveBtn`, `#mobileArchiveBtn`, табов, поиска, выгрузки.

- [ ] **Step 1: Открытие и переключение вкладок**

Рядом с `openManagePanel` (строка ~563) добавьте:

```js
var archiveTab = 'tasks';
var archiveModal = document.getElementById('archiveModal');

function openArchive(x, y) {
    if (!archiveModal) return;
    archiveTab = 'tasks';
    var search = document.getElementById('archiveSearch');
    if (search) search.value = '';
    archiveModal.querySelectorAll('.archive-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.tab === 'tasks');
    });
    archiveModal.classList.add('active');
    if (positionModalAtPoint) positionModalAtPoint(archiveModal, x, y);
    renderArchive();
}

function renderArchive() {
    var list = document.getElementById('archiveList');
    if (!list) return;
    var search = (document.getElementById('archiveSearch').value || '').trim().toLowerCase();
    list.innerHTML = '';
    if (archiveTab === 'tasks') {
        var archivedTasks = tasks.filter(function(t) {
            if (t.status !== 'done') return false;
            if (currentUser.role === 'admin') return true;
            return t.createdBy === currentUser.login || t.assignedTo === currentUser.login;
        });
        if (search) {
            archivedTasks = archivedTasks.filter(function(t) {
                return (t.title || '').toLowerCase().indexOf(search) !== -1;
            });
        }
        if (archivedTasks.length === 0) {
            list.innerHTML = '<p class="archive-empty">Нет архивированных задач</p>';
            return;
        }
        archivedTasks.forEach(function(t) {
            list.appendChild(createArchiveTaskRow(t));
        });
    } else {
        var archivedReports = reports.filter(function(r) {
            if (r.status !== 'done') return false;
            if (currentUser.role === 'admin') return true;
            return r.createdBy === currentUser.login;
        });
        if (search) {
            archivedReports = archivedReports.filter(function(r) {
                var numberLabel = r.reportNumber
                    ? '№' + r.reportNumber + ' за ' + formatPeriod(r.period)
                    : '';
                var hay = (r.title || '').toLowerCase() + ' ' + numberLabel.toLowerCase();
                return hay.indexOf(search) !== -1;
            });
        }
        if (archivedReports.length === 0) {
            list.innerHTML = '<p class="archive-empty">Нет архивированных отчётов</p>';
            return;
        }
        archivedReports.forEach(function(r) {
            list.appendChild(createArchiveReportRow(r));
        });
    }
}
```

- [ ] **Step 2: Строки архива (кнопки серые с заливкой)**

Рядом с `renderArchive` добавьте:

```js
function createArchiveTaskRow(task) {
    var div = document.createElement('div');
    div.className = 'archive-row';
    div.innerHTML =
        '<div class="archive-row-main">' +
            '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
            '<div class="task-meta">' +
                (task.dueDate ? '<span>⏳ ' + formatDateTime(task.dueDate) + '</span>' : '') +
                '<span>👤 ' + escapeHtml(formatUserName(task.assignedTo)) + '</span>' +
            '</div>' +
        '</div>' +
        '<div class="archive-row-actions">' +
            '<button class="btn-archived" data-action="open" title="Открыть">⭕ Открыть</button>' +
            '<button class="btn-archived" data-action="restore" title="Вернуть на доску">↩ Вернуть</button>' +
            (currentUser.role === 'admin'
                ? '<button class="btn-archived" data-action="delete" title="Удалить">🗑 Удалить</button>'
                : '') +
        '</div>';
    div.querySelectorAll('[data-action]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            var action = this.dataset.action;
            var x = e.clientX;
            var y = e.clientY;
            if (action === 'open') {
                showTaskDetails(task, x, y);
            } else if (action === 'restore') {
                changeStatus(task.id, task.previousStatus || 'in_progress');
            } else if (action === 'delete') {
                if (confirm('Удалить задачу?')) {
                    removeTask(task.id);
                }
            }
        });
    });
    return div;
}

function createArchiveReportRow(report) {
    var periodLabel = formatPeriod(report.period);
    var numberLabel = report.reportNumber
        ? '№' + report.reportNumber + (periodLabel ? ' за ' + periodLabel : '')
        : 'Отчёт';
    var div = document.createElement('div');
    div.className = 'archive-row';
    div.innerHTML =
        '<div class="archive-row-main">' +
            '<div class="task-title">' + escapeHtml(report.title) + '</div>' +
            '<div class="task-meta">' +
                '<span>📄 ' + escapeHtml(numberLabel) + '</span>' +
                (report.dueDate ? '<span>⏳ ' + formatDateTime(report.dueDate) + '</span>' : '') +
            '</div>' +
        '</div>' +
        '<div class="archive-row-actions">' +
            '<button class="btn-archived" data-action="open" title="Открыть">⭕ Открыть</button>' +
            '<button class="btn-archived" data-action="restore" title="Вернуть на доску">↩ Вернуть</button>' +
            (currentUser.role === 'admin'
                ? '<button class="btn-archived" data-action="delete" title="Удалить">🗑 Удалить</button>'
                : '') +
        '</div>';
    div.querySelectorAll('[data-action]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            var action = this.dataset.action;
            var x = e.clientX;
            var y = e.clientY;
            if (action === 'open') {
                showReportDetails(report, x, y);
            } else if (action === 'restore') {
                changeReportStatus(report.id, 'active');
            } else if (action === 'delete') {
                if (confirm('Удалить отчёт?')) {
                    removeReport(report.id);
                }
            }
        });
    });
    return div;
}
```

- [ ] **Step 3: Обработчики (кнопки, табы, поиск, выгрузка)**

Рядом с `manageUsersBtn.addEventListener('click', openManagePanel);` (строка ~589) добавьте:

```js
var archiveBtn = document.getElementById('archiveBtn');
if (archiveBtn) {
    archiveBtn.addEventListener('click', function(e) {
        openArchive(e.clientX, e.clientY);
    });
}
var mobileArchiveBtn = document.getElementById('mobileArchiveBtn');
if (mobileArchiveBtn) {
    mobileArchiveBtn.addEventListener('click', function(e) {
        openArchive(e.clientX, e.clientY);
    });
}
```

Рядом с «Закрытие модальных окон» (строка ~778) добавьте:

```js
if (archiveModal) {
    archiveModal.querySelectorAll('.archive-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            archiveTab = this.dataset.tab;
            archiveModal.querySelectorAll('.archive-tab').forEach(function(t) {
                t.classList.toggle('active', t === tab);
            });
            renderArchive();
        });
    });
    var archiveSearch = document.getElementById('archiveSearch');
    if (archiveSearch) {
        archiveSearch.addEventListener('input', renderArchive);
    }
    var archiveExportBtn = document.getElementById('archiveExportBtn');
    if (archiveExportBtn) {
        archiveExportBtn.addEventListener('click', exportArchiveExcel);
    }
    var archiveClose = archiveModal.querySelector('.close-modal');
    if (archiveClose) {
        archiveClose.addEventListener('click', function() {
            archiveModal.classList.remove('active');
        });
    }
}
```

- [ ] **Step 4: Выгрузка Excel из архива**

Рядом с обработчиком `exportBtn` (строка ~1244) добавьте:

```js
function exportArchiveExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Библиотека XLSX не загружена. Проверьте интернет-соединение.');
        return;
    }
    var rows = [];
    var archivedTasks = tasks.filter(function(t) {
        if (t.status !== 'done') return false;
        if (currentUser.role === 'admin') return true;
        return t.createdBy === currentUser.login || t.assignedTo === currentUser.login;
    });
    archivedTasks.forEach(function(t) {
        rows.push({
            'Тип': 'Задача',
            'Заголовок': t.title,
            'Описание': t.description || '',
            'Срок': t.dueDate ? formatDateTime(t.dueDate) : '',
            'Создал': formatUserName(t.createdBy),
            'Исполнитель': formatUserName(t.assignedTo)
        });
    });
    var archivedReports = reports.filter(function(r) {
        if (r.status !== 'done') return false;
        if (currentUser.role === 'admin') return true;
        return r.createdBy === currentUser.login;
    });
    archivedReports.forEach(function(r) {
        rows.push({
            'Тип': 'Отчёт',
            'Заголовок': r.title,
            'Описание': r.description || '',
            'Срок': r.dueDate ? formatDateTime(r.dueDate) : '',
            'Создал': formatUserName(r.createdBy),
            'Исполнитель': r.period ? formatPeriod(r.period) : ''
        });
    });
    if (rows.length === 0) {
        alert('Нет элементов в архиве для выгрузки');
        return;
    }
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{wch:8},{wch:30},{wch:40},{wch:15},{wch:12},{wch:15}];
    XLSX.utils.book_append_sheet(wb, ws, 'Архив');
    XLSX.writeFile(wb, 'Архив_' + new Date().toISOString().slice(0,10) + '.xlsx');
}
```

- [ ] **Step 5: Verify**

Откройте `index.html` (admin/admin):
1. Выполните задачу («✅ Выполнить») — она исчезает с доски.
2. «🗂 Архив» → вкладка «Задачи»: задача присутствует, кнопки серые с заливкой («⭕ Открыть», «↩ Вернуть», «🗑 Удалить»).
3. «↩ Вернуть» — задача возвращается в «В работе» (или previousStatus).
4. Снова «✅ Выполнить», затем «🗑 Удалить» — с подтверждением, задача удалена.
5. Отправьте отчёт в архив («✅ В архив»), откройте архив → вкладка «Отчёты»: отчёт есть, кнопки серые; «↩ Вернуть» возвращает его в «Отчёты».
6. Поиск по названию фильтрует список; кнопка «📤 Выгрузить Excel» скачивает файл `.xlsx` с колонками Тип/Заголовок/Описание/Срок/Создал/Исполнитель.
7. Войдите под сотрудником: архив показывает только свои задачи/отчёты, кнопки удаления нет.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: add archive modal with tabs, search and excel export"
```

---

### Task 8: Позиционирование модальных окон под курсором на ПК

**Files:**
- Modify: `app.js` (новая функция + передачи координат в открывающие функции)

**Interfaces:**
- Consumes: события кликов (клиенты передают `x`/`y`).
- Produces: `positionModalAtPoint(modal, x, y)`; обновлённые сигнатуры `openTaskModal(data, x, y)`, `showTaskDetails(task, x, y)`, `showDelegateModal(taskId, x, y)`, `openEditUserModal(login, x, y)`, `openManagePanel(x, y)`.

- [ ] **Step 1: Функция позиционирования**

Рядом с `escapeHtml` (строка ~1339) добавьте:

```js
function positionModalAtPoint(modal, x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (!finePointer) return;
    var content = modal.querySelector('.modal-content');
    if (!content) return;
    content.style.position = 'fixed';
    content.style.margin = '0';
    content.style.maxHeight = '90vh';
    content.style.overflowY = 'auto';
    var w = content.offsetWidth;
    var h = content.offsetHeight;
    var pad = 8;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left = Math.min(x + pad, vw - w - pad);
    var top = Math.min(y + pad, vh - h - pad);
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    content.style.left = left + 'px';
    content.style.top = top + 'px';
}
```

- [ ] **Step 2: Обновить открывающие функции**

В `openTaskModal` (строка ~1118) в конец добавьте:

```js
taskModal.classList.add('active');
positionModalAtPoint(taskModal, x, y);
```

и замените сигнатуру на `function openTaskModal(taskData, x, y) {`.

В `showTaskDetails` (строка ~996) замените сигнатуру на `function showTaskDetails(task, x, y) {`, а строку `document.body.appendChild(modal);` дополните:

```js
document.body.appendChild(modal);
positionModalAtPoint(modal, x, y);
```

В `showDelegateModal` (строка ~1026) замените сигнатуру на `function showDelegateModal(taskId, x, y) {`, а после `document.body.appendChild(modal);` добавьте `positionModalAtPoint(modal, x, y);`.

В `openEditUserModal` (строка ~612) замените сигнатуру на `function openEditUserModal(login, x, y) {`, а после `document.body.appendChild(modal);` (строка ~656) добавьте `positionModalAtPoint(modal, x, y);`.

В `openManagePanel` (строка ~563) замените сигнатуру на `function openManagePanel(x, y) {`, а после `usersModal.classList.add('active');` (строка ~581) добавьте `positionModalAtPoint(usersModal, x, y);`.

- [ ] **Step 3: Обновить вызовы**

В `createTaskCard` в обработчике кликов (строка ~873) замените `var action = this.dataset.action;` на:

```js
var action = this.dataset.action;
var x = e.clientX;
var y = e.clientY;
```

и вызовы внутри блока `if`:

```js
} else if (action === 'done') {
    changeStatus(task.id, 'done');
} else if (action === 'restore') {
    changeStatus(task.id, task.previousStatus || 'in_progress');
} else if (action === 'delegate') {
    showDelegateModal(task.id, x, y);
} else if (action === 'open') {
    showTaskDetails(task, x, y);
} else if (action === 'settings') {
    if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
        alert('Вы не можете редактировать эту задачу');
        return;
    }
    openTaskModal(task, x, y);
}
```

В обработчике `dblclick` карточки (строка ~902) замените вызов:

```js
openTaskModal(task, e.clientX, e.clientY);
```

В `renderUsersList` (строка ~605) замените:

```js
btn.addEventListener('click', function() {
    openEditUserModal(this.dataset.login);
});
```

на:

```js
btn.addEventListener('click', function(e) {
    openEditUserModal(this.dataset.login, e.clientX, e.clientY);
});
```

В `manageUsersBtn` (строка ~589) замените `manageUsersBtn.addEventListener('click', openManagePanel);` на:

```js
manageUsersBtn.addEventListener('click', function(e) {
    openManagePanel(e.clientX, e.clientY);
});
```

В мобильной кнопке (строка ~1207) замените `mobileManageBtn.addEventListener('click', openManagePanel);` на:

```js
mobileManageBtn.addEventListener('click', function(e) {
    openManagePanel(e.clientX, e.clientY);
});
```

В `addTaskBtn` (строка ~1191) и `mobileAddBtn` (строка ~1204) добавьте передачу координат:

```js
addTaskBtn.addEventListener('click', function(e) {
    openTaskModal(null, e.clientX, e.clientY);
});
```

```js
mobileAddBtn.addEventListener('click', function(e) {
    openTaskModal(null, e.clientX, e.clientY);
});
```

- [ ] **Step 4: Verify**

Откройте `index.html` на ПК (admin/admin):
- Нажмите «➕ Новая задача», «⚙️» на карточке, «⭕» на карточке, «📤 Делегировать», «👥 Управление», «🗂 Архив» — каждое окно открывается рядом с местом клика (под курсором), не вылезает за края экрана. Окно у правого/нижнего края сдвигается внутрь.
- Уменьшите окно браузера до мобильной ширины (<768px): окна открываются по центру экрана как раньше.
- Задача/отчёт не редактируются через «⚙️» не-админом (прежнее предупреждение).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: position modal windows under cursor on desktop"
```

---

### Task 9: Ограничения drag & drop и финальные проверки

**Files:**
- Modify: `app.js` (обработчики drag & drop, `createReportCard` уже не draggable)

**Interfaces:**
- Consumes: `handleDragStart`, `handleDragEnd`, `changeStatus`, `.task-list` колонок.

- [ ] **Step 1: Разрешить перетаскивание только между «Срочные» и «В работе»**

Замените блок (строки 927–952):

```js
document.querySelectorAll('.task-list').forEach(function(list) {
    list.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
    });
    list.addEventListener('dragleave', function(e) {
        this.classList.remove('drag-over');
    });
    list.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        if (!draggedTaskId) return;
        var column = this.closest('.column');
        if (!column) return;
        var newStatus = column.dataset.status;
        var task = tasks.find(function(t) { return t.id === draggedTaskId; });
        if (!task) return;
        if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login && task.assignedTo !== currentUser.login) {
            alert('Вы не можете изменять эту задачу');
            draggedTaskId = null;
            return;
        }
        changeStatus(draggedTaskId, newStatus);
        draggedTaskId = null;
    });
});
```

на:

```js
['list_urgent', 'list_in_progress'].forEach(function(listId) {
    var list = document.getElementById(listId);
    if (!list) return;
    list.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
    });
    list.addEventListener('dragleave', function(e) {
        this.classList.remove('drag-over');
    });
    list.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        if (!draggedTaskId) return;
        var column = this.closest('.column');
        if (!column) return;
        var newStatus = column.dataset.status;
        var task = tasks.find(function(t) { return t.id === draggedTaskId; });
        if (!task) return;
        if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login && task.assignedTo !== currentUser.login) {
            alert('Вы не можете изменять эту задачу');
            draggedTaskId = null;
            return;
        }
        changeStatus(draggedTaskId, newStatus);
        draggedTaskId = null;
    });
});
```

- [ ] **Step 2: Убедиться, что карточки отчётов не перетаскиваются**

В `createReportCard` (Task 5) не должен задаваться `div.draggable = true` — проверьте, что в коде карточки отчёта нет строки `draggable`. Если есть — удалите.

- [ ] **Step 3: Verify (полный сценарий)**

Откройте `index.html` (admin/admin) и пройдите весь сценарий:
1. Вход admin/admin, доска: «Срочные», «В работе», «📄 Отчёты».
2. Создайте задачи с разными сроками — сортировка по сроку в обеих колонках задач; задачи без срока внизу.
3. Перетащите задачу из «В работе» в «Срочные» — работает; попытка перетащить задачу в «Отчёты» — не работает (колонка не подсвечивается, задача не принимается).
4. Карточка отчёта не перетаскивается (перетаскивание не начинается).
5. «✅ Выполнить» → задача в архиве; «✅ В архив» на отчёте → отчёт в архиве.
6. Архив: вкладки, поиск, возврат, удаление (админ), выгрузка Excel.
7. На ПК модалки под курсором, на мобильной ширине — по центру.
8. Задача с высоким приоритетом в статусе «Выполнено» (в архиве) НЕ перескакивает в «Срочные» и остаётся в архиве.
9. Просроченная задача «В работе» через минуту автоматически уходит в «Срочные» (проверка автоперехода не сломана).

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: restrict drag-and-drop to task columns only"
```

---

## Self-Review

Спека покрыта: колонка «Отчёты» (Task 2), карточка/модалка отчёта и месячная нумерация (Task 4–6), архив с вкладками/поиском/выгрузкой и серыми кнопками (Task 7), сортировка по сроку (Task 3), позиционирование модалок под курсором на ПК (Task 8), drag & drop только между колонками задач (Task 9), защита архивированных задач от авто-перевода (Task 3). Реплейсментов нет — код приведён полностью. Сигнатуры согласованы между задачами (`openTaskModal(data, x, y)`, `showTaskDetails(task, x, y)`, `openManagePanel(x, y)`, `positionModalAtPoint(modal, x, y)`, `renderReports()`, `changeReportStatus(id, status)`).
