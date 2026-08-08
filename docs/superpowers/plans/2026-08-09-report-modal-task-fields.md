# Модалка отчёта как у задачи + компактная ширина — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести окно отчёта к полям задачи (без Статуса и Месяца: Заголовок, Описание, Приоритет, Срок выполнения, Исполнитель), сделать ширину компактной (max-width 420px), перевести нумерацию на глобальный счётчик.

**Architecture:** Меняются только `index.html`, `style.css`, `app.js`. Поле `period` убирается из всех новых/редактируемых отчётов и из всех точек отображения (карточка, детали, архив, Excel). Вместо `period` добавляются `priority` и `assignedTo`. Нумерация — глобальный счётчик (`computeReportNumber()` без аргумента). Список исполнителей заполняется для обоих select через параметризованный `populateAssigneeSelect`.

**Tech Stack:** vanilla JS (IIFE), HTML/CSS. Тестов нет — проверка через `node --check app.js` и вручную через `index.html`.

## Global Constraints

- Коммиты прямо в `main` (согласовано ранее).
- Поля окна отчёта (в порядке `#taskModal`): Заголовок * (text required), Описание (textarea rows=3), Приоритет (select low/medium/high, medium selected), Срок выполнения (datetime-local step=900), Исполнитель (select, пустой option «Не назначен»). Статус и Месяц ОТСУТСТВУЮТ.
- Идентификаторы: `reportModal`, `reportModalTitle`, `reportForm`, `reportId`, `reportTitle`, `reportDesc`, `reportPriority`, `reportDueDate`, `reportAssignee`. `reportPeriod` удаляется.
- `.modal-content` окна отчёта получает дополнительный класс `report-modal`; CSS `.report-modal { max-width: 420px; }`.
- Новый отчёт: `{ id, title, description, priority, dueDate, assignedTo, reportNumber, createdBy, status:'active', createdAt, updatedAt }`. `status` ('active'|'done') остаётся внутренним полем архива.
- `computeReportNumber()` — без аргументов, глобальный счётчик.
- `formatPeriod` удаляется, если после изменений не осталось вызовов.
- Старые отчёты с `period` продолжают отображаться (без месяца в метке).

---

### Task 1: Поля окна отчёта в index.html + компактная ширина в style.css

**Files:**
- Modify: `index.html` (строки 167-193, блок `#reportModal`)
- Modify: `style.css` (добавить правило в конец файла)

**Interfaces:**
- Consumes: существующий блок `#reportModal`; классы `.modal`, `.modal-content`, `.close-modal`, `.form-group`, `.btn primary`.
- Produces: статичные поля `#reportTitle`, `#reportDesc`, `#reportPriority`, `#reportDueDate`, `#reportAssignee` — заполняет `openReportModal` (Task 2).

- [ ] **Step 1: Заменить содержимое `#reportModal` в index.html**

Найдите блок (строки 167-193):

```html
        <!-- Модальное окно создания/редактирования отчёта -->
        <div id="reportModal" class="modal">
            <div class="modal-content">
```

и замените ВЕСЬ блок `#reportModal` (от `<!-- Модальное окно создания/редактирования отчёта -->` до закрывающего `</div>` модалки, строки 167-193) на:

```html
        <!-- Модальное окно создания/редактирования отчёта -->
        <div id="reportModal" class="modal">
            <div class="modal-content report-modal">
                <span class="close-modal">&times;</span>
                <h3 id="reportModalTitle">Новый отчёт</h3>
                <form id="reportForm">
                    <input type="hidden" id="reportId">
                    <div class="form-group">
                        <label for="reportTitle">Заголовок *</label>
                        <input type="text" id="reportTitle" required>
                    </div>
                    <div class="form-group">
                        <label for="reportDesc">Описание</label>
                        <textarea id="reportDesc" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="reportPriority">Приоритет</label>
                        <select id="reportPriority">
                            <option value="low">Низкий</option>
                            <option value="medium" selected>Средний</option>
                            <option value="high">Высокий</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reportDueDate">Срок выполнения</label>
                        <input type="datetime-local" id="reportDueDate" step="900">
                    </div>
                    <div class="form-group">
                        <label for="reportAssignee">Исполнитель (делегировать)</label>
                        <select id="reportAssignee">
                            <option value="">Не назначен</option>
                        </select>
                    </div>
                    <button type="submit" class="btn primary">Сохранить</button>
                </form>
            </div>
        </div>
```

