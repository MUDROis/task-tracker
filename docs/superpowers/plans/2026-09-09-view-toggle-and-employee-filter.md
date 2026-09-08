# Разделение «Задачи» и «Отчёты» + фильтр по сотрудникам — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Разделить доску на две переключаемые вкладки «Задачи» и «Отчёты», добавить фильтр по сотрудникам (только для администратора) и сохранить видимость «своих задач».

**Architecture:** Логика видимости выносится в чистые функции `js/helpers.js` (тестируются через `node --test`), а браузерный код `app.js` переиспользует их. Переключатель вкладок и фильтр добавляются как отдельная панель `.view-bar` между тулбаром и доской (на мобильных — над доской). Задачи остаются двумя колонками Канбан, отчёты — одним списком.

**Tech Stack:** Vanilla JS (ES5-стиль), HTML/CSS, Firebase (Realtime Database), Node.js `node:test`.

## Global Constraints

- Стиль кода в `app.js` и `helpers.js` — ES5: `var`, `function`-декларации, никаких стрелочных функций там, где в файле преобладает ES5. В новых блоках не ломать существующий стиль.
- Код UI на русском языке (кнопки «Задачи», «Отчёты», «Все сотрудники»).
- Тесты запускаются: `node --test "tests/*.test.js"`.
- Коммиты частые, сообщения в стиле репозитория (русский, `feat:`/`test:`).
- Работает офлайн через service-worker; ничего не кешировать вручную.
- **Git-примечание:** в репозитории есть pre-existing потерянные blob-объекты (последствие синка YandexDisk). Если `git commit` падает с `invalid object ... for 'app.js'`, сначала выполнить `git hash-object -w app.js` (перезапишет недостающий blob из рабочей копии), затем повторить коммит. Не чинить старые потерянные объекты из истории (`git fsck` покажет их — игнорировать).

---

### Task 1: Чистые функции видимости в `js/helpers.js` + тесты

**Files:**
- Modify: `js/helpers.js` (добавить функции перед `return {` и экспорт)
- Create: `tests/visibility.test.js`

**Interfaces:**
- Produces (для Task 4): `DeadlineHelpers.itemVisibleToUser(item, login, isAdmin, selectedEmployee) -> bool`, `DeadlineHelpers.visibleTasks(tasks, login, isAdmin, selectedEmployee) -> []`, `DeadlineHelpers.visibleReports(reports, login, isAdmin, selectedEmployee) -> []`.
  - Семантика: `itemVisibleToUser` — не-админ видит только `createdBy === login || assignedTo === login`; админ видит всё, кроме случая `selectedEmployee` задан (тогда только `createdBy === selectedEmployee || assignedTo === selectedEmployee`). Для не-админа `selectedEmployee` игнорируется.

- [ ] **Step 1: Написать падающие тесты**

