# Смена логина сотрудника в админ-панели — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Администратор может сменить логин сотрудника в админ-панели — вместе с сотрудником переезжают его карточка, задачи, отчёты и цепочка подчинения.

**Architecture:** Логика переноса данных — чистая функция `buildLoginChangePatch` в `js/helpers.js` (покрыта `node --test`). `admin.js` оркестрирует: создаёт новую учётку Firebase во вторичном приложении, одной атомарной операцией `update()` переносит запись сотрудника и все ссылки, затем удаляет старую запись. `app.js` закрывает живую сессию сотрудника, чей логин исчез из списка.

**Tech Stack:** vanilla JS (ES5-стиль в `helpers.js`/`admin.js`, `const`/стрелки в `app.js`), Firebase compat SDK 9.23.0 (Auth + Realtime Database), `node:test` для юнит-тестов. Новых зависимостей нет.

**Spec:** `docs/superpowers/specs/2026-10-21-admin-login-change-design.md`

## Global Constraints

- Стиль кода — как в окружающем файле: `helpers.js` и `admin.js` используют `var` и `function`, `app.js` — `const` и стрелочные функции.
- Переводы строк — LF. BOM и финальный перевод строки сохраняются как в исходных файлах: `admin.js` — без BOM, без финального перевода строки; `app.js` и `js/helpers.js` — без BOM, с финальным переводом строки; `admin.html` — без BOM, без финального перевода строки; `service-worker.js` — с BOM, без финального перевода строки.
- Пути Firebase строятся через глобальный `TEAM_ID` из `firebase-config.js`, а не литералом `team_main`.
- Ассеты версионируются параметром `?v=`; `service-worker.js` хранит `CACHE_NAME`. Любое изменение `app.js`, `admin.js`, `js/helpers.js` требует подъёма версии (в этом плане — до `v15`).
- Правила доступа Firebase не меняются.
- Тесты запускаются командой `node --test tests/*.test.js` из корня репозитория.

## Review Focus

1. **Легаси-запись сотрудника без поля `login`** — логином является ключ в БД; патч должен переименовать её по ключу, а не по `undefined`.
2. **Ссылка, отличающаяся от логина записи по регистру** — Firebase приводит ASCII-часть email к нижнему регистру, поэтому в `assignedTo` может лежать `kupriyanov` при записи `Kupriyanov`; сравнение ссылок без учёта регистра.
3. **Новый логин уже занят учёткой от ранее удалённого сотрудника** — `auth/email-already-in-use`: операция прерывается, состояние не меняется, сотрудник не остаётся «наполовину переименованным».
4. **Перенос данных упал после создания учётки** — учётка обязана откатываться, иначе повторная попытка упрётся в `auth/email-already-in-use`, а восстановление через «Добавить сотрудника» перезапишет карточку сотрудника обеднённой (новый `createdAt`, дефолтные цвет и эмодзи, роль из формы добавления).
5. **У сотрудника открыта вкладка со старым логином** — без закрытия сессии он создаст задачу со старым логином, и получится ровно та «осиротевшая» ссылка, которую фича убирает.

---

### Task 1: Чистая функция переноса данных

**Files:**
- Modify: `js/helpers.js` (добавить функцию рядом с `findUserByLogin`, экспорт — в тот же объект)
- Test: `tests/login.test.js`

**Interfaces:**
- Consumes: существующие `DeadlineHelpers.validateLogin(login)`, `DeadlineHelpers.findUserByLogin(usersObj, login)`.
- Produces: `DeadlineHelpers.buildLoginChangePatch(users, tasks, reports, oldLogin, newLogin, newRecord) -> Object` — объект патча для атомарного `update()`, ключи — пути относительно `teams/<TEAM_ID>`.

- [ ] **Step 1: Написать падающие тесты**

В `tests/login.test.js` добавить:

```js
test('buildLoginChangePatch: переносит запись сотрудника и ссылки в задачах/отчётах', () => {
  const users = {
    Kupriyanov: { login: 'Kupriyanov', name: 'Артём', role: 'management' },
    admin: { login: 'admin', createdBy: 'Kupriyanov' }
  };
  const tasks = {
    t1: { createdBy: 'Kupriyanov', assignedTo: 'admin' },
    t2: { createdBy: 'admin', assignedTo: 'Kupriyanov' }
  };
  const reports = { r1: { createdBy: 'Kupriyanov', assignedTo: 'Kupriyanov' } };
  const newRecord = { login: 'Куприянов', name: 'Артём', role: 'management', uid: 'NEWUID' };
  const patch = DH.buildLoginChangePatch(users, tasks, reports, 'Kupriyanov', 'Куприянов', newRecord);

  assert.deepStrictEqual(patch['users/Куприянов'], newRecord);
  assert.strictEqual(patch['tasks/t1/createdBy'], 'Куприянов');
  assert.strictEqual(patch['tasks/t2/assignedTo'], 'Куприянов');
  assert.strictEqual(patch['reports/r1/createdBy'], 'Куприянов');
  assert.strictEqual(patch['reports/r1/assignedTo'], 'Куприянов');
  assert.strictEqual(patch['users/admin/createdBy'], 'Куприянов');
  // ссылки, не относящиеся к сотруднику, не трогаются
  assert.strictEqual(patch['tasks/t1/assignedTo'], undefined);
  assert.strictEqual(patch['tasks/t2/createdBy'], undefined);
});

test('buildLoginChangePatch: сравнение ссылок без учёта регистра', () => {
  const tasks = { t1: { assignedTo: 'kupriyanov' } };
  const patch = DH.buildLoginChangePatch({}, tasks, {}, 'Kupriyanov', 'Куприянов', { login: 'Куприянов' });
  assert.strictEqual(patch['tasks/t1/assignedTo'], 'Куприянов');
});

test('buildLoginChangePatch: пустые значения не переписываются', () => {
  const tasks = { t1: { assignedTo: '', createdBy: 'admin' } };
  const patch = DH.buildLoginChangePatch({}, tasks, {}, 'Kupriyanov', 'Куприянов', { login: 'Куприянов' });
  assert.strictEqual(patch['tasks/t1/assignedTo'], undefined);
  assert.strictEqual(patch['tasks/t1/createdBy'], undefined);
});

test('buildLoginChangePatch: легаси-запись без поля login берёт логин из ключа', () => {
  const users = { legacy: { name: 'Без логина' } };
  const tasks = { t1: { createdBy: 'legacy' } };
  const patch = DH.buildLoginChangePatch(users, tasks, {}, 'legacy', 'Новый', { login: 'Новый' });
  assert.strictEqual(patch['tasks/t1/createdBy'], 'Новый');
  assert.ok(patch['users/Новый']);
});

test('buildLoginChangePatch: пустые коллекции дают патч только с новой записью', () => {
  const patch = DH.buildLoginChangePatch(null, null, null, 'old', 'new', { login: 'new' });
  assert.deepStrictEqual(Object.keys(patch), ['users/new']);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `node --test tests/login.test.js`
Expected: FAIL — `TypeError: DH.buildLoginChangePatch is not a function`.

- [ ] **Step 3: Реализовать функцию в `js/helpers.js`**

Сигнатура: `function buildLoginChangePatch(users, tasks, reports, oldLogin, newLogin, newRecord)`.

Правила, которые должны выполняться (остальное — по тестам):
- `users`, `tasks`, `reports` — сырые карты RTDB (объекты); `null`/`undefined` допустимы и трактуются как пустая карта.
- Всегда возвращается патч, содержащий ключ `users/<newLogin>` со значением `newRecord`.
- Переписываются только поля `createdBy` и `assignedTo` у элементов `tasks` и `reports`, и поле `createdBy` у записей `users`.
- Ссылка переписывается, если её значение, приведённое к нижнему регистру и обрезанное, равно `oldLogin` (приведённому так же). Пустые строки, `undefined` и `null` не считаются совпадением.
- Ключи патча: `tasks/<id>/createdBy`, `tasks/<id>/assignedTo`, `reports/<id>/createdBy`, `reports/<id>/assignedTo`, `users/<key>/createdBy`.
- Значение переписанной ссылки — `newLogin` (как есть, без нормализации).
- Ничего, кроме перечисленного, в патч не попадает.

Экспортировать: добавить `buildLoginChangePatch: buildLoginChangePatch` в объект возврата `DeadlineHelpers`.

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `node --test tests/login.test.js`
Expected: PASS, все тесты в файле зелёные.

- [ ] **Step 5: Закоммитить**

```bash
git add js/helpers.js tests/login.test.js
git commit -m "feat: чистая функция buildLoginChangePatch — атомарный перенос данных при смене логина"
```

---

### Task 2: Админ-панель — смена логина

**Files:**
- Modify: `admin.html` (блок «Логин» в карточке сотрудника)
- Modify: `admin.js` (поля, кнопка, оркестрация)

**Interfaces:**
- Consumes: `DeadlineHelpers.validateLogin(login)`, `DeadlineHelpers.findUserByLogin(usersObj, login)`, `DeadlineHelpers.buildLoginChangePatch(users, tasks, reports, oldLogin, newLogin, newRecord)`, `DeadlineHelpers.normalizeUser(u)`, существующие `getStaffAuth()` (вторичное приложение Firebase) и глобальный `TEAM_ID`.
- Produces: DOM-элементы `editLogin`, `editLoginPassword`, `changeLoginBtn`, `loginChangeStatus`; поведение — смена логина с переносом данных.

- [ ] **Step 1: Разметка в `admin.html`**

В карточке сотрудника (`#userPanel`), после блока `.form-group` с `editEmoji` и перед `<fieldset class="permissions-fieldset">`, вставить:

```html
                    <div class="form-group">
                        <label for="editLogin">Логин</label>
                        <input type="text" id="editLogin" placeholder="Kupriyanov" autocomplete="off">
                        <small class="muted">Смена логина переносит задачи, отчёты и карточку сотрудника. Учётная запись создаётся заново — введите пароль, по которому сотрудник будет входить.</small>
                        <input type="password" id="editLoginPassword" placeholder="Новый пароль" minlength="6" autocomplete="new-password">
                        <button class="btn btn--charcoal" type="button" id="changeLoginBtn">🔑 Сменить логин</button>
                        <p id="loginChangeStatus" class="admin-status" role="status"></p>
                    </div>
```

- [ ] **Step 2: Объявления и ссылки в `admin.js`**

Рядом с прочими `getElementById` добавить `editLogin`, `editLoginPassword`, `changeLoginBtn`, `loginChangeStatus`.

Рядом с `getUsersRef()` добавить `getTasksRef()`, `getReportsRef()`, `getTeamRef()` — все три строят путь от `'teams/' + TEAM_ID`.

- [ ] **Step 3: Заполнение полей при выборе сотрудника**

В `renderUserPanel()`, рядом с `editEmoji.value = user.emoji || '';` добавить:

```js
        editLogin.value = user.login || '';
        editLoginPassword.value = '';
        loginChangeStatus.textContent = '';
```

Там же скрыть весь блок смены логина для служебной учётки `admin` (логин `admin` не меняется: от него зависят `ensureAdminUser` и автосоздание записи при первом входе). Скрывать блок целиком — обёртку с полями и кнопкой.

- [ ] **Step 4: Обработчик кнопки «Сменить логин»**

В `startApp()`, после обработчика `deleteUserBtn`, добавить обработчик `changeLoginBtn` со следующим потоком:

**Проверки (до любых записей), каждая — с `return`:**
1. `dirty` → `alert('Сначала сохраните права или отмените изменения.')`.
2. `DeadlineHelpers.validateLogin(newLogin)` → `alert(<текст проверки>)`.
3. `newLogin.toLowerCase() === selectedLogin.toLowerCase()` → `alert('Логин не изменился.')`.
4. `DeadlineHelpers.findUserByLogin(users, newLogin)` → `alert('Сотрудник с таким логином уже существует.')`.
5. Пароль пуст или короче 6 → `alert('Пароль должен быть не короче 6 символов.')`.
6. `confirm(...)` с текстом:
   `Сменить логин «<старый>» на «<новый»»?\n\nЗадачи, отчёты и карточка сотрудника переезжают вместе с ним.\nБудет создана новая учётная запись с введённым паролем. Старая запись <старый>@tasktracker.local останется в Firebase и больше не будет работать.`
   (в тексте — значения подставляются; если пользователь отказался — `return`).