- [ ] **Step 2: Добавить компактную ширину в style.css**

В конец `style.css` добавьте:

```css
.report-modal {
    max-width: 420px;
}
```

- [ ] **Step 3: Проверка**

Откройте `index.html` в браузере: структура `#reportModal` содержит только Заголовок, Описание, Приоритет, Срок выполнения, Исполнитель; нет `reportStatus`, `reportPeriod`. В DevTools у `.modal-content.report-modal` `max-width: 420px`.

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: report modal fields like task modal with compact width"
```

---

### Task 2: DOM-ссылки, openReportModal, submit, глобальная нумерация

**Files:**
- Modify: `app.js` — DOM-ссылки (строки 191-198), `openReportModal` (1458-1476), submit `reportForm` (1478-1511), `computeReportNumber` (1765-1771).

**Interfaces:**
- Consumes: поля из Task 1 (`#reportPriority`, `#reportAssignee`); `reports`, `currentUser`, `saveReport`, `generateId`, `positionModalAtPoint`.
- Produces: `openReportModal(reportData, x, y)` заполняет новые поля; submit сохраняет `priority`/`assignedTo`; `computeReportNumber()` без аргументов.

- [ ] **Step 1: Обновить DOM-ссылки**

В `app.js` замените (строки 195-198):

```js
    const reportTitle = document.getElementById('reportTitle');
    const reportDesc = document.getElementById('reportDesc');
    const reportPeriod = document.getElementById('reportPeriod');
    const reportDueDate = document.getElementById('reportDueDate');
```

на:

```js
    const reportTitle = document.getElementById('reportTitle');
    const reportDesc = document.getElementById('reportDesc');
    const reportPriority = document.getElementById('reportPriority');
    const reportDueDate = document.getElementById('reportDueDate');
    const reportAssignee = document.getElementById('reportAssignee');
```

- [ ] **Step 2: Обновить `openReportModal`**

Замените функцию `openReportModal` (строки 1458-1476) на:

```js
    function openReportModal(reportData, x, y) {
        if (reportData) {
            reportModalTitle.textContent = 'Редактировать отчёт';
            reportId.value = reportData.id;
            reportTitle.value = reportData.title || '';
            reportDesc.value = reportData.description || '';
            reportPriority.value = reportData.priority || 'medium';
            reportDueDate.value = reportData.dueDate || '';
            reportAssignee.value = reportData.assignedTo || '';
        } else {
            reportModalTitle.textContent = 'Новый отчёт';
            reportId.value = '';
            reportTitle.value = '';
            reportDesc.value = '';
            reportPriority.value = 'medium';
            reportDueDate.value = '';
            reportAssignee.value = '';
        }
        reportModal.classList.add('active');
        positionModalAtPoint(reportModal, x, y);
    }
```

- [ ] **Step 3: Обновить submit `#reportForm`**

