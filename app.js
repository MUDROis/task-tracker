// ============================================================
//  Трекер задач — PWA (администрация) — исправленная версия
//  Добавлена защита от ошибок localStorage, CDN-зависимости
// ============================================================

(function() {
    'use strict';

    // ---------- Конфигурация EmailJS ----------
    const EMAILJS_CONFIG = {
        serviceID: 'service_xxxxx',
        templateID: 'template_xxxxx',
        publicKey: 'user_xxxxx'
    };
    const EMAILJS_ENABLED = EMAILJS_CONFIG.serviceID !== 'service_xxxxx';

    // ---------- Глобальные переменные ----------
    let currentUser = null;
    let tasks = [];
    let users = [];

    // DOM-элементы
    const loginPage = document.getElementById('loginPage');
    const mainPage = document.getElementById('mainPage');
    const loginForm = document.getElementById('loginForm');
    const loginInput = document.getElementById('loginInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const userRoleBadge = document.getElementById('userRoleBadge');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');
    const manageUsersBtn = document.getElementById('manageUsersBtn');
    const taskModal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('modalTitle');
    const taskForm = document.getElementById('taskForm');
    const taskId = document.getElementById('taskId');
    const taskTitle = document.getElementById('taskTitle');
    const taskDesc = document.getElementById('taskDesc');
    const taskPriority = document.getElementById('taskPriority');
    const taskDueDate = document.getElementById('taskDueDate');
    const taskAssignee = document.getElementById('taskAssignee');
    const closeModal = document.querySelector('.close-modal');
    const usersModal = document.getElementById('usersModal');
    const usersList = document.getElementById('usersList');
    const addUserForm = document.getElementById('addUserForm');
    const newLogin = document.getElementById('newLogin');
    const newPassword = document.getElementById('newPassword');

    // ---------- Работа с localStorage (с защитой) ----------
    function isLocalStorageAvailable() {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('localStorage недоступен:', e);
            return false;
        }
    }

    function loadData() {
        if (!isLocalStorageAvailable()) {
            // Если localStorage недоступен, создаём фейковые данные в памяти
            users = [{ login: 'admin', passwordHash: hashPassword('admin'), role: 'admin' }];
            tasks = [];
            return;
        }
        try {
            const stored = localStorage.getItem('taskTracker_data');
            if (stored) {
                const data = JSON.parse(stored);
                tasks = data.tasks || [];
                users = data.users || [];
                // Гарантируем роль
                users = users.map(u => ({ ...u, role: u.role || 'employee' }));
            } else {
                users = [{ login: 'admin', passwordHash: hashPassword('admin'), role: 'admin' }];
                tasks = [];
                saveData();
            }
        } catch (e) {
            console.error('Ошибка загрузки данных:', e);
            users = [{ login: 'admin', passwordHash: hashPassword('admin'), role: 'admin' }];
            tasks = [];
            saveData();
        }
    }

    function saveData() {
        if (!isLocalStorageAvailable()) return;
        try {
            localStorage.setItem('taskTracker_data', JSON.stringify({ tasks, users }));
        } catch (e) {
            console.error('Ошибка сохранения данных:', e);
            alert('Не удалось сохранить данные. Возможно, хранилище переполнено.');
        }
    }

    function saveSession(user) {
        if (!isLocalStorageAvailable()) return;
        try {
            localStorage.setItem('taskTracker_session', JSON.stringify(user));
        } catch (e) {
            console.error('Ошибка сохранения сессии:', e);
        }
    }

    function clearSession() {
        if (!isLocalStorageAvailable()) return;
        try {
            localStorage.removeItem('taskTracker_session');
        } catch (e) {}
    }

    // ---------- Хеширование пароля ----------
    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    // ---------- Инициализация ----------
    function init() {
        console.log('Инициализация приложения...');
        loadData();
        // Проверяем сессию
        let session = null;
        if (isLocalStorageAvailable()) {
            try {
                const raw = localStorage.getItem('taskTracker_session');
                if (raw) session = JSON.parse(raw);
            } catch (e) {}
        }
        if (session && session.login && users.find(u => u.login === session.login)) {
            currentUser = session;
            console.log('Сессия восстановлена для', currentUser.login);
            showMainPage();
            renderBoard();
        } else {
            console.log('Сессия не найдена, показываем логин');
            showLoginPage();
        }
        // Инициализация EmailJS только если включено
        if (EMAILJS_ENABLED && typeof emailjs !== 'undefined') {
            try {
                emailjs.init(EMAILJS_CONFIG.publicKey);
            } catch (e) {
                console.warn('EmailJS не инициализирован:', e);
            }
        }
    }

    // ---------- Страницы ----------
    function showLoginPage() {
        loginPage.classList.add('active');
        mainPage.classList.remove('active');
        loginError.textContent = '';
        loginInput.value = '';
        passwordInput.value = '';
    }

    function showMainPage() {
        loginPage.classList.remove('active');
        mainPage.classList.add('active');
        userRoleBadge.textContent = currentUser.role === 'admin' ? 'Руководитель' : 'Сотрудник';
        manageUsersBtn.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
        populateAssigneeSelect();
    }

    // ---------- Авторизация ----------
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const login = loginInput.value.trim();
        const password = passwordInput.value;
        if (!login || !password) {
            loginError.textContent = 'Заполните оба поля';
            return;
        }
        const user = users.find(u => u.login === login);
        if (!user) {
            loginError.textContent = 'Пользователь не найден';
            return;
        }
        if (user.passwordHash !== hashPassword(password)) {
            loginError.textContent = 'Неверный пароль';
            return;
        }
        currentUser = { login: user.login, role: user.role };
        saveSession(currentUser);
        console.log('Вход выполнен:', currentUser.login);
        showMainPage();
        renderBoard();
    });

    logoutBtn.addEventListener('click', function() {
        clearSession();
        currentUser = null;
        showLoginPage();
        console.log('Выход выполнен');
    });

    // ---------- Управление пользователями ----------
    manageUsersBtn.addEventListener('click', function() {
        if (currentUser.role !== 'admin') return;
        renderUsersList();
        usersModal.classList.add('active');
    });

    function renderUsersList() {
        usersList.innerHTML = users.map(u => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid #e2e8f0;">
                <span><strong>${u.login}</strong> (${u.role === 'admin' ? 'Руководитель' : 'Сотрудник'})</span>
                ${u.login !== 'admin' ? `<button class="btn outline" data-login="${u.login}" style="padding:0.2rem 0.8rem;font-size:0.8rem;">Удалить</button>` : ''}
            </div>
        `).join('');
        usersList.querySelectorAll('[data-login]').forEach(btn => {
            btn.addEventListener('click', function() {
                const login = this.dataset.login;
                if (confirm(`Удалить пользователя "${login}"?`)) {
                    users = users.filter(u => u.login !== login);
                    saveData();
                    renderUsersList();
                    if (currentUser.login === login) {
                        clearSession();
                        currentUser = null;
                        showLoginPage();
                    }
                    populateAssigneeSelect();
                }
            });
        });
    }

    addUserForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const login = newLogin.value.trim();
        const password = newPassword.value.trim();
        if (!login || !password) return;
        if (users.find(u => u.login === login)) {
            alert('Пользователь с таким логином уже существует');
            return;
        }
        users.push({
            login: login,
            passwordHash: hashPassword(password),
            role: 'employee'
        });
        saveData();
        renderUsersList();
        newLogin.value = '';
        newPassword.value = '';
        populateAssigneeSelect();
    });

    // Закрытие модальных окон
    document.querySelectorAll('.close-modal').forEach(el => {
        el.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });

    // ---------- Работа с задачами ----------
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function getTasksForUser() {
        if (currentUser.role === 'admin') return tasks;
        return tasks.filter(t => t.createdBy === currentUser.login || t.assignedTo === currentUser.login);
    }

    function renderBoard() {
        console.log('Рендеринг доски...');
        try {
            const userTasks = getTasksForUser();
            userTasks.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

            const columns = ['in_progress', 'done', 'delegated'];
            columns.forEach(status => {
                const list = document.getElementById(`list_${status}`);
                const countEl = document.getElementById(`count_${status}`);
                if (!list || !countEl) {
                    console.warn('Элемент не найден для статуса', status);
                    return;
                }
                const filtered = userTasks.filter(t => t.status === status);
                countEl.textContent = filtered.length;
                list.innerHTML = '';
                if (filtered.length === 0) {
                    list.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem;text-align:center;padding:1rem 0;">Нет задач</p>';
                    return;
                }
                filtered.forEach(task => {
                    const card = createTaskCard(task);
                    list.appendChild(card);
                });
            });
            populateAssigneeSelect();
        } catch (e) {
            console.error('Ошибка при рендеринге доски:', e);
        }
    }

    function createTaskCard(task) {
        const div = document.createElement('div');
        div.className = `task-card priority-${task.priority || 'medium'}`;
        div.draggable = true;
        div.dataset.id = task.id;

        const assigneeName = task.assignedTo ? task.assignedTo : 'не назначен';
        const createdBy = task.createdBy || '—';

        div.innerHTML = `
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-meta">
                <span>📅 ${new Date(task.createdAt).toLocaleDateString()}</span>
                <span>👤 ${assigneeName}</span>
                ${task.dueDate ? `<span>⏳ ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
            </div>
            <div class="task-actions">
                ${task.status !== 'done' ? `<button class="btn-done" data-action="done">✅ Выполнено</button>` : ''}
                ${task.status !== 'delegated' && currentUser.role === 'admin' ? `<button class="btn-delegate" data-action="delegate">📤 Делегировать</button>` : ''}
                <button class="btn-delete" data-action="delete">🗑 Удалить</button>
            </div>
        `;

        div.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const action = this.dataset.action;
                if (action === 'delete') {
                    if (confirm('Удалить задачу?')) {
                        deleteTask(task.id);
                    }
                } else if (action === 'done') {
                    changeStatus(task.id, 'done');
                } else if (action === 'delegate') {
                    showDelegateModal(task.id);
                }
            });
        });

        // Drag & Drop
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragend', handleDragEnd);

        // Двойной клик для редактирования
        div.addEventListener('dblclick', function() {
            if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
                alert('Вы не можете редактировать эту задачу');
                return;
            }
            openTaskModal(task);
        });

        return div;
    }

    // ---------- Drag & Drop ----------
    let draggedTaskId = null;

    function handleDragStart(e) {
        draggedTaskId = this.dataset.id;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        document.querySelectorAll('.task-list').forEach(el => el.classList.remove('drag-over'));
    }

    document.querySelectorAll('.task-list').forEach(list => {
        list.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });
        list.addEventListener('dragleave', function(e) {
            this.classList.remove('drag-over');
        });
        list.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            if (!draggedTaskId) return;
            const column = this.closest('.column');
            if (!column) return;
            const newStatus = column.dataset.status;
            const task = tasks.find(t => t.id === draggedTaskId);
            if (!task) return;
            if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login && task.assignedTo !== currentUser.login) {
                alert('Вы не можете изменять эту задачу');
                draggedTaskId = null;
                return;
            }
            changeStatus(draggedTaskId, newStatus);
            draggedTaskId = null;
        });
    });

    // ---------- CRUD задач ----------
    function addTask(taskData) {
        const newTask = {
            id: generateId(),
            title: taskData.title.trim(),
            description: taskData.description || '',
            status: taskData.assignee ? 'delegated' : 'in_progress',
            createdBy: currentUser.login,
            assignedTo: taskData.assignee || '',
            priority: taskData.priority || 'medium',
            dueDate: taskData.dueDate || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        tasks.push(newTask);
        saveData();
        renderBoard();
        if (newTask.status === 'delegated' && newTask.assignedTo) {
            sendEmailNotification(newTask.assignedTo, newTask.title, newTask.dueDate);
        }
        return newTask;
    }

    function deleteTask(id) {
        tasks = tasks.filter(t => t.id !== id);
        saveData();
        renderBoard();
    }

    function changeStatus(id, newStatus) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        if (newStatus === 'delegated' && currentUser.role !== 'admin') {
            alert('Только руководитель может делегировать задачи');
            return;
        }
        task.status = newStatus;
        task.updatedAt = new Date().toISOString();
        saveData();
        renderBoard();
    }

    function updateTask(id, updates) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        Object.assign(task, updates);
        task.updatedAt = new Date().toISOString();
        saveData();
        renderBoard();
    }

    // ---------- Делегирование ----------
    function showDelegateModal(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const assignees = users.filter(u => u.login !== currentUser.login && u.role === 'employee').map(u => u.login);
        if (assignees.length === 0) {
            alert('Нет доступных сотрудников для делегирования');
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
                <h3>Делегировать задачу</h3>
                <p><strong>${task.title}</strong></p>
                <div class="form-group">
                    <label for="delegateSelect">Выберите сотрудника</label>
                    <select id="delegateSelect">
                        ${assignees.map(login => `<option value="${login}">${login}</option>`).join('')}
                    </select>
                </div>
                <button id="delegateConfirmBtn" class="btn primary">Делегировать</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#delegateConfirmBtn').addEventListener('click', function() {
            const selected = document.getElementById('delegateSelect').value;
            if (selected) {
                task.assignedTo = selected;
                task.status = 'delegated';
                task.updatedAt = new Date().toISOString();
                saveData();
                renderBoard();
                sendEmailNotification(selected, task.title, task.dueDate);
                modal.remove();
            }
        });
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
    }

    // ---------- Уведомления по почте ----------
    function sendEmailNotification(toLogin, taskTitle, dueDate) {
        if (!EMAILJS_ENABLED || typeof emailjs === 'undefined') {
            console.warn('EmailJS не настроен или не загружен');
            return;
        }
        const user = users.find(u => u.login === toLogin);
        if (!user) return;
        const toEmail = `${toLogin}@example.com`;
        const templateParams = {
            to_email: toEmail,
            to_name: toLogin,
            task_title: taskTitle,
            due_date: dueDate ? new Date(dueDate).toLocaleDateString() : 'не указан',
            from_name: currentUser.login
        };
        try {
            emailjs.send(EMAILJS_CONFIG.serviceID, EMAILJS_CONFIG.templateID, templateParams, EMAILJS_CONFIG.publicKey)
                .then(function(response) {
                    console.log('Уведомление отправлено:', response);
                }, function(error) {
                    console.error('Ошибка отправки:', error);
                });
        } catch (e) {
            console.error('Ошибка при отправке email:', e);
        }
    }

    // ---------- Популяция select исполнителей ----------
    function populateAssigneeSelect() {
        const select = taskAssignee;
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">Не назначен</option>';
        users.filter(u => u.login !== currentUser?.login && u.role === 'employee').forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.login;
            opt.textContent = u.login;
            select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
    }

    // ---------- Модальное окно задачи ----------
    function openTaskModal(taskData) {
        if (taskData) {
            modalTitle.textContent = 'Редактировать задачу';
            taskId.value = taskData.id;
            taskTitle.value = taskData.title;
            taskDesc.value = taskData.description || '';
            taskPriority.value = taskData.priority || 'medium';
            taskDueDate.value = taskData.dueDate || '';
            taskAssignee.value = taskData.assignedTo || '';
        } else {
            modalTitle.textContent = 'Новая задача';
            taskId.value = '';
            taskTitle.value = '';
            taskDesc.value = '';
            taskPriority.value = 'medium';
            taskDueDate.value = '';
            taskAssignee.value = '';
        }
        taskModal.classList.add('active');
    }

    taskForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const id = taskId.value;
        const title = taskTitle.value.trim();
        if (!title) return;
        const description = taskDesc.value.trim();
        const priority = taskPriority.value;
        const dueDate = taskDueDate.value;
        const assignee = taskAssignee.value;

        if (id) {
            const task = tasks.find(t => t.id === id);
            if (task) {
                if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
                    alert('Вы не можете редактировать эту задачу');
                    return;
                }
                const oldAssignee = task.assignedTo;
                task.title = title;
                task.description = description;
                task.priority = priority;
                task.dueDate = dueDate;
                if (assignee) {
                    task.assignedTo = assignee;
                    task.status = 'delegated';
                } else {
                    task.assignedTo = '';
                    if (task.status === 'delegated') task.status = 'in_progress';
                }
                task.updatedAt = new Date().toISOString();
                saveData();
                renderBoard();
                if (assignee && oldAssignee !== assignee) {
                    sendEmailNotification(assignee, title, dueDate);
                }
            }
        } else {
            const newTask = {
                title: title,
                description: description,
                priority: priority,
                dueDate: dueDate,
                assignee: assignee || ''
            };
            addTask(newTask);
        }
        taskModal.classList.remove('active');
    });

    addTaskBtn.addEventListener('click', function() {
        openTaskModal(null);
    });

    // ---------- Экспорт Excel ----------
    exportBtn.addEventListener('click', function() {
        if (typeof XLSX === 'undefined') {
            alert('Библиотека XLSX не загружена. Проверьте интернет-соединение.');
            return;
        }
        const dataToExport = tasks.map(t => ({
            'ID': t.id,
            'Заголовок': t.title,
            'Описание': t.description || '',
            'Статус': t.status === 'in_progress' ? 'В работе' : (t.status === 'done' ? 'Выполнено' : 'Делегировано'),
            'Создал': t.createdBy || '',
            'Исполнитель': t.assignedTo || '',
            'Приоритет': t.priority || 'medium',
            'Срок': t.dueDate || '',
            'Создано': t.createdAt ? new Date(t.createdAt).toLocaleString() : '',
            'Обновлено': t.updatedAt ? new Date(t.updatedAt).toLocaleString() : ''
        }));
        if (dataToExport.length === 0) {
            alert('Нет задач для экспорта');
            return;
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [
            {wch:12}, {wch:25}, {wch:30}, {wch:15}, {wch:12},
            {wch:12}, {wch:10}, {wch:12}, {wch:25}, {wch:20}
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Задачи');
        XLSX.writeFile(wb, `Задачи_${new Date().toISOString().slice(0,10)}.xlsx`);
    });

    // ---------- Импорт Excel ----------
    importBtn.addEventListener('click', function() {
        if (typeof XLSX === 'undefined') {
            alert('Библиотека XLSX не загружена. Проверьте интернет-соединение.');
            return;
        }
        fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const data = new Uint8Array(ev.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet);
                let added = 0;
                rows.forEach(row => {
                    const id = row['ID'] || generateId();
                    const existing = tasks.find(t => t.id === id);
                    if (existing) {
                        existing.title = row['Заголовок'] || existing.title;
                        existing.description = row['Описание'] || existing.description;
                        existing.status = row['Статус'] === 'В работе' ? 'in_progress' : (row['Статус'] === 'Выполнено' ? 'done' : 'delegated');
                        existing.assignedTo = row['Исполнитель'] || existing.assignedTo;
                        existing.priority = row['Приоритет'] || existing.priority;
                        existing.dueDate = row['Срок'] || existing.dueDate;
                        existing.updatedAt = new Date().toISOString();
                    } else {
                        const newTask = {
                            id: id,
                            title: row['Заголовок'] || 'Без названия',
                            description: row['Описание'] || '',
                            status: row['Статус'] === 'В работе' ? 'in_progress' : (row['Статус'] === 'Выполнено' ? 'done' : 'delegated'),
                            createdBy: row['Создал'] || 'admin',
                            assignedTo: row['Исполнитель'] || '',
                            priority: row['Приоритет'] || 'medium',
                            dueDate: row['Срок'] || '',
                            createdAt: row['Создано'] ? new Date(row['Создано']).toISOString() : new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        tasks.push(newTask);
                        added++;
                    }
                });
                saveData();
                renderBoard();
                alert(`Импорт завершён. Добавлено ${added} новых задач, обновлено существующих.`);
            } catch(err) {
                alert('Ошибка при импорте: ' + err.message);
            }
            fileInput.value = '';
        };
        reader.readAsArrayBuffer(file);
    });

    // ---------- Вспомогательные функции ----------
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ---------- Запуск ----------
    // Ждём полной загрузки DOM, чтобы все элементы были доступны
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();