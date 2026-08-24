# Карточка задачи: жесты, даты, шкала полосы — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Скрытие органов управления в карточках задач/отчётов с показом по тапу/hover, открытие полной модалки по двойному тапу, удаление даты создания из карточки и новая цветовая шкала полосы срока.

**Architecture:** Vanilla JS PWA без фреймворков. Логика карточек — `createTaskCard`/`createReportCard` в `app.js`; расчёт полосы — чистые функции в `js/helpers.js` (тестируются `node --test`); поведение раскрытия — CSS-классы `.controls-open` / `:hover` c media-ветками `hover:hover` / `hover:none`.

**Tech Stack:** ES5-style vanilla JS, Font Awesome 6.5.2 (CDN), node:test.

**Spec:** `docs/superpowers/specs/2026-08-25-task-card-gestures-dates-strip-design.md`

## Global Constraints

- Формат срока в карточке: `ДД.ММ.ГГГГ ЧЧ:ММ` (существующая `formatDateTime()`).
- Отсчёт дней до срока — календарные дни (`calendarDaysUntil`, от начала дня до начала дня).
- Шкала полосы: нет срока — серый `#64748b`; >5 — зелёный `#22c55e`; 4–5 — салатовый `#a3e635`; 3 — оранжевый `#f97316`; 1–2 — алый `#ef4444` (`strip-scarlet`); 0 — красный `#dc2626`; <0 — бордовый `#881337`.
- Двойной тап: два `click` с интервалом <300 мс; детектор только при `matchMedia('(hover: none)').matches`.
- Десктоп: кнопки обеих строк появляются по `:hover`; одиночный клик ничего не переключает.
- Права: автор/админ → модалка редактирования; остальные → детали. Алерты «Вы не можете редактировать эту задачу» убрать.
- Изменения применяются к карточкам задач И отчётов.
- Стиль кода: ES5-совместимые функции, `var`/`function`, как в существующем `app.js`. Без комментариев в новом коде (правило репозитория).

---

### Task 1: Новая шкала `deadlineStripClass` (TDD)

**Files:**
- Modify: `tests/deadline.test.js:23-33`
- Modify: `js/helpers.js:27-35`
- Modify: `style.css:531-537` (блок `.task-card.strip-*`)
- Modify: `style.css:1220-1226` (блок `.archive-row.strip-*`)

**Interfaces:**
- Consumes: ничего.
- Produces: `DeadlineHelpers.deadlineStripClass(daysLeft)` возвращает `'strip-ok' | 'strip-warn' | 'strip-orange' | 'strip-scarlet' | 'strip-red' | 'strip-overdue' | 'strip-none'`; класс `strip-coral` больше не существует.

- [ ] **Step 1: Обновить тест под новую шкалу**

В `tests/deadline.test.js` заменить тест `deadlineStripClass: диапазоны дней` целиком:

```js
test('deadlineStripClass: диапазоны дней', function() {
    assert.strictEqual(H.deadlineStripClass(6), 'strip-ok');
    assert.strictEqual(H.deadlineStripClass(5), 'strip-warn');
    assert.strictEqual(H.deadlineStripClass(4), 'strip-warn');
    assert.strictEqual(H.deadlineStripClass(3), 'strip-orange');
    assert.strictEqual(H.deadlineStripClass(2), 'strip-scarlet');
    assert.strictEqual(H.deadlineStripClass(1), 'strip-scarlet');
    assert.strictEqual(H.deadlineStripClass(0), 'strip-red');
    assert.strictEqual(H.deadlineStripClass(-5), 'strip-overdue');
    assert.strictEqual(H.deadlineStripClass(null), 'strip-none');
});
```

- [ ] **Step 2: Запустить тест, убедиться в падении**

Run: `node --test tests/deadline.test.js`
Expected: FAIL — получено `'strip-coral'` вместо `'strip-scarlet'`, `'strip-overdue'` вместо `'strip-red'`.

- [ ] **Step 3: Обновить `deadlineStripClass` в `js/helpers.js`**

Заменить тело функции:

```js
    function deadlineStripClass(daysLeft) {
        if (daysLeft === null || typeof daysLeft === 'undefined') return 'strip-none';
        if (daysLeft > 5) return 'strip-ok';
        if (daysLeft >= 4) return 'strip-warn';
        if (daysLeft >= 3) return 'strip-orange';
        if (daysLeft >= 1) return 'strip-scarlet';
        if (daysLeft >= 0) return 'strip-red';
        return 'strip-overdue';
    }
```

