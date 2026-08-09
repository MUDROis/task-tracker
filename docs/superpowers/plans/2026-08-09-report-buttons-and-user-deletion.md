# Кнопки «Выполнить»/«Делегировать» в карточке отчёта + удаление сотрудника — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в карточку отчёта кнопки «Выполнить» и «Делегировать» (как в задаче), обобщить делегирование на задачи и отчёты, и добавить удаление сотрудника в список пользователей.

**Architecture:** Всё в одном файле `app.js` (vanilla JS, без сборки). `showDelegateModal` обобщается: принимает объект (`task`/`report`), функцию сохранения (`saveTask`/`saveReport`) и слово для заголовка. Карточка отчёта получает кнопки и стрелку-индикатор делегирования по образцу карточки задачи. Удаление сотрудника — кнопка в `renderUsersList` + функция `deleteUser`.

**Tech Stack:** JavaScript (ES5/ES6, IIFE), Firebase Realtime Database, без тестового фреймворка.

## Global Constraints

- Все изменения только в `app.js`.
- Нет сборки и тестового фреймворка. Проверка: `node --check app.js` (синтаксис) и ручная проверка в `index.html`.
- Сообщения пользователю на русском.
- Существующие поля/функции не переименовывать: `saveTask`, `saveReport`, `removeUser`, `changeReportStatus`, `formatUserName`, `escapeHtml`, `positionModalAtPoint`, `sendEmailNotification`, `populateSelect`.
- Не удалять учётную запись `admin` и самого текущего пользователя.

---

### Task 1: Обобщить showDelegateModal для задач и отчётов

**Files:**
- Modify: `app.js:1343-1393` (функция `showDelegateModal`)
- Modify: `app.js:1173-1174` (вызов из карточки задачи)

**Interfaces:**
- Consumes: `users`, `currentUser`, `tasks`, `saveTask`, `sendEmailNotification`, `escapeHtml`, `positionModalAtPoint`.
- Produces: `showDelegateModal(item, saveFn, kind, x, y)` — `item` (task или report), `saveFn` (`saveTask` или `saveReport`), `kind` (строка «задачу» / «отчёт» для заголовка окна).

- [ ] **Step 1: Заменить тело `showDelegateModal`**

Заменить всю функцию `showDelegateModal` (строки 1343-1393) на:

```js
    function showDelegateModal(item, saveFn, kind, x, y) {
        if (!item) return;
        var assignees = users
            .filter(function(u) {
                if (u.login === currentUser.login && currentUser.role !== 'admin') return false;
                if (currentUser.role !== 'admin' && u.role === 'admin') return false;
                return true;
            })
            .map(function(u) { return u.login; });
        if (assignees.length === 0) {
            alert('Нет доступных сотрудников для делегирования');
            return;
        }
        var modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:400px;">' +
                '<span class="close-modal" onclick="this.closest(\'.modal\').remove()">&times;</span>' +
                '<h3>Делегировать ' + kind + '</h3>' +
                '<p><strong>' + escapeHtml(item.title) + '</strong></p>' +
                '<div class="form-group">' +
                    '<label for="delegateSelect">Выберите сотрудника</label>' +
                    '<select id="delegateSelect">' +
                        assignees.map(function(login) {
                            var u = users.find(function(usr) { return usr.login === login; });
                            var label = login + (u && u.role === 'admin' ? ' (Руководитель)' : '');
                            return '<option value="' + escapeHtml(login) + '" ' + (item.assignedTo === login ? 'selected' : '') + '>' + escapeHtml(label) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
                '<button id="delegateConfirmBtn" class="btn primary">Делегировать</button>' +
            '</div>';
        document.body.appendChild(modal);
        positionModalAtPoint(modal, x, y);
        modal.querySelector('#delegateConfirmBtn').addEventListener('click', function() {
            var selected = document.getElementById('delegateSelect').value;
            var delegatedBy = currentUser.role === 'admin' ? 'admin' : 'employee';
            var updated = Object.assign({}, item, {
                assignedTo: selected,
                delegated: true,
                delegatedBy: delegatedBy,
                updatedAt: new Date().toISOString()
            });
            saveFn(updated);
            sendEmailNotification(selected, updated);
            modal.remove();
        });
        modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
    }
```

- [ ] **Step 2: Обновить вызов в карточке задачи**

Заменить в `createTaskCard` (строки 1173-1174):

```js
                } else if (action === 'delegate') {
                    showDelegateModal(task.id, x, y);
```

на:

```js
                } else if (action === 'delegate') {
                    showDelegateModal(task, saveTask, 'задачу', x, y);
```

- [ ] **Step 3: Проверка синтаксиса**

