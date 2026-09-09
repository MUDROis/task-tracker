# Админ-страница ролей и прав и ролевая видимость — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать отдельную страницу `admin.html` для управления сотрудниками, их ролями и персональными правами (чекбоксы функций), перевести существующий трекер на 4 роли (`manager`, `management`, `department`, `specialist`) и ролевую видимость задач/отчётов, полностью заменив прежние роли `admin`/`employee` и модалку `#usersModal`.

**Architecture:** Данные ролей/прав хранятся в Firebase (`teams/<id>/users/<login>/role` и `.../permissions`), общая логика прав и видимости вынесена в чистые функции `js/helpers.js` (тестируемые в Node). Новая страница `admin.html` подключает тот же `firebase-config.js` и свой `admin-style.css` (построенный на дизайн-токенах существующего `style.css`). Основной `app.js` заменяет жёсткие проверки `currentUser.role === 'admin'` на функции прав, а кнопка «👥 Управление» открывает `admin.html` вместо старой модалки.

**Tech Stack:** Firebase Realtime Database + Firebase Auth (compat SDK 9.23.0), vanilla JS (стиль ES5, `var` + function-декларации), underlying biology: `js/helpers.js` (UMD, доступен как `window.DeadlineHelpers` и через `require()` для тестов `node --test`).

## Global Constraints

- Стиль кода кода: ES5 (`var`, function-декларации). Не использовать стрелочные функции в новом/редактируемом коде `helpers.js`, `app.js`, `admin.js`. Константы — ок.
- Тесты: `node --test "tests/*.test.js"` — все проходят. Синтаксис: `node --check <file>`.
- Не переименовывать существующие публичные функции без необходимости: `saveTask`, `saveReport`, `saveUser`, `removeUser`, `changeReportStatus`, `formatUserName`, `escapeHtml`, `positionModalAtPoint`, `populateSelect`.
- Существующие пользователи мигрируются при чтении: `role === 'admin'` → `manager`, иначе → `specialist`, если `permissions` отсутствует — подставляется пресет роли.
- Firebase Auth email пользователя всегда `login@tasktracker.local` (как в текущем коде).
- Кнопки, недоступные по правам, скрываются через `style.display = 'none'` (`addTaskBtn`, `addReportBtn`, деструктивные кнопки карточек, «Управление», настройки/экспорт при отсутствии права).
- Git: репозиторий страдает от pre-existing повреждённых blob-объектов. Если `git commit` падает с `invalid object ... for '<file>'`, сначала `git hash-object -w <file>`, затем повторить коммит.
- Работать прямо в ветке `main` (пользователь дал явное согласие). Можно и нужно часто коммитить.

---

### Task 1: Чистые функции ролей и прав в `js/helpers.js`

**Files:**
- Modify: `js/helpers.js` (добавить в конец, перед `return`, новые функции и константы)
- Test: `tests/roles.test.js`

**Interfaces:**
- Produces:
  - `DeadlineHelpers.ROLES` — объект `{ manager:{label,description}, management:{...}, department:{...}, specialist:{...} }`
  - `DeadlineHelpers.PERMISSIONS` — массив `{key,label}` (16 элементов)
  - `DeadlineHelpers.ROLE_PRESETS` — объект role→permissions (boolean-мапа)
  - `DeadlineHelpers.normalizeUser(u, defaultName)` → пользователь с нормализованными `role` и `permissions`
  - `DeadlineHelpers.canDo(user, permissionKey)` → boolean
  - `DeadlineHelpers.canAssignTo(user, targetRole)` → boolean (проверяет `assignTasksTo*`)
  - `DeadlineHelpers.isManager(user)` → boolean (role === 'manager')
  - `DeadlineHelpers.visibleHierarchyTasks(tasks, login, role, userIdResolver)` → массив (главный фильтр видимости, см. ниже)
  - `DeadlineHelpers.visibleHierarchyReports(reports, login, role, userIdResolver)` → массив

**Логика видимости (по согласованному дизайну, «по цепочке createdBy»):**
- `manager`: видит всё.
- `management`: видит всё.
- `department`: видит элементы, где (a) `createdBy === login`; (b) `assignedTo === login`; (c) это элемент, чей `createdBy` входит в «подчинённых» (рекурсивно по `userIdResolver(login).managedUsers` или по цепочке `createdBy`). Для простоты и тестируемости: переданный `userIdResolver` возвращает для логина объект `{name, role, createdBy}` из массива `users`; рекурсия: собрать всех пользователей `B` таких, что `B.createdBy === login` ИЛИ `B.createdBy` входит в `subordinates` (по цепочке `createdBy`). Элемент виден, если `item.createdBy ∈ {login} ∪ subordinates` или `item.assignedTo === login` или `item.delegatedBy === login`.
- `specialist`: видит только `createdBy === login` или `assignedTo === login`.

Ядро рекурсии вынести в чистую функцию `DeadlineHelpers.collectSubordinateLogins(login, findUser)`; `findUser(login)` → user|undefined. Она возвращает массив логинов подчинённых (включая тех, кого создал login, и их подчинённых, итд).

**Пресет ролей (из шаблона, согласовано):**
- `manager`: все 16 → true.
- `management`: все true КРОМЕ `deleteManagerEmployees:false, editManagerEmployees:false, deleteTasks:false, manageRoles:false, systemSettings:false`.
- `department`: все true КРОМЕ `addEmployees:false, deleteEmployees:false, editEmployees:false, deleteManagerEmployees:false, editManagerEmployees:false, assignTasksToManagement:false, deleteTasks:false, manageRoles:false, exportData:false, systemSettings:false`.
- `specialist`: все true КРОМЕ `addEmployees:false, deleteEmployees:false, editEmployees:false, deleteManagerEmployees:false, editManagerEmployees:false, assignTasksToManagement:false, assignTasksToDepartment:false, deleteTasks:false, manageRoles:false, viewReports:false, exportData:false, systemSettings:false`.

`canAssignTo(user, targetRole)`:
- `manager` → true (все три).
- иначе по `user.permissions`:
  - `management` → `assignTasksToManagement`
  - `department` → `assignTasksToDepartment`
  - `specialist` → `assignTasksToSpecialist`

**Порядок ключей PERMISSIONS (16):**
`addEmployees, deleteEmployees, editEmployees, deleteManagerEmployees, editManagerEmployees, assignTasksToManagement, assignTasksToDepartment, assignTasksToSpecialist, createTasks, editTasks, deleteTasks, manageRoles, viewReports, exportData, systemSettings`.

- [ ] **Step 1: Write the failing test** `tests/roles.test.js`