- [ ] **Step 4: Запустить тесты, убедиться в успехе**

Run: `node --test tests/deadline.test.js`
Expected: PASS, все тесты зелёные.

- [ ] **Step 5: Обновить цвета полос в `style.css`**

Блок `.task-card.strip-*` (строки ~531–537) заменить на:

```css
.task-card.strip-ok { border-left-color: #22c55e; }
.task-card.strip-warn { border-left-color: #a3e635; }
.task-card.strip-orange { border-left-color: #f97316; }
.task-card.strip-scarlet { border-left-color: #ef4444; }
.task-card.strip-red { border-left-color: #dc2626; }
.task-card.strip-overdue { border-left-color: #881337; }
.task-card.strip-none { border-left-color: #64748b; }
```

Блок `.archive-row.strip-*` (строки ~1220–1226) заменить на:

```css
.archive-row.strip-ok { border-left-color: #22c55e; }
.archive-row.strip-warn { border-left-color: #a3e635; }
.archive-row.strip-orange { border-left-color: #f97316; }
.archive-row.strip-scarlet { border-left-color: #ef4444; }
.archive-row.strip-red { border-left-color: #dc2626; }
.archive-row.strip-overdue { border-left-color: #881337; }
.archive-row.strip-none { border-left-color: #64748b; }
```

Проверить, что `strip-coral` больше нигде не упоминается:

Run: `rg -n "strip-coral" style.css app.js index.html js/`
Expected: пустой вывод.

- [ ] **Step 6: Коммит**

```bash
git add tests/deadline.test.js js/helpers.js style.css
git commit -m "feat: deadline strip scale - scarlet 1-2d, red on due day, bordeaux overdue"
```

---

### Task 2: Мета-строка карточек — без даты создания, срок с календариком

**Files:**
- Modify: `app.js` (мета-строка в `createTaskCard`, ~строки 1197–1201)
- Modify: `app.js` (мета-строка в `createReportCard`, ~строки 2027–2032)

**Interfaces:**
- Consumes: `formatDateTime(dateStr)` (уже определена в `app.js:1999`, hoisted внутри того же IIFE), Font Awesome 6.5.2 подключён в `index.html:17`.
- Produces: мета-строка задачи = `[исполнитель][срок]`; мета-строка отчёта = `[№][срок][исполнитель][автор]`. Никаких эмодзи 📅/⏳.

- [ ] **Step 1: Заменить мета-строку в `createTaskCard`**

Найти в `createTaskCard` фрагмент:

```js
            '<div class="task-meta">' +
                '<span>📅 ' + new Date(task.createdAt).toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric'}) + '</span>' +
                '<span>' + assigneeEmoji + ' ' + escapeHtml(assigneeName) + '</span>' +
                (task.dueDate ? '<span>⏳ ' + new Date(task.dueDate).toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' + new Date(task.dueDate).toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}) + '</span>' : '') +
            '</div>' +
```

Заменить на:

```js
            '<div class="task-meta">' +
                '<span>' + assigneeEmoji + ' ' + escapeHtml(assigneeName) + '</span>' +
                (task.dueDate ? '<span><i class="fa-regular fa-calendar"></i> ' + formatDateTime(task.dueDate) + '</span>' : '') +
            '</div>' +
```

- [ ] **Step 2: Заменить иконку в `createReportCard`**

Найти строку:

```js
                (report.dueDate ? '<span>⏳ ' + formatDateTime(report.dueDate) + '</span>' : '') +
```

Заменить на:

```js
                (report.dueDate ? '<span><i class="fa-regular fa-calendar"></i> ' + formatDateTime(report.dueDate) + '</span>' : '') +
```

- [ ] **Step 3: Проверить отсутствие старых эмодзи дат**

Run: `rg -n "⏳|📅" app.js index.html`
Expected: пустой вывод (эмодзи дат в карточках больше нет; 👤/📄 остаются).

- [ ] **Step 4: Ручная проверка**

Открыть `index.html` в браузере, войти admin/admin, создать задачу со сроком: в карточке — исполнитель и одна дата формата `ДД.ММ.ГГГГ ЧЧ:ММ` с иконкой календарика; даты создания нет.

- [ ] **Step 5: Коммит**

```bash
git add app.js
git commit -m "feat: drop created date from cards, calendar icon for due datetime"
```

---

