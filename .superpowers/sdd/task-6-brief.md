### Task 6: Режим «Задача | Отчёт» и кнопки добавления

**Files:**
- Modify: `app.js` (глобальные переменные ~строки 177-201; `openTaskModal` 1478-1500; `openReportModal` 1502-1522; обработчики кнопок 1612-1621, 1631-1635)

**Interfaces:**
- Consumes: классы из Task 1 (`strip-ok`, `strip-warn`, `strip-orange`, `strip-coral`, `strip-red`, `strip-overdue`, `strip-none`), разметка из Task 2.
- Produces: `currentItemMode` ('task' | 'report') — уже объявлен в Task 5; DOM-ссылки `itemTypeToggle`, `taskStatusGroup`; `openTaskModal(taskData, x, y, mode)` с режимом.

- [ ] **Step 1: Объявить DOM-ссылки переключателя**

После строки 201 (блок DOM-элементов, после `const newPassword = ...`) вставить:

```js
    const itemTypeToggle = document.getElementById('itemTypeToggle');
    const taskStatusGroup = document.getElementById('taskStatusGroup');
```

- [ ] **Step 2: Переписать `openTaskModal` с параметром `mode`**

Заменить строки 1478-1500:

```js
    function openTaskModal(taskData, x, y) {
        if (taskData) {
            modalTitle.textContent = 'Редактировать задачу';
            taskId.value = taskData.id;
            taskTitle.value = taskData.title;
            taskDesc.value = taskData.description || '';
            taskStatus.value = taskData.status || 'in_progress';
            taskPriority.value = taskData.priority || 'medium';
            taskDueDate.value = taskData.dueDate || '';
            taskAssignee.value = taskData.assignedTo || '';
        } else {
            modalTitle.textContent = 'Новая задача';
            taskId.value = '';
            taskTitle.value = '';
            taskDesc.value = '';
            taskStatus.value = 'in_progress';
            taskPriority.value = 'medium';
            taskDueDate.value = '';
            taskAssignee.value = '';
        }
        taskModal.classList.add('active');
        positionModalAtPoint(taskModal, x, y);
    }
```

на:

```js
    function openTaskModal(taskData, x, y, mode) {
        currentItemMode = mode || 'task';
        if (taskData) currentItemMode = 'task';
        var isReport = currentItemMode === 'report';
        if (itemTypeToggle) {
            itemTypeToggle.querySelectorAll('.item-type-btn').forEach(function(btn) {
                btn.classList.toggle('active', btn.dataset.type === currentItemMode);
            });
        }
        if (taskStatusGroup) {
            taskStatusGroup.style.display = isReport ? 'none' : '';
        }
        if (isReport) {
            modalTitle.textContent = 'Новый отчёт';
            taskId.value = '';
            taskTitle.value = '';
            taskDesc.value = '';
            taskStatus.value = 'reports';
            taskPriority.value = 'medium';
            taskDueDate.value = '';
            taskAssignee.value = '';
        } else if (taskData) {
            modalTitle.textContent = 'Редактировать задачу';
            taskId.value = taskData.id;
            taskTitle.value = taskData.title;
            taskDesc.value = taskData.description || '';
            taskStatus.value = taskData.status || 'in_progress';
            taskPriority.value = taskData.priority || 'medium';
            taskDueDate.value = taskData.dueDate || '';
            taskAssignee.value = taskData.assignedTo || '';
        } else {
            modalTitle.textContent = 'Новая задача';
            taskId.value = '';
            taskTitle.value = '';
            taskDesc.value = '';
            taskStatus.value = 'in_progress';
            taskPriority.value = 'medium';
            taskDueDate.value = '';
            taskAssignee.value = '';
        }
        taskModal.classList.add('active');
        positionModalAtPoint(taskModal, x, y);
    }
```

- [ ] **Step 3: Сброс статуса отчёта при открытии**

В `openReportModal`, в ветке `if (reportData)` добавить после `reportAssignee.value = ...` (строка 1510):

```js
            document.getElementById('reportStatus').value = 'reports';
```

и в ветке `else` (после строки 1518, перед `reportModal.classList.add`):

```js
            document.getElementById('reportStatus').value = 'reports';
```

- [ ] **Step 4: Переключатель внутри модалки**

После объявления `openTaskModal` (после строки 1522) вставить обработчик переключателя:

```js
    if (itemTypeToggle) {
        itemTypeToggle.addEventListener('click', function(e) {
            var btn = e.target.closest('.item-type-btn');
            if (!btn) return;
            currentItemMode = btn.dataset.type;
            itemTypeToggle.querySelectorAll('.item-type-btn').forEach(function(b) {
                b.classList.toggle('active', b === btn);
            });
            if (taskStatusGroup) {
                taskStatusGroup.style.display = currentItemMode === 'report' ? 'none' : '';
            }
            modalTitle.textContent = currentItemMode === 'report' ? 'Новый отчёт' : 'Новая задача';
        });
    }
```

- [ ] **Step 5: Кнопки добавления**

Заменить обработчик `addTaskBtn` (строки 1612-1614):

```js
    addTaskBtn.addEventListener('click', function(e) {
        openTaskModal(null, e.clientX, e.clientY, 'task');
    });
```

Заменить обработчик `addReportBtn` (строки 1616-1621):

```js
    var addReportBtn = document.getElementById('addReportBtn');
    if (addReportBtn) {
        addReportBtn.addEventListener('click', function(e) {
            openTaskModal(null, e.clientX, e.clientY, 'report');
        });
    }
```

Заменить обработчик `mobileAddBtn` (строки 1631-1635):

```js
    if (mobileAddBtn) {
        mobileAddBtn.addEventListener('click', function(e) {
            openTaskModal(null, e.clientX, e.clientY, 'task');
        });
    }
```

- [ ] **Step 6: Проверка синтаксиса**

Run: `node --check app.js`
Expected: нет вывода.

Run: `node --test "tests/*.test.js"`
Expected: 5 тестов PASS.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: task/report mode toggle in add modal"
```

---