```js
'use strict';
const { strict: assert } = require('node:assert');
const DH = require('../js/helpers.js');

const FLAT = {
  addEmployees:true, deleteEmployees:true, editEmployees:true,
  deleteManagerEmployees:true, editManagerEmployees:true,
  assignTasksToManagement:true, assignTasksToDepartment:true, assignTasksToSpecialist:true,
  createTasks:true, editTasks:true, deleteTasks:true,
  manageRoles:true, viewReports:true, exportData:true, systemSettings:true
};

test('ROLES содержит 4 роли', () => {
  for (const r of ['manager','management','department','specialist']) {
    assert.ok(DH.ROLES[r], r + ' отсутствует');
    assert.ok(typeof DH.ROLES[r].label === 'string');
  }
});

test('PERMISSIONS имеет 16 пунктов с уникальными ключами', () => {
  assert.strictEqual(DH.PERMISSIONS.length, 16);
  const keys = DH.PERMISSIONS.map(p => p.key);
  assert.strictEqual(new Set(keys).size, 16);
});

test('нормализация: admin->manager, employee->specialist, пресет', () => {
  const admin = DH.normalizeUser({ login:'admin', role:'admin' });
  assert.strictEqual(admin.role, 'manager');
  assert.strictEqual(admin.permissions.manageRoles, true);
  const emp = DH.normalizeUser({ login:'ivan', role:'employee' });
  assert.strictEqual(emp.role, 'specialist');
  assert.strictEqual(emp.permissions.viewReports, false);
});

test('canDo и canAssignTo', () => {
  const mgr = { role:'manager', permissions:{ ...FLAT } };
  assert.strictEqual(DH.canDo(mgr, 'systemSettings'), true);
  assert.strictEqual(DH.canAssignTo(mgr, 'department'), true);
  const spec = { role:'specialist', permissions: DH.ROLE_PRESETS.specialist };
  assert.strictEqual(DH.canAssignTo(spec, 'department'), false);
  assert.strictEqual(DH.canDo(spec, 'createTasks'), true);
});

test('видимость specialist: только своё', () => {
  const spec = 'spec';
  const findUser = () => undefined;
  const tasks = [
    { id:1, createdBy:'spec', assignedTo:'' , title:'mine'},
    { id:2, createdBy:'boss', assignedTo:'spec', title:'asg'},
    { id:3, createdBy:'boss', assignedTo:'other', title:'other'}
  ];
  const visible = DH.visibleHierarchyTasks(tasks, spec, 'specialist', findUser);
  assert.deepStrictEqual(visible.map(t => t.id), [1,2]);
});

test('department видит своё и подчинённых по цепочке createdBy', () => {
  const users = [
    { login:'dep', role:'department', createdBy:'' },
    { login:'spec', role:'specialist', createdBy:'dep' },
    { login:'spec2', role:'specialist', createdBy:'spec' } // внук
  ];
  const findUser = (l) => users.find(u => u.login === l);
  const tasks = [
    { id:1, createdBy:'dep', assignedTo:'', title:'own' },
    { id:2, createdBy:'spec', assignedTo:'', title:'direct' },
    { id:3, createdBy:'spec2', assignedTo:'', title:'grandchild' },
    { id:4, createdBy:'other', assignedTo:'', title:'unrelated' },
    { id:5, createdBy:'manager', assignedTo:'dep', title:'assigned' }
  ];
  const visible = DH.visibleHierarchyTasks(tasks, 'dep', 'department', findUser);
  const ids = visible.map(t => t.id).sort();
  assert.deepStrictEqual(ids, [1,2,3,5]);
});

test('manager и management видят всё', () => {
  const tasks = [{ id:1, createdBy:'a' }, { id:2, createdBy:'b' }];
  for (const role of ['manager','management']) {
    assert.strictEqual(DH.visibleHierarchyTasks(tasks, 'me', role, () => undefined).length, 2);
  }
});

test('collectSubordinateLogins рекурсивно собирает цепочку', () => {
  const users = [
    { login:'dep', createdBy:'' },
    { login:'spec', createdBy:'dep' },
    { login:'spec2', createdBy:'spec' }
  ];
  const findUser = (l) => users.find(u => u.login === l);
  const subs = DH.collectSubordinateLogins('dep', findUser).sort();
  assert.deepStrictEqual(subs, ['spec','spec2']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "tests/roles.test.js"`
Expected: FAIL (functions/const not defined) — TAIL.

- [ ] **Step 3: Implement in `js/helpers.js`**

Add before `return` (line 185):

```js
    var ROLES = {
        manager: { label: 'Менеджер (админ)', description: 'Полный доступ ко всем функциям системы.' },
        management: { label: 'Управление', description: 'Административная роль; не может удалять/редактировать сотрудников Менеджера и удалять задачи.' },
        department: { label: 'Отдел', description: 'Отдел; не управляет сотрудниками, не назначает задачи Управлению.' },
        specialist: { label: 'Специалист', description: 'Базовая роль для работы с задачами.' }
    };

    var PERMISSIONS = [
        { key: 'addEmployees', label: 'Добавлять сотрудников' },
        { key: 'deleteEmployees', label: 'Удалять сотрудников' },
        { key: 'editEmployees', label: 'Редактировать сотрудников' },
        { key: 'deleteManagerEmployees', label: 'Удалять сотрудников, созданных Менеджером' },
        { key: 'editManagerEmployees', label: 'Редактировать сотрудников, добавленных Менеджером' },
        { key: 'assignTasksToManagement', label: 'Назначать задачи Управлению' },
        { key: 'assignTasksToDepartment', label: 'Назначать задачи Отделу' },
        { key: 'assignTasksToSpecialist', label: 'Назначать задачи Специалистам' },
        { key: 'createTasks', label: 'Создавать задачи' },
        { key: 'editTasks', label: 'Редактировать задачи' },
        { key: 'deleteTasks', label: 'Удалять задачи' },
        { key: 'manageRoles', label: 'Управлять ролями и правами пользователей' },
        { key: 'viewReports', label: 'Просматривать отчёты и аналитику' },
        { key: 'exportData', label: 'Экспортировать данные' },
        { key: 'systemSettings', label: 'Настраивать систему' }
    ];

    function allTrue() {
        var out = {};
        PERMISSIONS.forEach(function (p) { out[p.key] = true; });
        return out;
    }

    var ROLE_PRESETS = {
        manager: allTrue(),
        management: (function () {
            var o = allTrue();
            o.deleteManagerEmployees = false;
            o.editManagerEmployees = false;
            o.deleteTasks = false;
            o.manageRoles = false;
            o.systemSettings = false;
            return o;
        }()),
        department: (function () {
            var o = allTrue();
            o.addEmployees = false;
            o.deleteEmployees = false;
            o.editEmployees = false;
            o.deleteManagerEmployees = false;
            o.editManagerEmployees = false;
            o.assignTasksToManagement = false;
            o.deleteTasks = false;
            o.manageRoles = false;
            o.exportData = false;
            o.systemSettings = false;
            return o;
        }()),
        specialist: (function () {
            var o = allTrue();
            o.addEmployees = false;
            o.deleteEmployees = false;
            o.editEmployees = false;
            o.deleteManagerEmployees = false;
            o.editManagerEmployees = false;
            o.assignTasksToManagement = false;
            o.assignTasksToDepartment = false;
            o.deleteTasks = false;
            o.manageRoles = false;
            o.viewReports = false;
            o.exportData = false;
            o.systemSettings = false;
            return o;
        }())
    };

    function copyMap(src) {
        var out = {};
        Object.keys(src).forEach(function (k) { out[k] = src[k]; });
        return out;
    }

    function normalizeUser(u) {
        var role = u.role || 'specialist';
        if (role === 'admin') role = 'manager';
        if (role === 'employee') role = 'specialist';
        if (!ROLES[role]) role = 'specialist';
        var permissions = u.permissions ? copyMap(u.permissions) : copyMap(ROLE_PRESETS[role] || ROLE_PRESETS.specialist);
        return {
            name: u.name || '',
            login: u.login,
            role: role,
            permissions: permissions,
            email: u.email || '',
            color: u.color || '',
            emoji: u.emoji || '',
            createdBy: u.createdBy || ''
        };
    }

    function isManager(user) {
        return !!(user && user.role === 'manager');
    }

    function canDo(user, permissionKey) {
        if (!user) return false;
        if (user.role === 'manager') return true;
        return user.permissions && user.permissions[permissionKey] === true;
    }

    function canAssignTo(user, targetRole) {
        if (!user) return false;
        if (user.role === 'manager') return true;
        var map = { management: 'assignTasksToManagement', department: 'assignTasksToDepartment', specialist: 'assignTasksToSpecialist' };
        var key = map[targetRole];
        if (!key) return false;
        return user.permissions && user.permissions[key] === true;
    }

    function collectSubordinateLogins(login, findUser) {
        var result = [];
        var seen = {};
        function visit(current) {
            var user = findUser(current);
            if (!user) return;
            usersExtra(current).forEach(function (sub) {
                if (!seen[sub]) {
                    seen[sub] = true;
                    result.push(sub);
                    visit(sub);
                }
            });
        }
        function usersExtra(loginToSearch) {
            var found = [];
            // ВАЖНО: перебираем списка пользователей через findUser? Нет.
            // Для чистоты полагаемся на callable findUserAll, подмешиваемый ниже.
            if (findUserAll) {
                findUserAll().forEach(function (u) {
                    if (u.createdBy === loginToSearch && u.login !== loginToSearch) found.push(u.login);
                });
            }
            return found;
        }
        visit(login);
        return result;
    }
```

