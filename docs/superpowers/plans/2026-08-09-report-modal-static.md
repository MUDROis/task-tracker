# Статичная модалка отчёта (по образцу #taskModal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести модальное окно создания/редактирования отчёта из динамического создания в JS в статичный HTML `#reportModal` в `index.html`, по образцу `#taskModal`.

**Architecture:** Модалка отчёта становится статичным HTML-блоком в `index.html`. В `app.js` добавляются DOM-ссылки на её поля, `openReportModal(reportData, x, y)` переписывается по образцу `openTaskModal` (заполнение полей + `classList.add('active')` + `positionModalAtPoint`), обработчик submit переносится на статичную `#reportForm` по образцу `taskForm`.

**Tech Stack:** vanilla JS (IIFE), HTML/CSS. Тестового фреймворка нет — проверка вручную через `index.html`, синтаксис через `node --check app.js`.

## Global Constraints

- Коммиты прямо в `main` (согласовано ранее).
- Поля отчёта не меняются: Название *, Описание, Месяц (type=month), Срок сдачи (datetime-local, step=900).
- Поведение сохранения не меняется: новые отчёты получают `reportNumber` через `computeReportNumber(period)`, статус `active`, `createdBy: currentUser.login`.
- Статичная модалка встраивается в `index.html` сразу после `#taskModal`, перед `#usersModal`.
- Идентификаторы полей сохраняются: `reportId`, `reportTitle`, `reportDesc`, `reportPeriod`, `reportDueDate`, `reportForm`, `reportModalTitle`.
- Закрытие по крестику уже обрабатывается глобально (`document.querySelectorAll('.close-modal')`, app.js:1060) — для статичной модалки отдельных обработчиков не нужно.
- Правила Firebase: узел `reports` в `database.rules.json` с `.read/.write: "auth != null"` уже закоммичен (`abda888`) — повторно не менять.

---

### Task 1: Статичный HTML-блок модалки отчёта

**Files:**
- Modify: `index.html` (вставить после `</div>` модалки `#taskModal` — после строки 164 — перед `<!-- Модальное окно управления пользователями -->`)

**Interfaces:**
- Consumes: существующая разметка `#taskModal` (образец), классы `.modal`, `.modal-content`, `.close-modal`, `.form-group`, `.btn primary`.
- Produces: статичный `#reportModal` с полями `#reportModalTitle`, `#reportForm`, `#reportId`, `#reportTitle`, `#reportDesc`, `#reportPeriod`, `#reportDueDate` — их заполняет `openReportModal` в Task 2.

- [ ] **Step 1: Вставить модалку в index.html**

В `index.html` найдите конец модалки задачи (строки ~163-164):

```html
                    <button type="submit" class="btn primary">Сохранить</button>
                </form>
            </div>
        </div>

        <!-- Модальное окно управления пользователями -->
```

После закрывающего `</div>` модалки задачи (перед комментарием `<!-- Модальное окно управления пользователями -->`) вставьте:

```html
        <!-- Модальное окно создания/редактирования отчёта -->
        <div id="reportModal" class="modal">
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3 id="reportModalTitle">Новый отчёт</h3>
                <form id="reportForm">
                    <input type="hidden" id="reportId">
                    <div class="form-group">
                        <label for="reportTitle">Название *</label>
                        <input type="text" id="reportTitle" required>
                    </div>
                    <div class="form-group">
                        <label for="reportDesc">Описание</label>
                        <textarea id="reportDesc" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="reportPeriod">Месяц</label>
                        <input type="month" id="reportPeriod" required>
                    </div>
                    <div class="form-group">
                        <label for="reportDueDate">Срок сдачи</label>
                        <input type="datetime-local" id="reportDueDate" step="900">
                    </div>
                    <button type="submit" class="btn primary">Сохранить</button>
                </form>
            </div>
        </div>
```

- [ ] **Step 2: Проверка**

Откройте `index.html` в браузере (admin/admin), колонка «Отчёты» → «➕». Нажмите «➕» — ничего не происходит (обработчик ещё не переписан), но в DOM через DevTools виден блок `#reportModal` без класса `active`. Убедитесь, что разметка валидна (нет незакрытых тегов).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add static report modal markup"
```

---

### Task 2: Переписать openReportModal и перенести обработчик submit

**Files:**
- Modify: `app.js` — DOM-ссылки (около строк 181-189), функция `openReportModal` (строки 1450-1519), обработчик submit (перенести из `openReportModal` на статичную `#reportForm`, рядом с `taskForm` обработчиком на строке 1521).