### Task 3: Открытие полной карточки по правам + детектор тапов

**Files:**
- Modify: `app.js` (перед `createTaskCard`, после функции `updateStatsRing`)
- Modify: `app.js` (`createTaskCard`: блоки `dblclick` и конец функции)
- Modify: `app.js` (`createReportCard`: перед `return div`)

**Interfaces:**
- Consumes: `openTaskModal(taskData, x, y, mode?)`, `showTaskDetails(task, x, y)`, `openReportModal(reportData, x, y)`, `showReportDetails(report, x, y)` — существующие сигнатуры.
- Produces: `canEditItem(item) -> boolean`; `openFullTask(task, x, y)`; `openFullReport(report, x, y)`; `attachMobileTapHandlers(cardEl, openFullFn)`. CSS-класс `controls-open` на `.task-card` (раскрытые кнопки, стилизуется в Task 4).

- [ ] **Step 1: Добавить общие функции после `updateStatsRing` (перед `createTaskCard`)**

```js
    // ---------- Полная карточка и мобильные тапы ----------
    var TOUCH_TAP_MS = 300;
    var isTouchDevice = window.matchMedia && window.matchMedia('(hover: none)').matches;

    function canEditItem(item) {
        return currentUser.role === 'admin' || item.createdBy === currentUser.login;
    }

    function openFullTask(task, x, y) {
        if (canEditItem(task)) openTaskModal(task, x, y);
        else showTaskDetails(task, x, y);
    }

    function openFullReport(report, x, y) {
        if (canEditItem(report)) openReportModal(report, x, y);
        else showReportDetails(report, x, y);
    }

    function attachMobileTapHandlers(cardEl, openFullFn) {
        if (!isTouchDevice) return;
        var lastTapTime = 0;
        var singleTapTimer = null;
        cardEl.addEventListener('click', function(e) {
            if (e.target.closest('[data-action]')) return;
            var now = Date.now();
            if (now - lastTapTime < TOUCH_TAP_MS) {
                if (singleTapTimer) { clearTimeout(singleTapTimer); singleTapTimer = null; }
                lastTapTime = 0;
                openFullFn(e.clientX, e.clientY);
                return;
            }
            lastTapTime = now;
            if (singleTapTimer) clearTimeout(singleTapTimer);
            document.querySelectorAll('.task-card.controls-open').forEach(function(el) {
                if (el !== cardEl) el.classList.remove('controls-open');
            });
            singleTapTimer = setTimeout(function() {
                cardEl.classList.toggle('controls-open');
                singleTapTimer = null;
            }, TOUCH_TAP_MS);
        });
    }
```

- [ ] **Step 2: Заменить обработчик `dblclick` в `createTaskCard`**

Найти:

```js
        div.addEventListener('dblclick', function(e) {
            if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
                alert('Вы не можете редактировать эту задачу');
                return;
            }
            openTaskModal(task, e.clientX, e.clientY);
        });

        return div;
```

Заменить на:

```js
        div.addEventListener('dblclick', function(e) {
            e.preventDefault();
            openFullTask(task, e.clientX, e.clientY);
        });

        attachMobileTapHandlers(div, function(x, y) { openFullTask(task, x, y); });

        return div;
```

- [ ] **Step 3: Добавить те же обработчики в `createReportCard`**

Найти конец `createReportCard`:

```js
        });

        return div;
    }

    function renderReports() {
```

Заменить на:

```js
        });

        div.addEventListener('dblclick', function(e) {
            e.preventDefault();
            openFullReport(report, e.clientX, e.clientY);
        });

        attachMobileTapHandlers(div, function(x, y) { openFullReport(report, x, y); });

        return div;
    }

    function renderReports() {
```

- [ ] **Step 4: Проверить синтаксис и тесты**

Run: `node --check app.js; node --test tests/`
Expected: ошибок синтаксиса нет, все тесты PASS.

- [ ] **Step 5: Ручная проверка (десктоп)**

Двойной клик по своей задаче → модалка редактирования; по чужой (создать вторым пользователем заранее или проверить под сотрудником) → модалка деталей без алертов. Одиночный клик пока ничего не меняет визуально (CSS — Task 4).

- [ ] **Step 6: Коммит**

```bash
git add app.js
git commit -m "feat: rights-based full-card opener and mobile tap/double-tap detection"
```

---

### Task 4: CSS — скрытие кнопок, hover на десктопе, controls-open на мобильных

