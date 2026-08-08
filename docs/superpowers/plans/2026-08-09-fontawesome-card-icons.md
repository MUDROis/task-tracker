# Font Awesome-иконки на карточках задач и отчётов — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить эмодзи-значки в кнопках карточек задач/отчётов и строк архива на иконки Font Awesome в сером цвете (#64748b), не меняя сами кнопки.

**Architecture:** Подключается Font Awesome 6 через CDN в `index.html`. В `app.js` эмодзи внутри кнопок карточек (`createTaskCard`, `createReportCard`, `createArchiveTaskRow`, `createArchiveReportRow`) заменяются на `<i class="fa-solid ..."></i>`. В `style.css` добавляется правило, красящее эти иконки в серый цвет.

**Tech Stack:** vanilla JS (IIFE), HTML/CSS, Font Awesome 6 CDN. Тестового фреймворка нет — проверка вручную через `index.html`, синтаксис через `node --check app.js`.

## Global Constraints

- Иконки Font Awesome, цвет `#64748b` (slate-500).
- Кнопки (фон, обводка, текст) НЕ меняются.
- Меняются только кнопки карточек задач, карточек отчётов и строк архива. Панель инструментов, мобильная панель, заголовки колонок не затрагиваются.
- Эмодзи в остальных местах (заголовки, task-meta, счётчики) не трогаются.
- CDN: `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css`
- Коммиты прямо в `main` (согласовано ранее).

---

### Task 1: Подключение Font Awesome CDN

**Files:**
- Modify: `index.html` (после строки 10 `<link rel="stylesheet" href="style.css">`)

**Interfaces:**
- Consumes: ничего.
- Produces: подключённый Font Awesome — `<i class="fa-solid ..."></i>` работает в `app.js` и стилизуется в `style.css`.

- [ ] **Step 1: Добавить CDN в `<head>`**

В `index.html` после строки с `<link rel="stylesheet" href="style.css">` добавьте:

```html
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
```

- [ ] **Step 2: Проверка**

Откройте `index.html` в браузере (вкладка DevTools → Network): должен загрузиться `all.min.css` со статусом 200. При отсутствии интернета иконки отображаются как пустые квадраты — это допустимо офлайн.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add font awesome CDN"
```

---

### Task 2: Замена значков в карточках задач

**Files:**
- Modify: `app.js` (функция `createTaskCard`, строки ~1134–1148)

**Interfaces:**
- Consumes: существующая разметка кнопок `btn-done`, `btn-restore`, `btn-delegate`, `btn-delete`, `btn-settings`, `btn-open`.
- Produces: кнопки с `<i class="fa-solid ..."></i>` вместо эмодзи; стилизация в Task 4.

- [ ] **Step 1: Заменить эмодзи на иконки в `createTaskCard`**

В `app.js` в функции `createTaskCard` (строки ~1134–1148) замените блок построения кнопок на:

```js
            '<div class="task-actions-row1">' +
                (task.status !== 'done'
                    ? '<button class="btn-done" data-action="done">✅ Выполнить</button>'
                    : '<button class="btn-restore" data-action="restore">↩ Вернуть</button>') +
                (task.status !== 'done' && (currentUser.role === 'admin' || currentUser.login === task.createdBy)
                    ? '<button class="btn-delegate" data-action="delegate">📤 Делегировать</button>'
                    : '') +
            '</div>' +
            '<div class="task-actions-row2">' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-delete" data-action="delete" title="Удалить">🗑</button>'
                    : '') +
                '<button class="btn-settings" data-action="settings" title="Настройки">⚙️</button>' +
                '<button class="btn-open" data-action="open" title="Открыть">⭕</button>' +
            '</div>';
```

на:

```js
            '<div class="task-actions-row1">' +
                (task.status !== 'done'
                    ? '<button class="btn-done" data-action="done"><i class="fa-solid fa-check"></i> Выполнить</button>'
                    : '<button class="btn-restore" data-action="restore"><i class="fa-solid fa-rotate-left"></i> Вернуть</button>') +
                (task.status !== 'done' && (currentUser.role === 'admin' || currentUser.login === task.createdBy)
                    ? '<button class="btn-delegate" data-action="delegate"><i class="fa-solid fa-paper-plane"></i> Делегировать</button>'
                    : '') +
            '</div>' +
            '<div class="task-actions-row2">' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-delete" data-action="delete" title="Удалить"><i class="fa-solid fa-trash"></i></button>'
                    : '') +
                '<button class="btn-settings" data-action="settings" title="Настройки"><i class="fa-solid fa-gear"></i></button>' +
                '<button class="btn-open" data-action="open" title="Открыть"><i class="fa-solid fa-circle-info"></i></button>' +
            '</div>';