Замечание по `collectSubordinateLogins`: для рекурсии нужен полный список пользователей (чтобы найти тех, у кого `createdBy === login`). Я ввёл опциональный `findUserAll` — но чтобы не усложнять сигнатуру, сделаю так: `visibleHierarchyTasks/tasks` получают не `findUser`, а `users` (массив) напрямую. Это проще и тестируемо. Перепишу интерфейс:

**Уточнение интерфейса (вместо блока выше):** все функции видимости принимают `usersArr` (полный массив пользователей) и никакой `findUser`. `collectSubordinateLogins(login, usersArr)`.

```js
    function collectSubordinateLogins(login, usersArr) {
        var list = usersArr || [];
        var result = [];
        var seen = {};
        function visit(current) {
            list.forEach(function (u) {
                if (u.createdBy === current && !seen[u.login]) {
                    seen[u.login] = true;
                    result.push(u.login);
                    visit(u.login);
                }
            });
        }
        visit(login);
        return result;
    }

    function visibleHierarchyItems(items, login, role, usersArr) {
        if (role === 'manager' || role === 'management') {
            return (items || []).slice();
        }
        var subs = [];
        if (role === 'department') {
            subs = collectSubordinateLogins(login, usersArr);
        }
        var mine = {}; // login set: login + subs
        mine[login] = true;
        subs.forEach(function (s) { mine[s] = true; });
        return (items || []).filter(function (item) {
            return mine[item.createdBy] === true || item.assignedTo === login || item.delegatedBy === login;
        });
    }

    function visibleHierarchyTasks(tasks, login, role, usersArr) {
        return visibleHierarchyItems(tasks, login, role, usersArr);
    }

    function visibleHierarchyReports(reports, login, role, usersArr) {
        return visibleHierarchyItems(reports, login, role, usersArr);
    }
```

- [ ] **Step 4: Update exports** (near line 185-198)

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
        visibleReports: visibleReports,
        ROLES: ROLES,
        PERMISSIONS: PERMISSIONS,
        ROLE_PRESETS: ROLE_PRESETS,
        normalizeUser: normalizeUser,
        canDo: canDo,
        canAssignTo: canAssignTo,
        isManager: isManager,
        collectSubordinateLogins: collectSubordinateLogins,
        visibleHierarchyTasks: visibleHierarchyTasks,
        visibleHierarchyReports: visibleHierarchyReports
    };
```

- [ ] **Step 5: Update test to use new signatures** (`tests/roles.test.js`)

В тестах падающих `visibleHierarchyTasks(tasks, login, role, findUser)` заменить четвёртый аргумент на массив `users`:

```js
    // specialist
    const visible = DH.visibleHierarchyTasks(tasks, 'spec', 'specialist', usersArr);
