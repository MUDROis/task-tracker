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