Замените обработчик `reportForm.addEventListener('submit', ...)` (строки 1478-1511) на:

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
        if (id) {
            var rep = reports.find(function(r) { return r.id === id; });
            if (!rep) return;
            saveReport(Object.assign({}, rep, {
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

- [ ] **Step 4: Обновить `computeReportNumber`**

Замените (строки 1765-1771):

```js
    function computeReportNumber(period) {
        var max = 0;
        reports.forEach(function(r) {
            if (r.period === period && r.reportNumber > max) max = r.reportNumber;
        });
        return max + 1;
    }
```

на:

```js
    function computeReportNumber() {
        var max = 0;
        reports.forEach(function(r) {
            if (r.reportNumber > max) max = r.reportNumber;
        });
        return max + 1;
    }
```

- [ ] **Step 5: Проверка синтаксиса**

Run: `node --check app.js`
Expected: без ошибок (кроме возможного предупреждения LF/CRLF).

- [ ] **Step 6: Проверка вручную**

1. «➕» в колонке Отчёты — окно «Новый отчёт» с полями Заголовок/Описание/Приоритет/Срок/Исполнитель.
2. Сохраните — в Firebase запись без `period`, с `priority` и `assignedTo`, номер «№N» (глобальный счётчик).
3. «⚙️» на карточке — «Редактировать отчёт» с заполненными полями; сохраните — поля обновятся.
4. Создайте второй отчёт — номер на 1 больше, независимо от месяца.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: report form uses priority, assignee and global numbering"
```

---

### Task 3: Карточка, детали, архив, Excel, список исполнителей

**Files:**
- Modify: `app.js` — `createReportCard` (1797-1846), `showReportDetails` (1315-1338), поиск архива (698-704), `createArchiveReportRow` (753-792), Excel (859-868), `populateAssigneeSelect` (1419-1431) и её вызовы (301, 539, 1116), удалить `formatPeriod` (1758-1763).

**Interfaces:**
- Consumes: `reports`, `currentUser`, `formatUserName`, `formatDateTime`, `escapeHtml`, `PRIORITY_LABELS`, `sortByDueDate`, `changeReportStatus`, `removeReport`, `showReportDetails`, `openReportModal`, `taskAssignee`, `reportAssignee`.
- Produces: карточка отчёта с цветом от приоритета и меткой «№N»; детали с Приоритетом/Исполнителем; архив без месяца; Excel с именем исполнителя; общий `populateAssigneeSelect(select)`.

- [ ] **Step 1: Обновить `createReportCard`**

Замените первые строки функции `createReportCard` (строки 1797-1816) — от объявления до `div.innerHTML` — на:

```js
    function createReportCard(report) {
        const div = document.createElement('div');
        div.className = 'task-card report-card priority-' + (report.priority || 'medium');
        div.dataset.id = report.id;

        var numberLabel = report.reportNumber
            ? '№' + report.reportNumber
            : 'Отчёт';
        var assigneeLabel = report.assignedTo ? '👤 ' + formatUserName(report.assignedTo) : '';

        div.innerHTML =
            '<div class="task-title">' + escapeHtml(report.title || 'Без названия') + '</div>' +
            '<div class="task-meta">' +
                '<span>📄 ' + escapeHtml(numberLabel) + '</span>' +
                (report.dueDate ? '<span>⏳ ' + formatDateTime(report.dueDate) + '</span>' : '') +
                (assigneeLabel ? '<span>' + assigneeLabel + '</span>' : '') +
                '<span>👤 ' + escapeHtml(formatUserName(report.createdBy)) + '</span>' +
            '</div>' +
            '<div class="task-actions-row1">' +
                '<button class="btn-done" data-action="done"><i class="fa-solid fa-box-archive"></i> В архив</button>' +
            '</div>' +
            '<div class="task-actions-row2">' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-delete" data-action="delete" title="Удалить"><i class="fa-solid fa-trash"></i></button>'
                    : '') +
                '<button class="btn-settings" data-action="settings" title="Изменить"><i class="fa-solid fa-gear"></i></button>' +
                '<button class="btn-open" data-action="open" title="Открыть"><i class="fa-solid fa-circle-info"></i></button>' +
            '</div>';
```

(Остальная часть функции — обработчики `[data-action]` и `return div;` — без изменений.)

- [ ] **Step 2: Обновить `showReportDetails`**

Замените строки 1315-1319:

```js
    function showReportDetails(report, x, y) {
        var periodLabel = formatPeriod(report.period);
        var numberLabel = report.reportNumber
            ? '№' + report.reportNumber + (periodLabel ? ' за ' + periodLabel : '')
            : 'Отчёт';
```

на:

```js
    function showReportDetails(report, x, y) {
        var numberLabel = report.reportNumber
            ? '№' + report.reportNumber
            : 'Отчёт';
```

Затем замените блок HTML внутри `modal.innerHTML` (строки 1326-1331):

```js
                '<div style="margin-top:1rem;font-size:0.95rem;color:#334155;">' +
                    '<p><strong>Номер:</strong> ' + escapeHtml(numberLabel) + '</p>' +
                    '<p><strong>Описание:</strong> ' + (report.description ? escapeHtml(report.description) : '<em>нет</em>') + '</p>' +
                    (report.dueDate ? '<p><strong>Срок сдачи:</strong> ' + formatDateTime(report.dueDate) + '</p>' : '') +
                    '<p><strong>Автор:</strong> ' + escapeHtml(formatUserName(report.createdBy)) + '</p>' +
                    '<p><strong>Создан:</strong> ' + formatDateTime(report.createdAt) + '</p>' +
                '</div>' +
```

на:

```js
                '<div style="margin-top:1rem;font-size:0.95rem;color:#334155;">' +
                    '<p><strong>Номер:</strong> ' + escapeHtml(numberLabel) + '</p>' +
                    '<p><strong>Описание:</strong> ' + (report.description ? escapeHtml(report.description) : '<em>нет</em>') + '</p>' +
                    '<p><strong>Приоритет:</strong> ' + escapeHtml(PRIORITY_LABELS[report.priority] || 'Средний') + '</p>' +
                    (report.dueDate ? '<p><strong>Срок сдачи:</strong> ' + formatDateTime(report.dueDate) + '</p>' : '') +
                    '<p><strong>Исполнитель:</strong> ' + (report.assignedTo ? escapeHtml(formatUserName(report.assignedTo)) : '<em>не назначен</em>') + '</p>' +
                    '<p><strong>Автор:</strong> ' + escapeHtml(formatUserName(report.createdBy)) + '</p>' +
                    '<p><strong>Создан:</strong> ' + formatDateTime(report.createdAt) + '</p>' +
                '</div>' +
```

- [ ] **Step 3: Обновить поиск в архиве**

Замените (строки 698-704):

```js
                archivedReports = archivedReports.filter(function(r) {
                    var numberLabel = r.reportNumber
                        ? '№' + r.reportNumber + ' за ' + formatPeriod(r.period)
                        : '';
                    var hay = (r.title || '').toLowerCase() + ' ' + numberLabel.toLowerCase();
                    return hay.indexOf(search) !== -1;
                });
```

на:

```js
                archivedReports = archivedReports.filter(function(r) {
                    var numberLabel = r.reportNumber
                        ? '№' + r.reportNumber
                        : '';
                    var hay = (r.title || '').toLowerCase() + ' ' + numberLabel.toLowerCase();
                    return hay.indexOf(search) !== -1;
                });
```

- [ ] **Step 4: Обновить `createArchiveReportRow`**

Замените строки 753-766:

```js
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
```

на:

```js
    function createArchiveReportRow(report) {
        var numberLabel = report.reportNumber
            ? '№' + report.reportNumber
            : 'Отчёт';
        var assigneeLabel = report.assignedTo ? '👤 ' + formatUserName(report.assignedTo) : '';
        var div = document.createElement('div');
        div.className = 'archive-row';
        div.innerHTML =
            '<div class="archive-row-main">' +
                '<div class="task-title">' + escapeHtml(report.title) + '</div>' +
                '<div class="task-meta">' +
                    '<span>📄 ' + escapeHtml(numberLabel) + '</span>' +
                    (report.dueDate ? '<span>⏳ ' + formatDateTime(report.dueDate) + '</span>' : '') +
                    (assigneeLabel ? '<span>' + assigneeLabel + '</span>' : '') +
                '</div>' +
            '</div>' +
```

- [ ] **Step 5: Обновить Excel-выгрузку**

Замените (строки 859-868):

```js
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
```

на:

```js
        archivedReports.forEach(function(r) {
            rows.push({
                'Тип': 'Отчёт',
                'Заголовок': r.title,
                'Описание': r.description || '',
                'Срок': r.dueDate ? formatDateTime(r.dueDate) : '',
                'Создал': formatUserName(r.createdBy),
                'Исполнитель': r.assignedTo ? formatUserName(r.assignedTo) : ''
            });
        });
```

- [ ] **Step 6: Параметризовать `populateAssigneeSelect`**

Замените (строки 1418-1431):

```js
    // ---------- Популяция select исполнителей ----------
    function populateAssigneeSelect() {
        var select = taskAssignee;
        if (!select) return;
        var currentVal = select.value;
        select.innerHTML = '<option value="">Не назначен</option>';
        users.forEach(function(u) {
                var opt = document.createElement('option');
                opt.value = u.login;
                opt.textContent = u.login + (u.role === 'admin' ? ' (Руководитель)' : '');
                select.appendChild(opt);
            });
        if (currentVal) select.value = currentVal;
    }
```

на:

```js
    // ---------- Популяция select исполнителей ----------
    function populateAssigneeSelect() {
        populateSelect(taskAssignee);
        populateSelect(reportAssignee);
    }

    function populateSelect(select) {
        if (!select) return;
        var currentVal = select.value;
        select.innerHTML = '<option value="">Не назначен</option>';
        users.forEach(function(u) {
            var opt = document.createElement('option');
            opt.value = u.login;
            opt.textContent = u.login + (u.role === 'admin' ? ' (Руководитель)' : '');
            select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
    }
```

- [ ] **Step 7: Удалить `formatPeriod`**

Проверьте, что после всех изменений в `app.js` не осталось вызовов `formatPeriod(` (должно быть 0). Если вызовов нет, удалите функцию (строки 1758-1763):

```js
    function formatPeriod(period) {
        if (!period) return '';
        var m = new Date(period + '-01T00:00:00');
        if (isNaN(m.getTime())) return period;
        return m.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    }
```

- [ ] **Step 8: Проверка синтаксиса**

Run: `node --check app.js`
Expected: без ошибок (кроме возможного предупреждения LF/CRLF).

- [ ] **Step 9: Проверка вручную**

1. Карточка отчёта: цвет от приоритета (высокий — красный тон, средний — жёлтый/нейтральный, низкий — зелёный), метка «№N», при назначенном исполнителе — «👤 <имя>».
2. «Открыть» на карточке — детали с Номер/Описание/Приоритет/Срок/Исполнитель/Автор/Создан, без месяца.
3. Архив: поиск по «№N» находит отчёт; строка архива показывает «№N» без месяца и исполнителя.
4. Excel-выгрузка: в колонке «Исполнитель» имя исполнителя (или пусто), не месяц.
5. Окно задачи по-прежнему заполняет исполнителей (taskAssignee), окно отчёта — reportAssignee.
6. Старый отчёт с `period` отображается корректно — метка «№N» без месяца.

- [ ] **Step 10: Commit**

```bash
git add app.js
git commit -m "feat: report cards, details, archive use priority and assignee"
```

---

## Self-Review

**Spec coverage:**
- Поля окна (без Статус/Месяц, компактная ширина) → Task 1.
- Данные: priority/assignedTo, глобальная нумерация → Task 2.
- Карточка (цвет от приоритета, №N, исполнитель) → Task 3 Step 1.
- Детали (Приоритет/Исполнитель, без месяца) → Task 3 Step 2.
- Архив: поиск, строка, Excel → Task 3 Steps 3-5.
- `populateAssigneeSelect` общий → Task 3 Step 6.
- `formatPeriod` удалён при нуле вызовов → Task 3 Step 7.
- Старые отчёты с `period` отображаются (метка без месяца) → Global Constraints + Steps 1/4.

**Placeholder scan:** полный код в каждом шаге, точные пути и строки. Плейсхолдеров нет.

**Type consistency:** поля (`reportPriority`, `reportAssignee`), сигнатуры (`computeReportNumber()`, `populateSelect(select)`), свойства (`priority`, `assignedTo`) согласованы между задачами. Удаление `formatPeriod` опционально и контролируется проверкой вызовов (Step 7).