Создать `tests/visibility.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/helpers.js');

function item(status, createdBy, assignedTo) {
    return { status: status, createdBy: createdBy, assignedTo: assignedTo };
}

test('itemVisibleToUser: админ видит всё', function() {
    assert.strictEqual(H.itemVisibleToUser(item('done', 'alice', 'bob'), 'admin', true, ''), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', '', ''), 'admin', true, ''), true);
});

test('itemVisibleToUser: сотрудник видит только созданное или назначенное ему', function() {
    assert.strictEqual(H.itemVisibleToUser(item('done', 'me', 'other'), 'me', false, ''), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', 'other', 'me'), 'me', false, ''), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', 'a', 'b'), 'me', false, ''), false);
});

test('itemVisibleToUser: админ с выбранным сотрудником видит только его', function() {
    assert.strictEqual(H.itemVisibleToUser(item('done', 'bob', ''), 'boss', true, 'bob'), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', '', 'bob'), 'boss', true, 'bob'), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', 'alice', ''), 'boss', true, 'bob'), false);
});

test('itemVisibleToUser: для сотрудника фильтр по сотруднику игнорируется', function() {
    assert.strictEqual(H.itemVisibleToUser(item('done', 'me', ''), 'me', false, 'boss'), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', 'boss', ''), 'me', false, 'boss'), false);
});

test('visibleTasks: фильтрует задачи по роли и выбранному сотруднику', function() {
    var tasks = [
        item('urgent', 'boss', 'alice'),
        item('in_progress', 'alice', ''),
        item('urgent', 'bob', '')
    ];
    assert.strictEqual(H.visibleTasks(tasks, 'boss', true, '').length, 3);
    assert.strictEqual(H.visibleTasks(tasks, 'boss', true, 'alice').length, 2);
    assert.strictEqual(H.visibleTasks(tasks, 'alice', false, '').length, 2);
});

test('visibleReports: пустой массив не падает и фильтрует по сотруднику', function() {
    var reports = [
        item('active', 'boss', 'alice'),
        item('active', 'alice', '')
    ];
    assert.strictEqual(H.visibleReports(reports, 'boss', true, '').length, 2);
    assert.strictEqual(H.visibleReports(reports, 'boss', true, 'alice').length, 2);
    assert.strictEqual(H.visibleReports(reports, 'alice', false, '').length, 2);
    assert.deepStrictEqual(H.visibleReports([], 'boss', true, ''), []);
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что они падают**

Run: `node --test "tests/visibility.test.js"`
Expected: FAIL — `itemVisibleToUser is not a function` (TypeError).

- [ ] **Step 3: Реализовать функции в `js/helpers.js`**

В `js/helpers.js` перед строкой `return {` (сейчас на строке 159) добавить:

```js
    // Видимость элемента для пользователя: не-админ — только своё
    // (createdBy === login || assignedTo === login), админ — всё.
    // selectedEmployee применяется только для админа.
    function itemVisibleToUser(item, login, isAdmin, selectedEmployee) {
        if (!item) return false;
        if (!isAdmin && item.createdBy !== login && item.assignedTo !== login) return false;
        if (isAdmin && selectedEmployee) {
            return item.createdBy === selectedEmployee || item.assignedTo === selectedEmployee;
        }
        return true;
    }

    // Задачи, видимые пользователю (учётка роли и фильтра по сотруднику).
    function visibleTasks(tasks, login, isAdmin, selectedEmployee) {
        return (tasks || []).filter(function (t) {
            return itemVisibleToUser(t, login, isAdmin, selectedEmployee);
        });
    }

    // Отчёты, видимые пользователю (учётка роли и фильтра по сотруднику).
    function visibleReports(reports, login, isAdmin, selectedEmployee) {
        return (reports || []).filter(function (r) {
            return itemVisibleToUser(r, login, isAdmin, selectedEmployee);
        });
    }
```

В `return {` (строки 159-169) добавить экспорт:

```js
    return {
        calendarDaysUntil: calendarDaysUntil,
        deadlineStripClass: deadlineStripClass,
        deadlineStripClassFromDate: deadlineStripClassFromDate,
        getDeadlineStatus: getDeadlineStatus,
        isCompletedLate: isCompletedLate,
        normalizeDueDate: normalizeDueDate,
        toDateTimeLocalValue: toDateTimeLocalValue,
        doneStripClass: doneStripClass,
        statsSummary: statsSummary,
        itemVisibleToUser: itemVisibleToUser,
        visibleTasks: visibleTasks,
        visibleReports: visibleReports
    };
```

- [ ] **Step 4: Запустить все тесты и убедиться, что проходят**

Run: `node --test "tests/*.test.js"`
Expected: PASS (все существующие `deadline.test.js`, `stats.test.js` + новый `visibility.test.js`).

- [ ] **Step 5: Коммит**

```bash
git add js/helpers.js tests/visibility.test.js
git commit -m "feat: чистые функции видимости задач и отчётов"
```

---

### Task 2: HTML — переключатель вкладок, фильтр, отдельный вид отчётов

**Files:**
- Modify: `index.html` (панель инструментов ~строка 97; доска ~строки 114-139)

**Interfaces:**
- Produces: элементы `#viewTasksBtn`, `#viewReportsBtn` (`.view-switch-btn`), `#employeeFilter` (`.employee-filter`), контейнер `#reportsView` с `#addReportBtn`, `#count_reports`, `#list_reports`. Доска `#board` теперь только с двумя колонками (`data-status="urgent"` и `data-status="in_progress"`).
- Consumes: Task 1 (пока не напрямую), Task 3 (JS-обработчики).

- [ ] **Step 1: Добавить панель переключателя и фильтра**

Вставить между закрывающим `</div>` тулбара (после строки 97, перед комментарием `<!-- Мобильная нижняя панель -->`):

```html
            <!-- Переключатель Задачи/Отчёты и фильтр по сотрудникам -->
            <div class="view-bar">
                <div class="view-switcher" role="group" aria-label="Переключение вида">
                    <button id="viewTasksBtn" type="button" class="view-switch-btn active" data-view="tasks">Задачи</button>
                    <button id="viewReportsBtn" type="button" class="view-switch-btn" data-view="reports">Отчёты</button>
                </div>
                <select id="employeeFilter" class="employee-filter" aria-label="Фильтр по сотрудникам" style="display:none;"></select>
            </div>
```

- [ ] **Step 2: Убрать колонку отчётов из доски**

В `#board` (строки 114-139) удалить блок третьей колонки (сейчас строки 129-138):

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

После этой правки `#board` содержит только колонки `data-status="urgent"` и `data-status="in_progress"`.

- [ ] **Step 3: Добавить отдельную область отчётов после доски**

Сразу после закрывающего `</div>` элемента `#board` (сейчас строка 139) вставить:

```html
            <!-- Отчёты (отдельный вид) -->
            <div id="reportsView" class="reports-view" style="display:none;">
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
            </div>
```

- [ ] **Step 4: Проверить уникальность id**

Проверить, что `#addReportBtn`, `#count_reports`, `#list_reports`, `#board` встречаются в `index.html` ровно один раз.

Run: `Select-String -Path index.html -Pattern "id=\"(addReportBtn|count_reports|list_reports|board|viewTasksBtn|viewReportsBtn|employeeFilter|reportsView)\"" | Group-Object`
Expected: каждая группа — `Count = 1`.

- [ ] **Step 5: Коммит**

```bash
git add index.html
git commit -m "feat: HTML разметка вкладок Задачи/Отчёты и фильтра сотрудников"
```

---

### Task 3: JS — состояние, `switchView`, фильтр, обработчики

**Files:**
- Modify: `app.js` (глобальные переменные ~строка 20; DOM-ссылки после строки 208; функция обновления шапки ~строка 604; слушатель пользователей ~строка 310; обработчики после строки 1922)

**Interfaces:**
- Consumes: элементы из Task 2 (`#viewTasksBtn`, `#viewReportsBtn`, `#employeeFilter`, `#reportsView`, `#board`); `formatUserName(login)` (app.js:2138, hoisted).
- Produces: глобальное состояние `activeView` (`'tasks'|'reports'`) и `selectedEmployee` (строка логина или `''`); функции `switchView(view)`, `populateEmployeeFilter()`.

- [ ] **Step 1: Добавить состояние**

Рядом с `let currentItemMode = 'task'; // 'task' | 'report' ...` (строка 20) добавить:

```js
    let activeView = 'tasks'; // 'tasks' | 'reports' — текущая вкладка
    let selectedEmployee = ''; // логин выбранного сотрудника в фильтре; '' — все
```

- [ ] **Step 2: Добавить DOM-ссылки**

После `const taskStatusGroup = document.getElementById('taskStatusGroup');` (строка 209) добавить:

```js
    const viewTasksBtn = document.getElementById('viewTasksBtn');
    const viewReportsBtn = document.getElementById('viewReportsBtn');
    const employeeFilter = document.getElementById('employeeFilter');
    const reportsView = document.getElementById('reportsView');
```

- [ ] **Step 3: Добавить `switchView` и `populateEmployeeFilter`**

Сразу перед `function renderBoard()` (строка 1180) добавить:

```js
    // ---------- Переключение вкладок «Задачи» / «Отчёты» ----------
    function switchView(view) {
        activeView = view === 'reports' ? 'reports' : 'tasks';
        const onTasks = activeView === 'tasks';
        if (viewTasksBtn) viewTasksBtn.classList.toggle('active', onTasks);
        if (viewReportsBtn) viewReportsBtn.classList.toggle('active', !onTasks);
        const boardEl = document.getElementById('board');
        if (boardEl) boardEl.style.display = onTasks ? '' : 'none';
        if (reportsView) reportsView.style.display = onTasks ? 'none' : '';
        renderBoard();
    }

    // ---------- Фильтр по сотрудникам (только для администратора) ----------
    function populateEmployeeFilter() {
        if (!employeeFilter) return;
        const isAdmin = currentUser && currentUser.role === 'admin';
        employeeFilter.style.display = isAdmin ? '' : 'none';
        if (!isAdmin) {
            employeeFilter.value = '';
            selectedEmployee = '';
            return;
        }
        const prev = employeeFilter.value;
        employeeFilter.innerHTML = '<option value="">Все сотрудники</option>';
        users.slice().sort(function(a, b) {
            return (formatUserName(a.login) || a.login).localeCompare(formatUserName(b.login) || b.login, 'ru');
        }).forEach(function(u) {
            const opt = document.createElement('option');
            opt.value = u.login;
            opt.textContent = formatUserName(u.login) + (u.role === 'admin' ? ' (Руководитель)' : '');
            employeeFilter.appendChild(opt);
        });
        employeeFilter.value = prev;
        if (employeeFilter.value !== prev) selectedEmployee = employeeFilter.value;
    }
```

- [ ] **Step 4: Вызывать фильтр при обновлении пользователей и при входе**

В слушателе `getUsersRef().on('value', ...)` после `populateAssigneeSelect();` (строка 310) добавить `populateEmployeeFilter();`.

В `showMainPage()` (функция начинается на строке 596) в конце тела, после `populateAssigneeSelect();` (строка 604), добавить:

```js
        populateEmployeeFilter();
        switchView('tasks');
```

- [ ] **Step 5: Подключить обработчики кнопок и фильтра**

После блока `if (addReportBtn) { ... }` (заканчивается на строке 1922) добавить:

```js
    // ---------- Переключатель вкладок ----------
    if (viewTasksBtn) viewTasksBtn.addEventListener('click', function() { switchView('tasks'); });
    if (viewReportsBtn) viewReportsBtn.addEventListener('click', function() { switchView('reports'); });
    if (employeeFilter) employeeFilter.addEventListener('change', function() {
        selectedEmployee = employeeFilter.value;
        renderBoard();
    });
```

- [ ] **Step 6: Проверить синтаксис**

Run: `node --check app.js`
Expected: без вывода (синтаксис корректен).

- [ ] **Step 7: Коммит**

```bash
git add app.js
git commit -m "feat: переключение вкладок Задачи/Отчёты и фильтр по сотрудникам"
```

---

### Task 4: Применить функции видимости в `getTasksForUser`, `isMyReport`, `updateStatsRing`

**Files:**
- Modify: `app.js` (`getTasksForUser` строки 1173-1178; `updateStatsRing` строки 1218-1225; `isMyReport` строки 2173-2176)

**Interfaces:**
- Consumes: `DeadlineHelpers.itemVisibleToUser`, `DeadlineHelpers.visibleTasks`, `DeadlineHelpers.visibleReports`, `DeadlineHelpers.statsSummary` (Task 1); состояние `selectedEmployee` (Task 3).
- Produces: обновлённое поведение доски, списка отчётов и кольца статистики с учётом выбранного сотрудника.

- [ ] **Step 1: `getTasksForUser` через `visibleTasks`**

Заменить тело функции `getTasksForUser()` (строки 1173-1178):

```js
    function getTasksForUser() {
        return DeadlineHelpers.visibleTasks(tasks, currentUser.login, currentUser.role === 'admin', selectedEmployee);
    }
```

- [ ] **Step 2: `isMyReport` через `itemVisibleToUser`**

Заменить тело функции `isMyReport(report)` (строки 2173-2176):

```js
    function isMyReport(report) {
        return DeadlineHelpers.itemVisibleToUser(report, currentUser.login, currentUser.role === 'admin', selectedEmployee);
    }
```

- [ ] **Step 3: `updateStatsRing` с учётом фильтра**

Заменить вызов `DeadlineHelpers.statsSummary(tasks, reports, ...)` в `updateStatsRing()` (строка 1222):

```js
        var ringTasks = getTasksForUser();
        var ringReports = reports.filter(isMyReport);
        var stats = DeadlineHelpers.statsSummary(ringTasks, ringReports, currentUser.login, currentUser.role === 'admin');
```

Строки 1223-1225 (`ringEl.style.setProperty(...)`, `pctEl.textContent = ...`) не меняются.

- [ ] **Step 4: Синтаксис и тесты**

Run: `node --check app.js`
Expected: без вывода.

Run: `node --test "tests/*.test.js"`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add app.js
git commit -m "feat: фильтр по сотрудникам в задачах, отчётах и статистике"
```

---

### Task 5: Стили переключателя, фильтра и вида отчётов

**Files:**
- Modify: `style.css` (после блока `/* ===== TOOLBAR ===== */`, до `/* ===== BOARD ===== */`; в конец файла — мобильный медиазапрос)

**Interfaces:**
- Consumes: HTML-классы из Task 2 (`.view-bar`, `.view-switcher`, `.view-switch-btn`, `.employee-filter`, `.reports-view`).
- Produces: стили, используемые Task 3.

- [ ] **Step 1: Десктоп-стили**

Вставить между закрывающим `}` блока `.toolbar-dropdown-item:hover` (строка 427) и комментарием `/* ===== BOARD ===== */` (строка 429):

```css
/* ===== ПАНЕЛЬ ПЕРЕКЛЮЧЕНИЯ ВИДА (Задачи | Отчёты) ===== */
.view-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
}
.view-switcher {
    display: flex;
    gap: 0.25rem;
    padding: 0.2rem;
    background: var(--surface2);
    border: 1px solid var(--line);
    border-radius: 0.65rem;
}
.view-switch-btn {
    padding: 0.4rem 1.05rem;
    border: none;
    background: transparent;
    border-radius: 0.5rem;
    color: var(--muted);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, color 0.15s;
}
.view-switch-btn:hover {
    color: var(--text);
}
.view-switch-btn.active {
    background: var(--accent);
    color: var(--accent-ink);
}
.employee-filter {
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--line);
    border-radius: 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    background: var(--surface2);
    color: var(--text);
    color-scheme: dark;
    max-width: 220px;
}
.employee-filter:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(255,180,84,.15);
}
```

- [ ] **Step 2: Мобильные стили**

В конец файла `style.css` добавить:

```css
/* ===== МОБИЛЬНОЕ ПЕРЕКЛЮЧЕНИЕ ВИДА ===== */
@media (max-width: 768px) {
    .view-bar {
        flex-direction: column;
        align-items: stretch;
    }
    .view-switcher {
        width: 100%;
    }
    .view-switch-btn {
        flex: 1;
        padding: 0.55rem 1rem;
    }
    .employee-filter {
        max-width: none;
    }
}
```

- [ ] **Step 3: Проверка стилей**

Открыть `index.html` в браузере (например, через `npx serve .` или открыть файл), войти админом:
- Панель с кнопками «Задачи»/«Отчёты» и селект «Все сотрудники» видны между тулбаром и доской, справа.
- Активная кнопка выделена акцентным цветом.
- При ширине ≤768px панель растягивается на всю ширину, фильтр — тоже.

- [ ] **Step 4: Коммит**

```bash
git add style.css
git commit -m "feat: стили переключателя вида и фильтра сотрудников"
```

---

## Финальная проверка (ручная, прогоняется после всех задач)

- [ ] `node --test "tests/*.test.js"` — PASS.
- [ ] Вход админом: вкладки переключаются, доска — только две колонки задач, в «Отчётах» — один список; при выборе сотрудника в фильтре задачи, отчёты и кольцо статистики сужаются до него; «Все сотрудники» возвращает полный список.
- [ ] Вход сотрудником: видны только свои задачи/отчёты; селект фильтра скрыт.
- [ ] Drag & drop задач работает только во вкладке «Задачи».
- [ ] Двойной клик по колонке «Отчёты» открывает модалку создания отчёта.
- [ ] Архив по-прежнему показывает вкладки «Задачи/Отчёты» и фильтрацию по роли.
- [ ] Мобильная ширина ≤768px: переключатель и фильтр видны над доской, нижняя панель действий сохранена.