**Дальше — цепочка промисов:**
7. `changeLoginBtn.disabled = true`, `loginChangeStatus.textContent = ''`.
8. `getStaffAuth().createUserWithEmailAndPassword(newLogin + '@tasktracker.local', newPassword)` → запомнить `cred.user` в переменную `createdUser`.
9. Прочитать сырые данные: `Promise.all([getUsersRef().once('value'), getTasksRef().once('value'), getReportsRef().once('value')])`.
10. Найти ключ старой записи в карте `users`: первый ключ, для которого `String(rec.login || key).trim().toLowerCase() === selectedLogin.trim().toLowerCase()`. Если ключа нет — бросить `Error('Запись сотрудника не найдена в базе.')`.
11. Собрать новую запись: `DeadlineHelpers.normalizeUser(Object.assign({}, usersRaw[oldKey], { login: newLogin, uid: createdUser.uid }))`.
12. Собрать патч: `DeadlineHelpers.buildLoginChangePatch(usersRaw, tasksRaw, reportsRaw, selectedLogin, newLogin, newRecord)` и применить `getTeamRef().update(patch)`.
13. Удалить старую запись: `getUsersRef().child(oldKey).remove()`.
14. Успех: `selectedLogin = newLogin`, `editLogin.value = newLogin`, `editLoginPassword.value = ''`, `renderAll()`, и в `loginChangeStatus`:
    `Логин изменён на «<новый>». Задачи, отчёты и карточка сотрудника перенесены. Старая учётная запись <старый>@tasktracker.local осталась в Firebase — удалить её можно только в консоли Firebase.`
    (сообщение ставится **после** `renderAll()`, потому что перерисовка чистит `saveStatus` и сбрасывает `selectedLogin`).
15. Обработка ошибки:
    - `err.code === 'auth/email-already-in-use'` → в `loginChangeStatus`:
      `Учётная запись «<новый>» уже существует (сотрудник был удалён ранее). Восстановить его можно через «Добавить сотрудника» — сохранится прежний пароль.` — и ничего не откатывать (учётка не создавалась).
    - иначе, если `createdUser` создан → `createdUser.delete()` (ошибку удаления проглотить), затем в `loginChangeStatus`:
      `Ошибка переноса: <err.message>. Учётная запись удалена — можно повторить попытку.`
    - иначе → `loginChangeStatus.textContent = 'Ошибка: ' + err.message`.
16. В `finally` вернуть `changeLoginBtn.disabled = false`.

- [ ] **Step 5: Синтаксическая проверка**

Run: `node --check admin.js`
Expected: без вывода, код 0.

- [ ] **Step 6: Ручная проверка в браузере**

Поднять локальный сервер из корня репозитория (`python -m http.server 8126`), открыть `http://127.0.0.1:8126/admin.html`, войти как администратор.
Проверить:
1. В карточке сотрудника виден блок «Логин» с полями и кнопкой; у `admin` блока нет.
2. Ввод логина с пробелом → понятное сообщение, запрос в Firebase не уходит.
3. Ввод логина, совпадающего с другим сотрудником (без учёта регистра) → «Сотрудник с таким логином уже существует».
4. Смена логина на кириллический: после подтверждения панель остаётся на сотруднике, в списке сотрудников новый логин, задачи и отчёты сотрудника по-прежнему показывают его имя, карточка сохраняет имя/роль/права.
5. Вход под новым логином с введённым паролем работает; вход под старым логином даёт «Ваш аккаунт удалён администратором».
6. Повторная попытка сменить логин на уже существующий даёт сообщение про `email-already-in-use` и ничего не меняет.
7. **Проверка отката:** временно изменить в локальной копии `firebase-config.js` значение `TEAM_ID` на `team_none` (правил для такого пути нет → `update()` падает), повторить смену логина → в статусе сообщение «Ошибка переноса… Учётная запись удалена — можно повторить попытку», а новая учётка не остаётся (проверить попыткой входа под новым логином: «Неверный логин или пароль»). После проверки вернуть `TEAM_ID`.

- [ ] **Step 7: Закоммитить**

```bash
git add admin.html admin.js
git commit -m "feat: смена логина сотрудника в админ-панели — перенос карточки, задач, отчётов и цепочки подчинения"
```

---

### Task 3: Закрытие живой сессии сотрудника, чей логин изменился

**Files:**
- Modify: `app.js` (слушатель пользователей)