**Files:**
- Modify: `style.css:493-503` (`.task-card` — добавить `touch-action`)
- Modify: `style.css:558-605` (строки кнопок: базовое скрытие, media-ветки, удаление старых opacity/visibility правил)

**Interfaces:**
- Consumes: класс `controls-open`, который ставит `attachMobileTapHandlers` (Task 3).
- Produces: видимость строк кнопок: десктоп — по `:hover`; мобильные — по `.controls-open`.

- [ ] **Step 1: Добавить `touch-action` в `.task-card`**

В правиле `.task-card` (строка ~493) добавить свойство в конец списка:

```css
.task-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 0.75rem 1rem;
    box-shadow: 0 8px 20px rgba(0,0,0,.3);
    border-left: 4px solid #64748b;
    cursor: grab;
    transition: background 0.2s, box-shadow 0.2s, border-color 0.2s, transform 0.18s;
    position: relative;
    touch-action: manipulation;
}
```

- [ ] **Step 2: Заменить правила видимости строк кнопок**

Удалить весь участок от правила `.task-card .task-actions-row1` до конца блока `@media (hover: none)` со скрытием row2 (строки ~558–605, включая комментарий «Удалить / Настройки / Открыть…», правила opacity/visibility и `:focus-within`).

Вставить на это место ровно следующий блок:

```css
.task-card .task-actions-row1,
.task-card .task-actions-row2 {
    display: none;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.task-card .task-actions-row2 {
    justify-content: space-evenly;
    margin-top: 0.35rem;
    padding-top: 0.35rem;
    border-top: 1px solid rgba(255,255,255,.06);
}

@media (hover: hover) {
    .task-card:hover .task-actions-row1,
    .task-card:hover .task-actions-row2 {
        display: flex;
    }
}

@media (hover: none) {
    .task-card.controls-open .task-actions-row1,
    .task-card.controls-open .task-actions-row2 {
        display: flex;
    }
}

.task-card .task-actions-row1 button,
.task-card .task-actions-row2 button {
    background: none;
    border: none;
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.15s, transform 0.12s;
}
.task-card .task-actions-row1 button:active,
.task-card .task-actions-row2 button:active {
    transform: scale(0.95);
}
```

- [ ] **Step 3: Проверить отсутствие старых правил**

Run: `rg -n "focus-within|opacity: 0" style.css`
Expected: пустой вывод в пределах блока TASK CARD (совпадений нет вообще).

- [ ] **Step 4: Ручная проверка**

Десктоп: кнопки не видны, появились при наведении, исчезли при уходе курсора; одиночный клик не togg'лит. DevTools → эмуляция мобильного (coarse pointer): тап раскрывает кнопки через ~300 мс, повторный тап сворачивает, тап другой карточки сворачивает первую, двойной тап открывает модалку, drag&drop не togg'лит.

- [ ] **Step 5: Коммит**

```bash
git add style.css
git commit -m "feat: hidden card actions, hover reveal on desktop, tap toggle on mobile"
```

---

### Task 5: Service Worker bump + README

**Files:**
- Modify: `service-worker.js:1`
- Modify: `README.md` (разделы «Редактирование», «Действия на карточке», «Цвет исполнителя»)

**Interfaces:**
- Consumes: ничего.
- Produces: свежий кеш PWA (`task-tracker-v7`) и актуальная документация.

- [ ] **Step 1: Поднять версию кеша**

```js
const CACHE_NAME = 'task-tracker-v7';
```

- [ ] **Step 2: Обновить README**

Секцию «### Редактирование» заменить на:

```markdown
### Редактирование
Дважды кликните по карточке задачи (двойной тап на мобильном). Автор и руководитель откроют редактирование, остальные — просмотр деталей.
```

Секцию «### Действия на карточке» начать с абзаца:

```markdown
Кнопки действий скрыты. На компьютере наведите курсор на карточку, на телефоне коснитесь её (повторное касание скрывает).
```

Секцию «### Цвет исполнителя» заменить на:

```markdown
### Цвет полосы срока
Левая полоска карточки показывает близость срока выполнения:
зелёная (>5 дней), салатовая (4–5 дней), оранжевая (за 3 дня),
алая (за 2 дня и за 1 день), красная (в день срока), бордовая (просрочено).
```

- [ ] **Step 3: Прогнать все тесты**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 4: Коммит**

```bash
git add service-worker.js README.md
git commit -m "chore: bump sw cache, update readme for card gestures and strip scale"
```