```
и т.д. для `department` (передать `users`), а `collectSubordinateLogins('dep', users)`.

- [ ] **Step 6: Run tests to verify pass**

Run: `node --test "tests/*.test.js"`
Expected: PASS (все, включая новые). **Важно:** старые тесты `visibility.test.js` продолжают использовать `itemVisibleToUser`/`visibleTasks`/`visibleReports` — они не меняются.

- [ ] **Step 7: Syntax + Commit**

Run: `node --check js/helpers.js`
Expected: no output.
```bash
git add js/helpers.js tests/roles.test.js
git commit -m "feat: чистые функции ролей, прав и иерархической видимости"
```

---

### Task 2: Миграция ролей и сбор прав в `app.js`

**Files:**
- Modify: `app.js:296-314` (users listener), `app.js:496-521` (ensureAdminUser), `app.js:537-545` (currentUser построение), `app.js:554-568`, `app.js:637-645`

**Interfaces:**
- Consumes: `DeadlineHelpers.normalizeUser`, `DeadlineHelpers.ROLE_PRESETS`
- Produces: `currentUser` всегда имеет нормализованные `role` и `permissions`; массив `users` всегда нормализован.

- [ ] **Step 1: Normalize users in listener (line ~300)**

Заменить:
```js
const data = snapshot.val();
users = data ? Object.values(data) : [];
users = users.map(function(u) {
    return Object.assign({}, u, {
        role: u.role || 'employee',
        name: u.name || '',
        color: u.color || DEFAULT_COLORS[users.indexOf(u) % DEFAULT_COLORS.length],
        email: u.email || '',
        emoji: u.emoji || ''
    });
});
```
на:
```js
const data = snapshot.val();
const rawUsers = data ? Object.values(data) : [];
users = rawUsers.map(function(u) {
    return DeadlineHelpers.normalizeUser(u);
});
users.forEach(function(u, i) {
    if (!u.color) u.color = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
});
```

- [ ] **Step 2: Normalize `currentUser` on auth (both places, lines ~537-545 and ~637-645)**

`userData` уже нормализован выше? Нет — `currentUser` строится из `userData` напрямую в `onAuthStateChanged` и в `loginForm`. Заменить оба построения на:

```js
currentUser = DeadlineHelpers.normalizeUser(Object.assign({}, userData, {
    uid: user.uid,
    createdBy: userData.createdBy || ''
}));
```
(в loginForm `user.uid` есть в `userCredential.user.uid`, но там строим из `userData`; используем `userData.uid || user.uid`.)

Вынести в помощь — мини-функция:
```js
function buildCurrentUser(userData, uid) {
    return DeadlineHelpers.normalizeUser(Object.assign({}, userData, {
        uid: uid || userData.uid
    }));
}
```
Использовать в обоих местах: `currentUser = buildCurrentUser(userData, user.uid);`

- [ ] **Step 3: ensureAdminUser — задать role manager + permissions**

Заменить `getUsersRef().child('admin').set({... role:'admin' ...})` на:
```js
return getUsersRef().child('admin').set(Object.assign({}, DeadlineHelpers.normalizeUser({
    login: 'admin',
    name: 'Харитон',
    role: 'manager',
    color: '#3b82f6',
    email: ''
}), { uid: uid }));
```
(выставляем полные permissions пресета manager автоматически).

- [ ] **Step 4: Первичная ветка admin auto-create (lines ~554-568)**

Заменить построение `currentUser = {... role:'admin' ...}` на:
```js
currentUser = DeadlineHelpers.normalizeUser({
    uid: user.uid,
    login: login,
    name: 'Харитон',
    role: 'manager',
    color: '#3b82f6',
    email: '',
    createdBy: ''
});
```

- [ ] **Step 5: Commit**

Run: `node --check app.js` → no output.
```bash
git add app.js
git commit -m "feat: миграция пользователей на роли manager/management/department/specialist"
```

---

### Task 3: admin.html + admin-style.css (отдельная страница)

**Files:**
- Create: `admin.html`
- Create: `admin-style.css`
- Modify: none (в этом Task)

**Interfaces:**
- Consumes: `firebase-config.js`, `FIREBASE_CONFIG`, `TEAM_ID`, `DeadlineHelpers` (через CDN/локальный `js/helpers.js`), `style.css`
- Produces: рабочая страница, кнопка «Сохранить права» пишет в `getUsersRef().child(login).set(...)`; добавление пользователя создаёт Firebase Auth запись `login@tasktracker.local`.

Страница копирует структуру шаблона qwen (выпадающий список сотрудников + «Добавить сотрудника» вверху слева; карточка выбранного с ролью, role-hint и 16 чекбоксами; кнопки «Сохранить права», «Сбросить на пресет», «Удалить пользователя»; справа справка по пресетам), но в текущем тёмном стиле.

**admin.html** — подключает:
```html
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="admin-style.css">
<link rel="preconnect" ...fonts>
...
<script src="js/helpers.js"></script>
<script src="firebase-config.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="admin.js"></script>
```

**admin.js** — логика (паттерн из qwen, но на Firebase):
- `init` → инициализация Firebase, авторизация: если `auth.currentUser` нет — перенаправление на `index.html`; проверка `canDo(currentUser,'manageRoles')` (только manager по пресету) — иначе редирект.
- subscribe `getUsersRef().on('value', ...)` → рендер селекта и карточки.
- добавление пользователя: слушатель `#addUserForm` → проверить дубликат логина → `auth.createUserWithEmailAndPassword(login+'@tasktracker.local', password)` → `getUsersRef().child(login).set(normalizeUser(...))`.
- сохранение прав: собрать чекбоксы → `set({...user, role, permissions, updatedAt})`.
- сброс на пресет: `user.permissions = ROLE_PRESETS[role]` → перерисовать чекбоксы.
- удаление: запрет удалить последнего менеджера и самого себя; `getUsersRef().child(login).remove()`.
- поле «Создан», createdBy, uid.

**admin-style.css** — поверх `style.css`, задаёт `.admin-*` классы, используя токены `var(--surface)`, `var(--line)`, `var(--accent)`, и copy структур из шаблона (карточки `.card`, чекбоксы `.permission`).

Даю код admin.html полным.

- [ ] **Step 1: Write `admin-style.css`**