**Interfaces:**
- Consumes: `DeadlineHelpers.findUserByLogin(users, login)`.
- Produces: при исчезновении записи текущего сотрудника — выход из сессии с сообщением «Ваша учётная запись в трекере изменилась — войдите заново».

- [ ] **Step 1: Изменение в `app.js`**

В слушателе `getUsersRef().on('value', ...)` заменить блок обновления текущего пользователя:

```js
            // Если текущий пользователь есть в списке — обновляем его данные
            if (currentUser) {
                const fresh = DeadlineHelpers.findUserByLogin(users, currentUser.login);
                if (fresh) {
                    currentUser = { uid: fresh.uid, login: fresh.login, name: fresh.name || '', role: fresh.role, color: fresh.color, email: fresh.email, emoji: fresh.emoji };
                } else if (users.length) {
                    // Запись сотрудника исчезла: логин изменён администратором
                    // или учётка удалена. Закрываем сессию, иначе сотрудник
                    // продолжит создавать задачи со старым логином.
                    blockedMessage = 'Ваша учётная запись в трекере изменилась — войдите заново';
                    auth.signOut();
                }
            }
```

- [ ] **Step 2: Синтаксическая проверка**

Run: `node --check app.js`
Expected: без вывода, код 0.

- [ ] **Step 3: Прогон всех тестов**

Run: `node --test tests/*.test.js`
Expected: все тесты зелёные (не меньше, чем до правки).

- [ ] **Step 4: Ручная проверка**

Открыть приложение под логином сотрудника в одной вкладке, в другой — админ-панель; сменить сотруднику логин. Ожидание: вкладка сотрудника возвращается на форму входа с сообщением «Ваша учётная запись в трекере изменилась — войдите заново»; после повторного входа под новым логином сотрудник видит свои задачи и отчёты.

- [ ] **Step 5: Закоммитить**

```bash
git add app.js
git commit -m "fix: закрываем сессию сотрудника, чей логин изменился или учётка удалена"
```

---

### Task 4: Версионирование ассетов, финальная проверка, публикация

**Files:**
- Modify: `index.html`, `admin.html`, `service-worker.js`

**Interfaces:**
- Consumes: ничего; изменяет только номера версий ассетов.
- Produces: `?v=15` во всех ссылках на свои файлы и `CACHE_NAME = 'task-tracker-v15'`.

- [ ] **Step 1: Поднять версию в `index.html`**

Заменить `?v=14` на `?v=15` в четырёх местах: `style.css`, `firebase-config.js`, `js/helpers.js`, `app.js`.

- [ ] **Step 2: Поднять версию в `admin.html`**

Заменить `?v=14` на `?v=15` в пяти местах: `style.css`, `admin-style.css`, `js/helpers.js`, `firebase-config.js`, `admin.js`.

- [ ] **Step 3: Поднять версию в `service-worker.js`**

Заменить `CACHE_NAME = 'task-tracker-v14'` на `'task-tracker-v15'` и `?v=14` на `?v=15` в списке `ASSETS` (четыре вхождения).

- [ ] **Step 4: Финальная проверка**

Run: `node --check admin.js && node --check app.js && node --check js/helpers.js && node --test tests/*.test.js`
Expected: синтаксис без ошибок, все тесты зелёные.

Run: `git status --short`
Expected: изменены только `index.html`, `admin.html`, `service-worker.js` (остальное уже закоммичено).

- [ ] **Step 5: Закоммитить и опубликовать**

```bash
git add index.html admin.html service-worker.js
git commit -m "chore: ассеты и service worker — v15"
git push origin main
```

- [ ] **Step 6: Проверка публикации**

Опросить `https://rkkt.ru/app.js`, `https://rkkt.ru/admin.js`, `https://rkkt.ru/js/helpers.js` и `https://rkkt.ru/index.html` до появления `v15` и `buildLoginChangePatch` (ожидание — несколько минут: сборка GitHub Pages).

Проверить в браузере на `https://rkkt.ru/admin.html`: блок «Логин» присутствует, смена логина работает, данные сотрудника переезжают.

- [ ] **Step 7: Уборка**

Удалить временные тестовые данные, созданные во время ручной проверки: запись сотрудника из `teams/team_main/users` и учётную запись Firebase (`<login>@tasktracker.local`) — тем же способом, каким они были созданы.