Run: `node --check app.js`
Expected: без вывода (exit code 0).

- [ ] **Step 4: Ручная проверка делегирования задачи**

Открыть `index.html`, залогиниться как admin, на любой задаче нажать «Делегировать» → открывается окно «Делегировать задачу», выбор сотрудника, после подтверждения у задачи меняется исполнитель и появляется стрелка. Затем то же проверить на сотруднике (у него делегирование не скрыто для созданной им задачи).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: generalize showDelegateModal for tasks and reports"
```

---

### Task 2: Кнопки «Выполнить» и «Делегировать» + стрелка в карточке отчёта

**Files:**
- Modify: `app.js:1801-1851` (функция `createReportCard`)

**Interfaces:**
- Consumes: `report`, `currentUser`, `reports`, `changeReportStatus`, `showReportDetails`, `openReportModal`, `removeReport`, `showDelegateModal(report, saveReport, 'отчёт', x, y)` (из Task 1), `formatUserName`, `escapeHtml`, `formatDateTime`.
- Produces: карточка отчёта с кнопками «Выполнить»/«Делегировать» и стрелкой делегирования.

- [ ] **Step 1: Добавить стрелку делегирования и кнопки**

Заменить в `createReportCard` (строки 1811-1828) блок построения `div.innerHTML` на:

```js
        div.innerHTML =
            (report.delegated
                ? '<span class="task-delegate-arrow ' + (report.assignedTo === currentUser.login ? 'arrow-received' : 'arrow-delegated') + '">' + (report.assignedTo === currentUser.login ? '↙' : '↗') + '</span>'
                : '') +
            '<div class="task-title">' + escapeHtml(report.title || 'Без названия') + '</div>' +
            '<div class="task-meta">' +
                '<span>📄 ' + escapeHtml(numberLabel) + '</span>' +
                (report.dueDate ? '<span>⏳ ' + formatDateTime(report.dueDate) + '</span>' : '') +
                (assigneeLabel ? '<span>' + assigneeLabel + '</span>' : '') +
                '<span>👤 ' + escapeHtml(formatUserName(report.createdBy)) + '</span>' +
            '</div>' +
            '<div class="task-actions-row1">' +
                '<button class="btn-done" data-action="done"><i class="fa-solid fa-check"></i> Выполнить</button>' +
                (report.status !== 'done' && (currentUser.role === 'admin' || currentUser.login === report.createdBy)
                    ? '<button class="btn-delegate" data-action="delegate"><i class="fa-solid fa-paper-plane"></i> Делегировать</button>'
                    : '') +
            '</div>' +
            '<div class="task-actions-row2">' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-delete" data-action="delete" title="Удалить"><i class="fa-solid fa-trash"></i></button>'
                    : '') +
                '<button class="btn-settings" data-action="settings" title="Изменить"><i class="fa-solid fa-gear"></i></button>' +
                '<button class="btn-open" data-action="open" title="Открыть"><i class="fa-solid fa-circle-info"></i></button>' +
            '</div>';