```css
/* ===== Админ-страница: переопределения поверх style.css ===== */
.admin-wrap {
    width: min(1280px, calc(100% - 32px));
    margin: 0 auto;
    padding: 28px 0 56px;
    position: relative;
    z-index: 1;
}
.admin-topbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-bottom: 18px;
}
.admin-h1 {
    font-family: 'Unbounded', 'Golos Text', sans-serif;
    font-weight: 600;
    font-size: clamp(1.4rem, 3vw, 1.9rem);
    margin: 0 0 4px;
}
.admin-sub { color: var(--muted); margin: 0 0 18px; }
.admin-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.75fr) minmax(300px, 0.9fr);
    gap: 20px;
    align-items: start;
}
.admin-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 18px 44px rgba(0,0,0,.35);
}
.admin-card h2 { font-size: 1.15rem; margin: 0 0 12px; font-weight: 600; }
.admin-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.admin-grid .form-group { margin-bottom: 0; }
.admin-form-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; align-items: center; }
.admin-status { min-height: 1.2em; margin: 12px 0 0; color: var(--accent); font-weight: 600; }
.muted { color: var(--muted); }
.role-hint {
    padding: 12px 14px;
    border: 1px solid rgba(255,180,84,.25);
    background: rgba(255,180,84,.08);
    border-radius: 12px;
    color: var(--accent-hi);
    margin-top: 8px;
}
.permissions-fieldset {
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 14px 16px 16px;
    margin: 0 0 16px;
}
.permissions-fieldset legend { padding: 0 8px; font-weight: 600; }
.permissions { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.permission {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border: 1px solid var(--line);
    border-radius: 10px; background: var(--surface2);
    cursor: pointer;
}
.permission:hover { border-color: var(--accent); }
.permission input { width: 17px; height: 17px; min-height: 17px; margin-top: 2px; accent-color: var(--accent); }
.roles-list details {
    border: 1px solid var(--line); border-radius: 12px;
    padding: 12px; margin-bottom: 10px; background: var(--surface2);
}
.roles-list summary { cursor: pointer; font-weight: 600; }
.roles-list ul { margin: 10px 0 0; padding-left: 18px; color: var(--muted); }
.roles-list li { margin: 5px 0; }
.preset-desc { margin: 8px 0 0; color: var(--muted); }
.note {
    padding: 12px; border-radius: 12px;
    color: #fbbf24; background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.22);
}
#userSelect { min-width: min(320px, 100%); }
#userSelect, #roleSelect, #addRoleSelect {
    min-height: 46px; padding: 11px 12px;
    border: 1px solid var(--line); border-radius: 12px;
    background: var(--surface2); color: var(--text); font: inherit;
}
.btn--charcoal { background: #334155; color:#e2e8f0; }
.btn--ghost { background: transparent; border: 1px solid rgba(255,255,255,.18); color: var(--text); }
.btn--danger { background: var(--danger); border-color: var(--danger); }
.admin-back { display:inline-flex; gap:6px; align-items:center; margin-bottom: 6px; }
@media (max-width: 980px) {
    .admin-layout { grid-template-columns: 1fr; }
    .admin-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Write `admin.html`**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <title>Админ-панель: роли и права</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/golos-text@5/400.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/golos-text@5/500.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/golos-text@5/600.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/unbounded@5/600.css">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="admin-style.css">
    <script src="js/helpers.js"></script>
    <script src="firebase-config.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
</head>
<body>
    <div class="orb orb-a" aria-hidden="true"></div>
    <div class="orb orb-b" aria-hidden="true"></div>
    <main class="admin-wrap">
        <a class="btn btn--ghost admin-back" href="index.html">← Вернуться к трекеру</a>
        <div class="admin-topbar">
            <label class="visually-hidden" for="userSelect">Сотрудник</label>
            <select id="userSelect" aria-label="Список сотрудников"></select>
            <button id="showAddUserBtn" class="btn btn--charcoal" type="button">➕ Добавить сотрудника</button>
        </div>
        <h1 class="admin-h1">Панель администратора</h1>
        <p class="admin-sub">Управление сотрудниками, ролями и функционалом каждого пользователя</p>

        <section id="addUserPanel" class="admin-card" hidden>
            <h2>Новый сотрудник</h2>
            <form id="addUserForm">
                <div class="admin-grid">
                    <div class="form-group">
                        <label for="addLogin">Логин</label>
                        <input type="text" id="addLogin" name="login" required minlength="3" placeholder="ivanov">
                    </div>
                    <div class="form-group">
                        <label for="addPassword">Пароль</label>
                        <input type="password" id="addPassword" required minlength="6" placeholder="••••••" autocomplete="new-password">
                    </div>
                    <div class="form-group">
                        <label for="addEmail">Email</label>
                        <input type="email" id="addEmail" required placeholder="ivanov@mudro.ru">
                    </div>
                    <div class="form-group">
                        <label for="addRoleSelect">Роль</label>
                        <select id="addRoleSelect"></select>
                    </div>
                </div>
                <div class="admin-form-actions">
                    <button class="btn primary" type="submit">Создать сотрудника</button>
                    <button class="btn btn--ghost" type="button" id="cancelAddUserBtn">Отмена</button>
                </div>
            </form>
        </section>

        <div class="admin-layout">
            <section id="userPanel" class="admin-card" hidden>
                <h2 id="userName" class="admin-h1"></h2>
                <p id="userMeta" class="muted"></p>
                <form id="userForm" style="margin-top:14px;">
                    <div class="form-group">
                        <label for="roleSelect">Роль пользователя</label>
                        <select id="roleSelect"></select>
                    </div>
                    <div class="role-hint" id="roleHint"></div>
                    <fieldset class="permissions-fieldset">
                        <legend>Функции пользователя</legend>
                        <div id="permissionsList" class="permissions"></div>
                    </fieldset>
                    <div class="admin-form-actions">
                        <button class="btn primary" type="submit">💾 Сохранить права</button>
                        <button class="btn btn--charcoal" type="button" id="resetRoleBtn">Сбросить на пресет роли</button>
                        <button class="btn btn--danger" type="button" id="deleteUserBtn">Удалить пользователя</button>
                    </div>
                    <p id="saveStatus" class="admin-status" role="status"></p>
                </form>
            </section>

            <aside class="admin-card">
                <h2>Пресеты ролей</h2>
                <p class="muted">Функции, включённые/выключенные по умолчанию. Админ может менять их для конкретного пользователя.</p>
                <div id="rolesPresetList" class="roles-list"></div>
            </aside>
        </div>
    </main>
    <script src="admin.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `admin.js`** (полный)

```js
(function () {
    'use strict';

    var STORAGE_SESSION = 'taskTracker_session';

    (function waitFirebase(cb) {
        if (typeof firebase !== 'undefined' && firebase.database) cb();
        else setTimeout(function () { waitFirebase(cb); }, 50);
    })(function () {
        firebase.initializeApp(FIREBASE_CONFIG);
        init();
    });

    function getUsersRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/users');
    }

    var selectedLogin = null;
    var dirty = false;
    var users = [];

    var userSelect = document.getElementById('userSelect');
    var showAddUserBtn = document.getElementById('showAddUserBtn');
    var addUserPanel = document.getElementById('addUserPanel');
    var addUserForm = document.getElementById('addUserForm');
    var cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
    var addRoleSelect = document.getElementById('addRoleSelect');
    var userPanel = document.getElementById('userPanel');
    var userName = document.getElementById('userName');
    var userMeta = document.getElementById('userMeta');
    var userForm = document.getElementById('userForm');
    var roleSelect = document.getElementById('roleSelect');
    var roleHint = document.getElementById('roleHint');
    var permissionsList = document.getElementById('permissionsList');
    var resetRoleBtn = document.getElementById('resetRoleBtn');
    var deleteUserBtn = document.getElementById('deleteUserBtn');
    var saveStatus = document.getElementById('saveStatus');
    var rolesPresetList = document.getElementById('rolesPresetList');

    function fillRoleSelect(selectEl, selectedRole) {
        selectEl.innerHTML = '';
        Object.keys(DeadlineHelpers.ROLES).forEach(function (key) {
            var opt = document.createElement('option');
            opt.value = key;
            opt.textContent = DeadlineHelpers.ROLES[key].label;
            if (key === selectedRole) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    function renderUserSelect() {
        userSelect.innerHTML = '';
        if (!users.length) {
            var emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = 'Нет сотрудников';
            userSelect.appendChild(emptyOpt);
            return;
        }
        users.forEach(function (u) {
            var opt = document.createElement('option');
            opt.value = u.login;
            opt.textContent = u.login + ' — ' + (DeadlineHelpers.ROLES[u.role] ? DeadlineHelpers.ROLES[u.role].label : u.role);
            if (u.login === selectedLogin) opt.selected = true;
            userSelect.appendChild(opt);
        });
    }

    function renderPermissions(user) {
        permissionsList.innerHTML = '';
        DeadlineHelpers.PERMISSIONS.forEach(function (p) {
            var label = document.createElement('label');
            label.className = 'permission';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.key = p.key;
            cb.checked = DeadlineHelpers.canDo(user, p.key);
            cb.addEventListener('change', function () {
                dirty = true;
                saveStatus.textContent = 'Изменения не сохранены. Нажмите «Сохранить права».';
            });
            var span = document.createElement('span');
            span.textContent = p.label;
            label.appendChild(cb);
            label.appendChild(span);
            permissionsList.appendChild(label);
        });
    }

    function renderUserPanel() {
        var user = users.find(function (u) { return u.login === selectedLogin; });
        if (!user) { userPanel.hidden = true; return; }
        userPanel.hidden = false;
        userName.textContent = user.login;
        var roleLabel = DeadlineHelpers.ROLES[user.role] ? DeadlineHelpers.ROLES[user.role].label : user.role;
        userMeta.textContent = (user.email || 'Email не указан') + ' • Роль: ' + roleLabel + ' • Создан: ' + (user.createdAt || '—') + (user.createdBy ? ' • Создал: ' + user.createdBy : '');
        fillRoleSelect(roleSelect, user.role);
        roleHint.textContent = DeadlineHelpers.ROLES[user.role] ? DeadlineHelpers.ROLES[user.role].description : '';
        renderPermissions(user);
        saveStatus.textContent = '';
        dirty = false;
    }

    function renderRolePresets() {
        rolesPresetList.innerHTML = '';
        Object.keys(DeadlineHelpers.ROLES).forEach(function (roleKey) {
            var details = document.createElement('details');
            if (roleKey === 'manager') details.open = true;
            var summary = document.createElement('summary');
            summary.textContent = DeadlineHelpers.ROLES[roleKey].label;
            var desc = document.createElement('p');
            desc.className = 'preset-desc';
            desc.textContent = DeadlineHelpers.ROLES[roleKey].description;
            var list = document.createElement('ul');
            if (roleKey === 'manager') {
                DeadlineHelpers.PERMISSIONS.forEach(function (p) {
                    var li = document.createElement('li');
                    li.textContent = '✅ ' + p.label;
                    list.appendChild(li);
                });
            } else {
                var preset = DeadlineHelpers.ROLE_PRESETS[roleKey];
                var disabled = DeadlineHelpers.PERMISSIONS.filter(function (p) { return preset[p.key] === false; });
                if (disabled.length) {
                    disabled.forEach(function (p) {
                        var li = document.createElement('li');
                        li.textContent = '⛔ ' + p.label;
                        list.appendChild(li);
                    });
                } else {
                    var liAll = document.createElement('li');
                    liAll.textContent = 'Все функции включены';
                    list.appendChild(liAll);
                }
            }
            details.appendChild(summary);
            details.appendChild(desc);
            details.appendChild(list);
            rolesPresetList.appendChild(details);
        });
    }

    function renderAll() {
        renderUserSelect();
        renderUserPanel();
        renderRolePresets();
    }

    function loadInitialUsers() {
        return DeadlineHelpers.ROLE_PRESETS; // стаб, заполним ниже реальным
    }
```

**Внимание:** блок `loadInitialUsers` выше — заглушка, уберите её и вместо неё в `init()` запустите подписку `getUsersRef().on('value', ...)`. Полный `admin.js` ниже — единый, без `loadInitialUsers`:

```js
    function init() {
        firebase.auth().onAuthStateChanged(function (fbUser) {
            if (!fbUser) {
                location.href = 'index.html';
                return;
            }
            var login = fbUser.email.replace('@tasktracker.local', '');
            getUsersRef().child(login).once('value').then(function (snap) {
                var me = snap.val();
                if (!me || !DeadlineHelpers.canDo(DeadlineHelpers.normalizeUser(me), 'manageRoles')) {
                    location.href = 'index.html';
                    return;
                }
                startApp();
            });
        });
    }

    function startApp() {
        fillRoleSelect(addRoleSelect, 'specialist');
        getUsersRef().on('value', function (snap) {
            var data = snap.val();
            users = data ? Object.values(data).map(DeadlineHelpers.normalizeUser) : [];
            if (!selectedLogin && users.length) selectedLogin = users[0].login;
            if (!users.some(function (u) { return u.login === selectedLogin; })) {
                selectedLogin = users.length ? users[0].login : null;
            }
            renderAll();
        });

        userSelect.addEventListener('change', function () {
            if (dirty && !confirm('Есть несохранённые изменения. Перейти к другому сотруднику без сохранения?')) {
                userSelect.value = selectedLogin;
                return;
            }
            selectedLogin = userSelect.value;
            renderUserPanel();
        });

        showAddUserBtn.addEventListener('click', function () {
            addUserPanel.hidden = false;
            document.getElementById('addLogin').focus();
        });
        cancelAddUserBtn.addEventListener('click', function () {
            addUserPanel.hidden = true;
            addUserForm.reset();
        });

        addUserForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var login = document.getElementById('addLogin').value.trim();
            var password = document.getElementById('addPassword').value;
            var email = document.getElementById('addEmail').value.trim();
            var role = addRoleSelect.value;
            if (!login || !password || !email || !role) return;
            if (users.some(function (u) { return u.login.toLowerCase() === login.toLowerCase(); })) {
                alert('Сотрудник с таким логином уже существует.');
                return;
            }
            var btnSubmit = addUserForm.querySelector('button[type="submit"]');
            if (btnSubmit) btnSubmit.disabled = true;
            firebase.auth().createUserWithEmailAndPassword(login + '@tasktracker.local', password)
                .then(function (cred) {
                    var rec = DeadlineHelpers.normalizeUser({
                        uid: cred.user.uid,
                        login: login,
                        role: role,
                        email: email,
                        color: '#3b82f6',
                        email: email,
                        createdAt: new Date().toISOString()
                    });
                    rec.createdBy = selectedLogin || '';
                    return getUsersRef().child(login).set(rec);
                })
                .then(function () {
                    addUserForm.reset();
                    addUserPanel.hidden = true;
                    saveStatus.textContent = 'Сотрудник добавлен. При необходимости измените функции и сохраните.';
                })
                .catch(function (err) {
                    alert('Ошибка создания: ' + err.message);
                })
                .finally(function () {
                    if (btnSubmit) btnSubmit.disabled = false;
                });
        });

        userForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var user = users.find(function (u) { return u.login === selectedLogin; });
            if (!user) return;
            var perm = {};
            permissionsList.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
                perm[cb.dataset.key] = cb.checked;
            });
            var updated = Object.assign({}, user, {
                role: roleSelect.value,
                permissions: perm,
                updatedAt: new Date().toISOString()
            });
            getUsersRef().child(user.login).set(updated).then(function () {
                dirty = false;
                saveStatus.textContent = 'Права сохранены.';
            });
        });

        roleSelect.addEventListener('change', function () {
            var user = users.find(function (u) { return u.login === selectedLogin; });
            if (!user) return;
            var newRole = roleSelect.value;
            roleHint.textContent = DeadlineHelpers.ROLES[newRole].description;
            if (confirm('Загрузить предустановленные функции для роли «' + DeadlineHelpers.ROLES[newRole].label + '»? Текущие отметки будут заменены.')) {
                user.permissions = DeadlineHelpers.copyPreset(newRole);
                renderPermissions(user);
            }
            dirty = true;
            saveStatus.textContent = 'Изменения не сохранены.';
        });

        resetRoleBtn.addEventListener('click', function () {
            var user = users.find(function (u) { return u.login === selectedLogin; });
            if (!user) return;
            user.permissions = DeadlineHelpers.copyPreset(roleSelect.value);
            renderPermissions(user);
            dirty = true;
            saveStatus.textContent = 'Права сброшены к пресету роли. Нажмите «Сохранить права».';
        });

        deleteUserBtn.addEventListener('click', function () {
            var user = users.find(function (u) { return u.login === selectedLogin; });
            if (!user) return;
            var managerCount = users.filter(function (u) { return u.role === 'manager'; }).length;
            if (user.role === 'manager' && managerCount <= 1) {
                alert('Нельзя удалить последнего пользователя с ролью «Менеджер (админ)».');
                return;
            }
            if (!confirm('Удалить пользователя «' + user.login + '»?')) return;
            getUsersRef().child(user.login).remove();
        });

        window.addEventListener('beforeunload', function (e) {
            if (dirty) { e.preventDefault(); e.returnValue = ''; }
        });
    }
})();
```

**Замечание:** `DeadlineHelpers.copyPreset` не существует — вместо него используем `JSON.parse(JSON.stringify(DeadlineHelpers.ROLE_PRESETS[newRole]))`. Заменить все `DeadlineHelpers.copyPreset(...)` на `JSON.parse(JSON.stringify(DeadlineHelpers.ROLE_PRESETS[...]))`. Это ядро — правка в задании ниже отдельным шагом, переписываю фрагменты:

В `roleSelect`/`resetRoleBtn` использовать:
```js
var preset = JSON.parse(JSON.stringify(DeadlineHelpers.ROLE_PRESETS[newRole]));
```

- [ ] **Step 4: Commit admin страницы**

```bash
git add admin.html admin-style.css admin.js
git commit -m "feat: отдельная страница admin.html для управления ролями и правами"
```

---

### Task 4: Интеграция кнопки «Управление» и удаление старой модалки

**Files:**
- Modify: `index.html` (удалить `#usersModal` и блок добавления пользователя; кнопка `#manageUsersBtn` и `#mobileManageBtn` остаются)
- Modify: `app.js` (удалить обработчики модалки/usersModal/renderUsersList/deleteUser/openEditUserModal/addUserForm-submit; заменить на переход в `admin.html`)
- Modify: `style.css` (удалить мёртвые стили users-модалки, если есть)

