// ============================================================
//  Трекер задач — PWA (администрация)
//  Логика: авторизация, задачи, статусы, делегирование,
//  экспорт/импорт Excel, уведомления EmailJS.
// ============================================================

(function() {
    'use strict';

    // ---------- Конфигурация EmailJS ----------
    // Замените на свои данные после регистрации на emailjs.com
    const EMAILJS_CONFIG = {
        serviceID: 'service_xxxxx',
        templateID: 'template_xxxxx',
        publicKey: 'user_xxxxx'
    };
    // Если не заполнено, уведомления работать не будут
    const EMAILJS_ENABLED = EMAILJS_CONFIG.serviceID !== 'service_xxxxx';

    // ---------- Глобальные переменные ----------
    let currentUser = null;          // { login, role }
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

    // ---------- Инициализация ----------
    function init() {
        loadData();
        // Проверяем, есть ли пользователь в сессии
        const savedSession = localStorage.getItem('taskTracker_session');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                if (session.login && users.find(u => u.login === session.login)) {
                    currentUser = session;
                    showMainPage();
                    renderBoard();
                    return;
                }
            } catch(e) {}
        }
        showLoginPage();
    }

    // ---------- Работа с хранилищем ----------
    function loadData() {
        try {
            const stored = localStorage.getItem('taskTracker_data');
            if (stored) {
                const data = JSON.parse(stored);
                tasks = data.tasks || [];
                users = data.users || [];
            } else {
                // Первый запуск: создаём администратора
                users = [
                    { login: 'admin', passwordHash: hashPassword('admin'), role: 'admin' }
                ];
                tasks = [];
                saveData();
            }
        } catch(e) {
            users = [{ login: 'admin', passwordHash: hashPassword('admin'), role: 'admin' }];
            tasks = [];
            saveData();
        }
        // Убедимся, что у каждого пользователя есть роль
        users = users.map(u => ({ ...u, role: u.role || 'employee' }));
    }

    function saveData() {
        localStorage.setItem('taskTracker_data', JSON.stringify({ tasks, users }));
    }

    function saveSession(user) {
        localStorage.setItem('taskTracker_session', JSON.stringify(user));
    }

    function clearSession() {
        localStorage.removeItem('taskTracker_session');
    }

    // Простое хеширование (SHA-256 через SubtleCrypto не везде доступно, используем упрощённый)
    function hashPassword(password) {
        // В реальном проекте лучше использовать bcrypt или Web Crypto API,
        // но для локального использования достаточно простого хеша.
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32-bit
        }
        return hash.toString(16);
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
        // Заполнить список исполнителей в форме
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
        showMainPage();
        renderBoard();
    });

    logoutBtn.addEventListener('click', function() {
        clearSession();
        currentUser = null;
        showLoginPage();
    });

    // ---------- Управление пользователями (только admin) ----------
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
        // Добавляем обработчики удаления
        usersList.querySelectorAll('[data-login]').forEach(btn => {
            btn.addEventListener('click', function() {
                const login = this.dataset.login;
                if (confirm(`Удалить пользователя "${login}"?`)) {
                    users = users.filter(u => u.login !== login);
                    saveData();
                    renderUsersList();
                    // Если текущий пользователь удалён — выйти
                    if (currentUser.login === login) {
                        clearSession();
                        currentUser = null;
                        showLoginPage();
                    }
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
        const userTasks = getTasksForUser();
        // Сортируем по дате создания (новые сверху)
        userTasks.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

        const columns = ['in_progress', 'done', 'delegated'];
        columns.forEach(status => {
            const list = document.getElementById(`list_${status}`);
            const countEl = document.getElementById(`count_${status}`);
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

        // Обновить select исполнителей (для новых задач)
        populateAssigneeSelect();
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

        // Обработчики
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
        // Для мобильных устройств можно добавить touch, но пока оставим drag

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

    // Навешиваем обработчики на колонки
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
            // Проверка прав: сотрудник может менять статус только у своих задач
            const task = tasks.find(t => t.id === draggedTaskId);
            if (!task) return;
            if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login && task.assignedTo !== currentUser.login) {
                alert('Вы