```

- [ ] **Step 2: Проверка синтаксиса**

Run: `node --check app.js`
Expected: без ошибок (кроме возможного предупреждения LF/CRLF).

- [ ] **Step 3: Проверка вручную**

Откройте `index.html`, войдите admin/admin. На карточках задач: кнопки «Выполнить», «Вернуть», «Делегировать», «🗑», «⚙️», «⭕» отображают иконки Font Awesome, текст кнопок сохранён.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: replace task card button emojis with fontawesome icons"
```

---

### Task 3: Замена значков в карточках отчётов и строках архива

**Files:**
- Modify: `app.js` (функции `createReportCard` строки ~1823–1830, `createArchiveTaskRow` строки ~720–723, `createArchiveReportRow` строки ~761–764)

**Interfaces:**
- Consumes: разметка кнопок отчётов и архива из Task 5–7 предыдущего плана.
- Produces: `<i class="fa-solid ..."></i>` в кнопках; стилизация в Task 4.

- [ ] **Step 1: Заменить эмодзи в `createReportCard`**

В `app.js` в функции `createReportCard` (строки ~1823–1830) замените:

```js
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
```

на:

```js
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

- [ ] **Step 2: Заменить эмодзи в `createArchiveTaskRow`**

В `app.js` в функции `createArchiveTaskRow` (строки ~720–723) замените:

```js
                '<button class="btn-archived" data-action="open" title="Открыть">⭕ Открыть</button>' +
                '<button class="btn-archived" data-action="restore" title="Вернуть на доску">↩ Вернуть</button>' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-archived" data-action="delete" title="Удалить">🗑 Удалить</button>'
                    : '') +
```

на:

```js
                '<button class="btn-archived" data-action="open" title="Открыть"><i class="fa-solid fa-circle-info"></i> Открыть</button>' +
                '<button class="btn-archived" data-action="restore" title="Вернуть на доску"><i class="fa-solid fa-rotate-left"></i> Вернуть</button>' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-archived" data-action="delete" title="Удалить"><i class="fa-solid fa-trash"></i> Удалить</button>'
                    : '') +
```

- [ ] **Step 3: Заменить эмодзи в `createArchiveReportRow`**

В `app.js` в функции `createArchiveReportRow` (строки ~761–764) замените тот же блок (идентичен шагу 2) на тот же код из шага 2.

- [ ] **Step 4: Проверка синтаксиса**

Run: `node --check app.js`
Expected: без ошибок.

- [ ] **Step 5: Проверка вручную**

Создайте отчёт (➕ в колонке «Отчёты»), отправьте его в архив («✅ В архив»). Откройте «🗂 Архив»: во вкладках «Задачи» и «Отчёты» кнопки «Открыть», «Вернуть», «Удалить» показывают иконки Font Awesome. Верните задачу/отчёт из архива и проверьте карточку отчёта на доске.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: replace report and archive button emojis with fontawesome icons"
```

---

### Task 4: Серый цвет иконок в кнопках карточек и архива

**Files:**
- Modify: `style.css` (в конец файла)

**Interfaces:**
- Consumes: классы `btn-done`, `btn-delegate`, `btn-restore`, `btn-delete`, `btn-settings`, `btn-open` (карточки), `btn-archived` (архив).
- Produces: серые иконки #64748b. Кнопки не изменяются (их `background` и `color` остаются из существующих правил).

- [ ] **Step 1: Добавить правило серого цвета иконок**

В конец `style.css` добавьте:

```css
.task-card .btn-done i,
.task-card .btn-delegate i,
.task-card .btn-restore i,
.task-card .btn-delete i,
.task-card .btn-settings i,
.task-card .btn-open i,
.archive-row .btn-archived i {
    color: #64748b;
}
```

- [ ] **Step 2: Проверка вручную**

Откройте `index.html`, admin/admin. На карточках задач/отчётов и в архиве иконки Font Awesome серые (#64748b). Фон и обводка кнопок не изменились (зелёный у «Выполнить», синий у «Делегировать» и т.д.).

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "style: gray fontawesome icons on card and archive buttons"
```

---

## Self-Review

**Spec coverage:**
- CDN Font Awesome → Task 1.
- Замена значков в карточках задач → Task 2.
- Замена значков в карточках отчётов и строках архива → Task 3.
- Серый цвет иконок #64748b → Task 4.
- Кнопки не меняются → Global Constraints + Task 4 (правило стилизует только `i` внутри кнопок).
- Панель инструментов/мобильная панель/заголовки не трогаются → ни один task их не меняет.

**Placeholder scan:** Полный код в каждом шаге, точные пути. Плейсхолдеров нет.

**Type consistency:** Классы кнопок (`btn-done`, `btn-archived` и др.) и иконки (`fa-check`, `fa-rotate-left`, `fa-paper-plane`, `fa-trash`, `fa-gear`, `fa-circle-info`, `fa-box-archive`) согласованы между Task 2/3 (разметка) и Task 4 (стили).