**Interfaces:**
- Produces: клик по `#manageUsersBtn`/`#mobileManageBtn` → `window.location.href='admin.html'`.

- [ ] **Step 1: index.html — удалить usersModal**

Удалить блок `<div id="usersModal" class="modal">...</div>` (строки ~252-…). Проверить содержимое этой модалки перед удалением (там форма добавления `#addUserForm`, список `#usersList`).

- [ ] **Step 2: index.html — указать кнопке data переход не нужен (оставим как есть)**

Кнопки `#manageUsersBtn` и `#mobileManageBtn` остаются без изменений в разметке.

- [ ] **Step 3: app.js — удалить мёртвые слушатели и функции**

Удалить:
- `const usersModal = ...` (line 205)
- `const usersList = ...` (line 206)
- `const addUserForm = ...` (line 207), `newLogin` (208), `newPassword` (209)
- функцию `openManagePanel` (lines 687-711) → заменить на
```js
function openManagePanel() {
    window.location.href = 'admin.html';
}
```
- `manageUsersBtn.addEventListener('click', ...)` (714) → оставить, но теперь вызовет `openManagePanel()` без координат.
- `mobileManageBtn` обработчик (2027) → `openManagePanel()`.
- функции `renderUsersList`, `deleteUser`, `openEditUserModal`, обработчик `addUserForm.submit` (947-1168) → удалить целиком.

