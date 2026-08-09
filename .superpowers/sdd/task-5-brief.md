### Task 5: Конверсия «задача ↔ отчёт» в submit-обработчиках

**Files:**
- Modify: `app.js` (добавить функции `taskToReport`/`reportToTask` рядом с CRUD-секцией ~строки 1315-1322; обработчик `taskForm` submit 1562-1610; обработчик `reportForm` submit 1524-1560)

**Interfaces:**
- Consumes: `generateId()`, `computeReportNumber()`, `saveTask`, `saveReport`, `removeTask`, `removeReport`, `currentUser`, `tasks`, `reports` (все уже в app.js).
- Produces: `taskToReport(task) → Promise`, `reportToTask(report, status) → Promise`, глобал `currentItemMode` ('task' | 'report').

- [ ] **Step 1: Добавить глобал режима и функции конверсии**

Объявить глобал режима. В блок глобальных переменных (после `var blockedMessage = null;`, строка 19) вставить:

```js
    let currentItemMode = 'task'; // 'task' | 'report' — режим модалки добавления
```

После функции `updateTask` (после строки 1322) вставить функции конверсии:

```js
    function taskToReport(task) {
        return saveReport({
            id: generateId(),
            title: task.title,
            description: task.description || '',
            priority: task.priority || 'medium',
            reportNumber: computeReportNumber(),
            dueDate: task.dueDate || '',
            assignedTo: task.assignedTo || '',
            delegated: !!task.delegated,
            delegatedBy: task.delegatedBy || '',
            createdBy: task.createdBy,
            status: 'active',
            createdAt: task.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    function reportToTask(report, status) {
        return saveTask({
            id: generateId(),
            title: report.title,
            description: report.description || '',
            status: status,
            previousStatus: '',
            delegated: !!report.delegated,
            delegatedBy: report.delegatedBy || '',
            createdBy: report.createdBy,
            assignedTo: report.assignedTo || '',
            priority: report.priority || 'medium',
            dueDate: report.dueDate || '',
            createdAt: report.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
```

- [ ] **Step 2: Обработка «Отчёт» в `taskForm` submit**

Заменить тело обработчика `taskForm.addEventListener('submit', ...)` (строки 1562-1610) на:

```js
    taskForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var id = taskId.value;
        var title = taskTitle.value.trim();
        if (!title) return;
        var description = taskDesc.value.trim();
        var status = taskStatus.value;
        var priority = taskPriority.value;
        var dueDate = taskDueDate.value;
        var assignee = taskAssignee.value;

        if (currentItemMode === 'report') {
            saveReport({
                id: generateId(),
                title: title,
                description: description,
                priority: priority,
                reportNumber: computeReportNumber(),
                dueDate: dueDate,
                assignedTo: assignee || '',
                createdBy: currentUser.login,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            taskModal.classList.remove('active');
            return;
        }

        if (id) {
            var task = tasks.find(function(t) { return t.id === id; });
            if (task) {
                if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
                    alert('Вы не можете редактировать эту задачу');
                    return;
                }
                if (status === 'reports') {
                    taskToReport(task).then(function() { removeTask(task.id); });
                    taskModal.classList.remove('active');
                    return;
                }
                var updates = {
                    title: title,
                    description: description,
                    priority: priority,
                    dueDate: dueDate,
                    assignedTo: assignee || ''
                };
                if (status !== task.status) {
                    updates.previousStatus = task.status;
                    updates.status = status;
                }
                updateTask(id, updates);
                if (assignee && assignee !== task.assignedTo) {
                    sendEmailNotification(assignee, { title: title, description: description, priority: priority, dueDate: dueDate });
                }
            }
        } else {
            if (status === 'reports') {
                saveReport({
                    id: generateId(),
                    title: title,
                    description: description,
                    priority: priority,
                    reportNumber: computeReportNumber(),
                    dueDate: dueDate,
                    assignedTo: assignee || '',
                    createdBy: currentUser.login,
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            } else {
                var newTask = addTask({
                    title: title,
                    description: description,
                    status: status,
                    priority: priority,
                    dueDate: dueDate,
                    assignee: assignee || ''
                });
                if (assignee) {
                    sendEmailNotification(assignee, newTask);
                }
            }
        }
        taskModal.classList.remove('active');
    });
```

(Использует `currentItemMode`, объявленный в Step 1 этой задачи.)

- [ ] **Step 3: Обработка «Срочно/В работе» в `reportForm` submit**

Заменить всё тело обработчика `reportForm.addEventListener('submit', ...)` (строки 1524-1560) на:

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
        var reportStatus = document.getElementById('reportStatus').value;

        if (reportStatus === 'urgent' || reportStatus === 'in_progress') {
            if (id) {
                var rep = reports.find(function(r) { return r.id === id; });
                if (rep) {
                    reportToTask(rep, reportStatus).then(function() { removeReport(rep.id); });
                }
            } else {
                reportToTask({
                    title: title,
                    description: desc,
                    priority: priority,
                    dueDate: dueDate,
                    assignedTo: assignee || '',
                    createdBy: currentUser.login,
                    createdAt: new Date().toISOString()
                }, reportStatus);
            }
            reportModal.classList.remove('active');
            return;
        }

        if (id) {
            var rep2 = reports.find(function(r) { return r.id === id; });
            if (!rep2) return;
            saveReport(Object.assign({}, rep2, {
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

- [ ] **Step 4: Проверка синтаксиса**

Run: `node --check app.js`
Expected: нет вывода.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: task-to-report and report-to-task conversion"
```

---