**Interfaces:**
- Consumes: `#reportModal`, `#reportModalTitle`, `#reportForm`, `#reportId`, `#reportTitle`, `#reportDesc`, `#reportPeriod`, `#reportDueDate` (Task 1); `reports`, `currentUser`, `saveReport`, `generateId`, `computeReportNumber`, `positionModalAtPoint`.
- Produces: переписанный `openReportModal(reportData, x, y)` — по образцу `openTaskModal`; обработчик submit статичной `#reportForm`, сохраняющий логику нумерации.

- [ ] **Step 1: Добавить DOM-ссылки на модалку отчёта**

В `app.js` в блоке `// ---------- DOM-элементы ----------` после строк с `taskModal`/`modalTitle`/`taskForm` (строки ~181-183) добавьте:

```js
    const reportModal = document.getElementById('reportModal');
    const reportModalTitle = document.getElementById('reportModalTitle');
    const reportForm = document.getElementById('reportForm');
    const reportId = document.getElementById('reportId');
    const reportTitle = document.getElementById('reportTitle');
    const reportDesc = document.getElementById('reportDesc');
    const reportPeriod = document.getElementById('reportPeriod');
    const reportDueDate = document.getElementById('reportDueDate');
```

- [ ] **Step 2: Переписать `openReportModal`**

В `app.js` замените ВСЮ функцию `openReportModal(reportData, x, y)` (строки 1450-1519, включая вложенный обработчик `#reportForm` submit) на:

```js
    function openReportModal(reportData, x, y) {
        if (reportData) {
            reportModalTitle.textContent = 'Редактировать отчёт';
            reportId.value = reportData.id;
            reportTitle.value = reportData.title || '';
            reportDesc.value = reportData.description || '';
            reportPeriod.value = reportData.period || '';
            reportDueDate.value = reportData.dueDate || '';
        } else {
            reportModalTitle.textContent = 'Новый отчёт';
            reportId.value = '';
            reportTitle.value = '';
            reportDesc.value = '';
            reportPeriod.value = '';
            reportDueDate.value = '';
        }
        reportModal.classList.add('active');
        positionModalAtPoint(reportModal, x, y);
    }
```

- [ ] **Step 3: Добавить обработчик submit на `#reportForm`**

В `app.js` перед обработчиком `taskForm.addEventListener('submit', ...)` (строка ~1521) добавьте:

```js
    reportForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var id = reportId.value;
        var title = reportTitle.value.trim();
        if (!title) return;
        var desc = reportDesc.value.trim();
        var period = reportPeriod.value;
        var dueDate = reportDueDate.value;
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
        reportModal.classList.remove('active');
    });
```

- [ ] **Step 4: Проверка синтаксиса**

Run: `node --check app.js`
Expected: без ошибок (кроме возможного предупреждения LF/CRLF).

- [ ] **Step 5: Проверка вручную**

Откройте `index.html`, admin/admin:
1. Колонка «Отчёты» → «➕» — открывается модалка «Новый отчёт» с полями Название/Описание/Месяц/Срок сдачи.
2. Заполните и сохраните — отчёт появляется в колонке, в Firebase запись в `teams/team_main/reports` (при развёрнутых правилах из `database.rules.json`).
3. «⚙️» на карточке отчёта — открывается «Редактировать отчёт» с заполненными полями; сохраните — поля обновятся.
4. Закрытие по «×» и клику по фону работает.
5. На ПК модалка под курсором, на мобильной ширине — по центру.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "refactor: render report modal from static markup"
```

---

## Self-Review

**Spec coverage:**
- Статичный HTML `#reportModal` в `index.html` → Task 1.
- `openReportModal` по образцу `openTaskModal` (заполнение полей + `classList.add('active')` + `positionModalAtPoint`) → Task 2 Step 2.
- Обработчик submit на статичной `#reportForm` по образцу `taskForm`, в конце `classList.remove('active')` → Task 2 Step 3.
- Динамическое создание DOM и `modal.remove()` удалены → Task 2 Step 2 (вся функция заменена).
- Поля и нумерация (`computeReportNumber`) сохранены → Task 2 Step 3.
- Правила Firebase не меняются → Global Constraints.

**Placeholder scan:** Полный код в каждом шаге, точные пути. Плейсхолдеров нет.

**Type consistency:** Идентификаторы полей (`reportId`, `reportTitle`, `reportDesc`, `reportPeriod`, `reportDueDate`, `reportForm`, `reportModalTitle`) в Task 1 (HTML) и Task 2 (JS) совпадают. Сигнатура `openReportModal(reportData, x, y)` не меняется — вызовы из `createReportCard` и `#addReportBtn` продолжают работать.