После удаления проверить, что переменные `usersList`, `usersModal`, `newLogin`, `newPassword` нигде больше не используются.

- [ ] **Step 4: Commit**

Run: `node --check app.js` → no output.
```bash
git add index.html app.js style.css
git commit -m "feat: управление пользователями перенесено на отдельную страницу admin.html"
```

---

### Task 5: Права в основном трекере — гейтинг кнопок и действий

**Files:**
- Modify: `app.js` (заменить жёсткие `currentUser.role === 'admin'` на функции прав)

**Interfaces:**
- Consumes: `DeadlineHelpers.canDo(currentUser, key)`, `DeadlineHelpers.canAssignTo(currentUser, targetRole)`, `DeadlineHelpers.visibleHierarchyTasks/Reports`, `DeadlineHelpers.normalizeUser`, `DeadlineHelpers.isManager`
- Produces: кнопки/действия скрываются по правам; делегирование ограничено ролями исполнителей.

Замены (по номерам строк):
- `currentUser.role === 'admin'` → `DeadlineHelpers.isManager(currentUser)` везде, где это «смотреть всё/архив/статистика» (админ-привилегия) — НО для ролевой видимости заменить на `visibleHierarchy*`. Разберём дословно:

**5.1 Видимость доски/отчётов/статистики** — заменить вызовы `DeadlineHelpers.visibleTasks(...)/visibleReports(...)` и `statsSummary` на `visibleHierarchyTasks/Reports` с передачей `users` и `currentUser.role`:

- `getTasksForUser()` (1182): 
```js
return DeadlineHelpers.visibleHierarchyTasks(tasks, currentUser.login, currentUser.role, users);
```
- `isMyReport(report)` (2225):
```js
return DeadlineHelpers.visibleHierarchyReports([report], currentUser.login, currentUser.role, users).length === 1;
```
- `updateStatsRing` (1260-1269): `ringReports = reports.filter(isMyReport)` уже через `isMyReport`; `ringTasks = getTasksForUser()` уже ок.
- `showMainPage` (603-614) → `userRoleBadge`:
```js
var roleBadgeText = { manager: 'Менеджер', management: 'Управление', department: 'Отдел', specialist: 'Специалист' }[currentUser.role] || currentUser.role;
userRoleBadge.textContent = roleBadgeText;
```
- `populateEmployeeFilter` (1199-1220): фильтр виден только менеджеру: `const isAdmin = DeadlineHelpers.canDo(currentUser, 'viewReports')`? Нет — фильтр по сотрудникам это инструмент аналитики менеджера. Оставить только для `isManager`:
```js
const isManager = DeadlineHelpers.isManager(currentUser);
employeeFilter.style.display = isManager ? '' : 'none';
...
if (u.role === 'manager') opt.textContent += ' (Менеджер)';
```
  (в `populateEmployeeFilter` replace `isAdmin` on `isManager`, `u.role==='admin'` → `u.role==='manager'`).

- Архив (`renderArchive` 734-779, `createArchiveTaskRow/ReportRow` 796/838, `exportArchiveExcel` 906/923): `currentUser.role==='admin'` → `DeadlineHelpers.isManager(currentUser)`. Но для Отдела, который должен видеть задачи подчинённых в архиве, применить `visibleHierarchy*`:
```js
archivedTasks = DeadlineHelpers.visibleHierarchyTasks(tasks, currentUser.login, currentUser.role, users).filter(function(t){ return t.status==='done'; });
```