```

- [ ] **Step 2: Добавить обработку действия «delegate»**

В обработчике `div.querySelectorAll('[data-action]').forEach(...)` (строки 1830-1848), в цепочку `if/else if` после ветки `action === 'done'` (строка 1841-1842) добавить:

```js
                } else if (action === 'delegate') {
                    showDelegateModal(report, saveReport, 'отчёт', x, y);
```

- [ ] **Step 3: Проверка синтаксиса**

Run: `node --check app.js`
Expected: без вывода (exit code 0).

- [ ] **Step 4: Ручная проверка**

В `index.html`: у карточки отчёта в первом ряду кнопки «Выполнить» и «Делегировать» (у admin — у всех, у сотрудника — только у своих отчётов). «Выполнить» архивирует отчёт. «Делегировать» открывает окно «Делегировать отчёт», после выбора сотрудника на карточке появляется стрелка. После архивации кнопки «Выполнить»/«Делегировать» исчезают (у отчётов в архиве row1 кнопок нет — проверка только на активных).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add done/delegate buttons and delegation arrow to report card"
```

---

### Task 3: Строка «Делегировано» в деталях отчёта

**Files:**
- Modify: `app.js:1316-1340` (функция `showReportDetails`)

**Interfaces:**
- Consumes: `report`, `formatUserName`, `formatDateTime`, `escapeHtml`, `PRIORITY_LABELS`, `positionModalAtPoint`.
- Produces: в окне деталей отчёта строка «Делегировано» при `report.delegated`.

- [ ] **Step 1: Добавить строку «Делегировано»**

В `showReportDetails` после строки с «Исполнитель» (строка 1331) добавить:

```js
                    (report.delegated ? '<p><strong>Делегировано:</strong> ' + (report.delegatedBy === 'admin' ? 'Руководителем' : 'Сотрудником') + '</p>' : '') +
```

- [ ] **Step 2: Проверка синтаксиса**

Run: `node --check app.js`
Expected: без вывода (exit code 0).

- [ ] **Step 3: Ручная проверка**

В `index.html` у делегированного отчёта нажать «Открыть» — в окне деталей видна строка «Делегировано: Руководителем/Сотрудником». У не-делегированного строки нет.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: show delegated info in report details"
```

---

### Task 4: Удаление сотрудника в списке пользователей

**Files:**
- Modify: `app.js:881-900` (функция `renderUsersList`)

**Interfaces:**
- Consumes: `users`, `currentUser`, `tasks`, `reports`, `removeUser`, `saveTask`, `saveReport`, `getUsersRef`, `escapeHtml`.
- Produces: `deleteUser(login)` — удаление сотрудника с очисткой исполнителя в его задачах/отчётах и обновлением списка.

- [ ] **Step 1: Добавить кнопку «Удалить» в строку пользователя**

Заменить в `renderUsersList` (строки 888-890) блок `user-row-actions`:

```js
                    '<div class="user-row-actions">' +
                        '<button class="btn outline btn-edit-user" data-login="' + escapeHtml(u.login) + '" style="padding:0.2rem 0.6rem;font-size:0.8rem;">Изменить</button>' +
                        '<button class="btn outline btn-delete-user" data-login="' + escapeHtml(u.login) + '" style="padding:0.2rem 0.6rem;font-size:0.8rem;color:#dc2626;">Удалить</button>' +
                    '</div>' +
```

- [ ] **Step 2: Добавить обработчик клика**

После блока `usersList.querySelectorAll('.btn-edit-user').forEach(...)` (строки 895-899) добавить:

```js
        usersList.querySelectorAll('.btn-delete-user').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                deleteUser(this.dataset.login);
            });
        });
```

- [ ] **Step 3: Добавить функцию `deleteUser`**

Сразу после `renderUsersList` (перед `openEditUserModal`) вставить:

```js
    function deleteUser(login) {
        var user = users.find(function(u) { return u.login === login; });
        if (!user) return;
        if (login === 'admin') {
            alert('Нельзя удалить основную учётную запись администратора');
            return;
        }
        if (login === currentUser.login) {
            alert('Вы не можете удалить самого себя');
            return;
        }
        if (!confirm('Удалить сотрудника ' + login + '?')) return;
        removeUser(login);
        tasks.forEach(function(t) {
            if (t.assignedTo === login) {
                saveTask(Object.assign({}, t, { assignedTo: '', updatedAt: new Date().toISOString() }));
            }
        });
        reports.forEach(function(r) {
            if (r.assignedTo === login) {
                saveReport(Object.assign({}, r, { assignedTo: '', updatedAt: new Date().toISOString() }));
            }
        });
        getUsersRef().once('value').then(function(snapshot) {
            const data = snapshot.val();
            users = data ? Object.values(data) : [];
            renderUsersList();
        });
    }
```

- [ ] **Step 4: Проверка синтаксиса**

Run: `node --check app.js`
Expected: без вывода (exit code 0).

- [ ] **Step 5: Ручная проверка**

В `index.html` (admin → «Пользователи»): у каждой строки кнопка «Удалить». Нажатие на `admin` — alert «Нельзя удалить основную учётную запись администратора». Нажатие на себя — alert «Вы не можете удалить самого себя». Удаление сотрудника: подтверждение, строка исчезает, в его задачах/отчётах исполнитель очищен (в карточках «не назначен»), в select исполнителей его нет.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: allow admin to delete users with assignee cleanup"
```

---

## Self-Review

- **Покрытие спеки report-card-done-delegate-buttons:** кнопка «Выполнить» (Task 2), кнопка «Делегировать» и стрелка (Task 2), обобщение `showDelegateModal` (Task 1), строка «Делегировано» в деталях (Task 3), архив без изменений (не затронут). ✓
- **Покрытие спеки user-deletion:** кнопка «Удалить» (Task 4), защита от удаления admin/себя (Task 4), очистка `assignedTo` в задачах и отчётах (Task 4), обновление списка (Task 4). ✓
- **Заглушки:** отсутствуют — все шаги содержат полный код.
- **Согласованность сигнатур:** `showDelegateModal(item, saveFn, kind, x, y)` используется в Task 1 (задача) и Task 2 (отчёт) одинаково; `deleteUser(login)` един в Task 4.