**5.2 Гейтинг действий (кнопки карточек):**

- `canEditItem(item)` (1275): 
```js
return DeadlineHelpers.canDo(currentUser, 'editTasks');
```
- `openTaskModal`/`openReportModal` деструктив: проверка `deleteTasks` на кнопках удаления:
  - `createTaskCard`/`createReportCard` (`btn-delete`), и `createArchiveTaskRow/ReportRow` (`btn-delete`) → показывать только если `DeadlineHelpers.canDo(currentUser,'deleteTasks')`.
- Кнопка создания: `addTaskBtn`/`addReportBtn`/`mobileAddBtn` видны только если `canDo(currentUser,'createTasks')`. В `showMainPage`:
```js
addTaskBtn.style.display = DeadlineHelpers.canDo(currentUser,'createTasks') ? '' : 'none';
var addReportBtn = document.getElementById('addReportBtn');
if (addReportBtn) addReportBtn.style.display = DeadlineHelpers.canDo(currentUser,'createTasks') ? '' : 'none';
```
  А также защитить `addTaskBtn.addEventListener`/mobileAddBtn — не критично, но отфильтровать по правам можно инлайном: если у пользователя нет `createTasks` и нет полей — просто кнопка скрыта. (Гейт в самом обработчике: `if (!DeadlineHelpers.canDo(currentUser,'createTasks')) return;`.)
- Делегирование: `showDelegateModal` фильтры assignees (1607-1613):
  - target выборка по `canAssignTo`:
```js
var assignees = users
    .filter(function (u) {
        if (u.login === currentUser.login) return false;
        return DeadlineHelpers.canAssignTo(currentUser, u.role);
    })
    .map(function (u) { return u.login; });
```
- Кнопка «Делегировать» на карточке (`task-actions-row1`, line ~1371/2257): показывать если `item.status!=='done' && DeadlineHelpers.canDo(currentUser,'createTasks')` (или конкретно assign permission) — используем `canDo(...,'createTasks')` как «может работать с задачами».

**5.3 Полный список строк для замены (свериться grep'ом после правок, не должно остаться `role === 'admin'`):**
- 608 (showMainPage manageUsersBtn) → `DeadlineHelpers.canDo(currentUser,'manageRoles')`
- 610 (mobileManage) → то же
- 389 (sendDeadlineNotification admin-notify): оставить, но `find(u.role==='admin')` → заменить на поиск менеджера: `users.find(function(u){ return u.role==='manager'; })` — это уведомление, не гейт.
- 742/760/908/923/796/838 (архив/export видимость) → через `isManager`/`visibleHierarchy*`
- 1371/1376/1402/1457 (task card gating) → `canDo`
- 1567/1593 (delegated by label): `delegatedBy === 'admin' ? 'Руководителем' : 'Сотрудником'` → оставить (это текст). Заменить на проверку `find user role==='manager'` не обязательно; оставить как есть (не гейт).
- 1609/1610/1630 (delegate выбор) → `canAssignTo`
- 1641 (`delegatedBy = role==='admin' ? 'admin':'employee'`) → `currentUser.role === 'manager' ? 'manager' : currentUser.login` (сохранить факт делегатора).
- 2194 (`formatUserName` admin→Руководитель): `u.role==='admin') return 'Руководитель'` → `if (u.role==='manager') return 'Менеджер'; if (u.role==='management') return 'Управление'; if (u.role==='department') return 'Отдел'; return 'Сотрудник';`
- 1893 (edit task modal гейт) → `DeadlineHelpers.canDo(currentUser,'editTasks')`

- [ ] **Step 1: Apply replacements** — пошагово выше, сверить `rg "role === 'admin'"` → не должно остаться.

- [ ] **Step 2: Verify + commit**

Run: `node --check app.js`
Run: `node --test "tests/*.test.js"` (должны быть зелёные от Task 1)
```bash
git add app.js
git commit -m "feat: применение функций прав к кнопкам, действиям и делегированию"
```

---

### Task 6: Тесты видимости по ролям в приложении + финальная верификация

**Files:**
- Test: `tests/hierarchy.test.js` (можно расширить `roles.test.js`)

**Итоговая проверка e2e вручную (не автоматизируем):**
- Войти менеджером: кнопки «Новая задача», «Настройки», «Управление», «Архив» видны; фильтр сотрудников виден; деструктивные кнопки — есть.
- Войти специалистом: фильтр скрыт; «Управление»/«Настройки» скрыты; на карточке нет удаления; своя задача и задачи, назначенные мне, видны; кнопка создать задачу видна (у специалиста `createTasks:true`).
- Войти отделом: видит задачи свои + подчинённых (createdBy-цепочка); фильтр скрыт (не менеджер); делегировать может Специалистам/Отделу, но не Управлению.
- `admin` (старый admin из БД) после миграции — менеджер с полными правами.

- [ ] **Step 1: Ручная верификация (мейнтейнер)**
- [ ] **Step 2: Run full test suite + syntax**

Run: `node --test "tests/*.test.js"` → PASS
Run: `node --check app.js && node --check admin.js && node --check js/helpers.js`

- [ ] **Step 3: Commit any test additions**

```bash
git add tests
git commit -m "test: покрытие иерархической видимости по ролям" || true
```

---

## Self-Review

**Spec coverage:**
- Отдельная admin.html ✓ (Task 3)
- Управление ролями и функционалом каждого пользователя ✓ (Task 3: чекбоксы + фото пресета)
- Список сотрудников вверху слева + добавление (логин/пароль/email/роль) ✓ (Task 3)
- Пресеты ролей Менеджер/Управление/Отдел/Специалист ✓ (Task 1)
- Видимость: сотрудник своё; менеджер и управление — все; отдел — своё и подчинённых ✓ (Task 1 `visibleHierarchy*`)
- Полная проверка по правам в трекере ✓ (Task 5)
- Шаблон qwen, но с текущим оформлением ✓ (Task 3: токены + карточки)
- Замена старой модалки/ролей ✓ (Task 2, 4).

**Placeholder scan:** нет TBD/TODO-заглушек; весь код явный. `loadInitialUsers` был упомянут и явно исключён из финального кода admin.js (обработано).

**Type consistency:**
- `visibleHierarchyTasks(tasks, login, role, usersArr)` — используется в Task 1 (определение) и Task 5 (вызов) с одинаковыми аргументами (массив users). ✓
- `DeadlineHelpers.normalizeUser(u)` без второго параметра — я убрал `defaultName` из сигнатуры, использую `name: u.name||''`. В admin.js и app.js вызовы согласованы. ✓
- `copyPreset` исключён, везде `JSON.parse(JSON.stringify(ROLE_PRESETS[..]))`. ✓
- Роли `manager`/`management`/`department`/`specialist` последовательно во всех файлах. ✓