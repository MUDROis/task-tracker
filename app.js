// ============================================================
//  Трекер задач — PWA с Firebase Realtime Database
//  Данные синхронизируются между всеми устройствами в реальном времени
// ============================================================

(function() {
    'use strict';

    // ---------- Глобальные переменные ----------
    let currentUser = null;
    let tasks = [];
    let users = [];
    let firebaseReady = false;
    let db = null;
    let knownTaskIds = new Set();
    let initialLoadDone = false;

    // ---------- Звуковое уведомление ----------
    function playNotificationSound() {
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) {}
    }

    // ---------- Визуальное уведомление ----------
    function showToast(title, subtitle, type) {
        type = type || 'new-task';
        var container = document.getElementById('toastContainer');
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        var icon = type === 'delegated' ? '📤' : '📋';
        toast.innerHTML =
            '<span class="toast-icon">' + icon + '</span>' +
            '<div class="toast-body">' +
                '<span class="toast-title">' + escapeHtml(title) + '</span>' +
                '<span class="toast-subtitle">' + escapeHtml(subtitle) + '</span>' +
            '</div>';
        container.appendChild(toast);
        setTimeout(function() {
            toast.classList.add('toast-exit');
            setTimeout(function() { toast.remove(); }, 300);
        }, 4000);
    }

    // ---------- Конфигурация EmailJS ----------
    const EMAILJS_PUBLIC_KEY = 'lb2TPZ78OFd1qVw_Z';
    const EMAILJS_SERVICE_ID = 'service_ikd99cp';
    const EMAILJS_TEMPLATE_ID = 'template_vd7pyer';

    // ---------- Firebase пути ----------
    function getTasksRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/tasks');
    }
    function getUsersRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/users');
    }

    // ---------- DOM-элементы ----------
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

    // ---------- Color picker interactivity ----------
    const newUserColorInput = document.getElementById('newUserColor');
    if (newUserColorInput) {
        const newUserColorPreview = newUserColorInput.closest('.color-picker-row').querySelector('.color-preview');
        newUserColorInput.addEventListener('input', function() {
            newUserColorPreview.style.background = this.value;
        });
        document.querySelectorAll('#addUserForm .color-preset-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                newUserColorInput.value = this.dataset.color;
                newUserColorPreview.style.background = this.dataset.color;
            });
        });
    }

    const DEFAULT_COLORS = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1'];

    // ---------- Работа с localStorage (сессия) ----------
    function isLocalStorageAvailable() {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    function saveSession(user) {
        if (!isLocalStorageAvailable()) return;
        try {
            localStorage.setItem('taskTracker_session', JSON.stringify(user));
        } catch (e) {}
    }

    function clearSession() {
        if (!isLocalStorageAvailable()) return;
        try {
            localStorage.removeItem('taskTracker_session');
        } catch (e) {}
    }

    function loadSession() {
        if (!isLocalStorageAvailable()) return null;
        try {
            const raw = localStorage.getItem('taskTracker_session');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return null;
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

    // ---------- Firebase: загрузка данных ----------
    function initFirebaseListeners() {
        // Слушаем задачи в реальном времени
        getTasksRef().on('value', function(snapshot) {
            var data = snapshot.val();
            var newTasks = data ? Object.values(data) : [];
            newTasks.forEach(function(t) {
                if (t.status === 'delegated') t.status = 'in_progress';
            });

            // Обнаружение новых задач
            if (initialLoadDone && currentUser) {
                var newIds = new Set(newTasks.map(function(t) { return t.id; }));
                newTasks.forEach(function(t) {
                    if (!knownTaskIds.has(t.id)) {
                        var isDelegatedToMe = t.assignedTo === currentUser.login && t.delegated;
                        var isMyTask = t.createdBy === currentUser.login;
                        if (isDelegatedToMe && !isMyTask) {
                            playNotificationSound();
                            showToast(t.title, 'Делегировано вам ' + (t.createdBy || ''), 'delegated');
                        } else if (!isMyTask) {
                            playNotificationSound();
                            showToast(t.title, 'Новая задача от ' + (t.createdBy || ''), 'new-task');
                        }
                    }
                });
            }

            tasks = newTasks;
            knownTaskIds = new Set(tasks.map(function(t) { return t.id; }));
            initialLoadDone = true;
            renderBoard();
        });

        // Слушаем пользователей в реальном времени
        getUsersRef().on('value', function(snapshot) {
            const data = snapshot.val();
            users = data ? Object.values(data) : [];
            users = users.map(function(u) {
                return Object.assign({}, u, {
                    role: u.role || 'employee',
                    color: u.color || DEFAULT_COLORS[users.indexOf(u) % DEFAULT_COLORS.length],
                    email: u.email || ''
                });
            });
            // Если текущий пользователь есть в списке — обновляем его данные
            if (currentUser) {
                const fresh = users.find(function(u) { return u.login === currentUser.login; });
                if (fresh) {
                    currentUser = { login: fresh.login, role: fresh.role };
                }
            }
            populateAssigneeSelect();
        });
    }

    // ---------- Firebase: запись данных ----------
    function saveTask(task) {
        getTasksRef().child(task.id).set(task);
    }

    function removeTask(taskId) {
        getTasksRef().child(taskId).remove();
    }

    function saveUser(user) {
        getUsersRef().child(user.login).set(user);
    }

    function removeUser(login) {
        getUsersRef().child(login).remove();
    }

    // ---------- Автосоздание admin-пользователя ----------
    function ensureAdminUser() {
        getUsersRef().child('admin').once('value').then(function(snapshot) {
            if (!snapshot.val()) {
                saveUser({
                    login: 'admin',
                    passwordHash: hashPassword('1'),
                    role: 'admin',
                    color: '#3b82f6',
                    email: ''
                });
                console.log('Создан пользователь admin (пароль: 1)');
            }
        });
    }

    // ---------- Инициализация ----------
    function init() {
        console.log('Инициализация приложения...');

        // Создаём admin если его нет
        ensureAdminUser();

        // Проверяем сессию
        const session = loadSession();
        if (session && session.login) {
            currentUser = session;
            console.log('Сессия восстановлена для', currentUser.login);
            showMainPage();
            // Подключаем Firebase listeners
            initFirebaseListeners();
        } else {
            console.log('Сессия не найдена, показываем логин');
            showLoginPage();
        }

        // Инициализация EmailJS
        if (EMAILJS_PUBLIC_KEY && typeof emailjs !== 'undefined') {
            try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch (e) {}
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
        const mobileManage = document.getElementById('mobileManageBtn');
        if (mobileManage) mobileManage.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
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

        // Проверяем пользователя в Firebase
        getUsersRef().child(login).once('value').then(function(snapshot) {
            const user = snapshot.val();
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
            initFirebaseListeners();
        }).catch(function(err) {
            console.error('Ошибка Firebase:', err);
            loginError.textContent = 'Ошибка подключения к серверу';
        });
    });

    logoutBtn.addEventListener('click', function() {
        // Отключаем listeners
        getTasksRef().off();
        getUsersRef().off();
        clearSession();
        currentUser = null;
        showLoginPage();
    });

    // ---------- Управление пользователями ----------
    manageUsersBtn.addEventListener('click', function() {
        if (currentUser.role !== 'admin') return;
        renderUsersList();
        usersModal.classList.add('active');
    });

    function renderUsersList() {
        usersList.innerHTML = users.map(function(u) {
            var isAdmin = u.login === 'admin';
            return '<div class="user-row" data-user="' + escapeHtml(u.login) + '">' +
                '<div class="user-row-view">' +
                    '<span class="user-color-dot" style="background:' + (u.color || '#94a3b8') + '"></span>' +
                    '<span><strong>' + escapeHtml(u.login) + '</strong> (' + (u.role === 'admin' ? 'Руководитель' : 'Сотрудник') + ')' + (u.email ? ' · ' + escapeHtml(u.email) : '') + '</span>' +
                    '<div class="user-row-actions">' +
                        '<button class="btn outline btn-edit-user" data-login="' + escapeHtml(u.login) + '" style="padding:0.2rem 0.6rem;font-size:0.8rem;">Изменить</button>' +
                        (!isAdmin ? '<button class="btn outline btn-delete-user" data-login="' + escapeHtml(u.login) + '" style="padding:0.2rem 0.6rem;font-size:0.8rem;color:#dc2626;">Удалить</button>' : '') +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        usersList.querySelectorAll('.btn-delete-user').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var login = this.dataset.login;
                if (confirm('Удалить пользователя "' + login + '"?')) {
                    removeUser(login);
                    // Удаляем задачи пользователя
                    tasks.forEach(function(t) {
                        if (t.createdBy === login || t.assignedTo === login) {
                            removeTask(t.id);
                        }
                    });
                    if (currentUser.login === login) {
                        clearSession();
                        currentUser = null;
                        showLoginPage();
                    }
                }
            });
        });

        usersList.querySelectorAll('.btn-edit-user').forEach(function(btn) {
            btn.addEventListener('click', function() {
                openEditUserModal(this.dataset.login);
            });
        });
    }

    function openEditUserModal(login) {
        const user = users.find(function(u) { return u.login === login; });
        if (!user) return;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:400px;">' +
                '<span class="close-modal" onclick="this.closest(\'.modal\').remove()">&times;</span>' +
                '<h3>Редактировать сотрудника</h3>' +
                '<form id="editUserForm">' +
                    '<div class="form-group">' +
                        '<label for="editLogin">Логин</label>' +
                        '<input type="text" id="editLogin" value="' + escapeHtml(user.login) + '" required>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label for="editPassword">Новый пароль (оставьте пустым без изменений)</label>' +
                        '<input type="password" id="editPassword" placeholder="••••••">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label for="editEmail">Email для уведомлений</label>' +
                        '<input type="email" id="editEmail" value="' + escapeHtml(user.email || '') + '" placeholder="user@example.com">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label for="editColor">Цвет на доске</label>' +
                        '<div class="color-picker-row">' +
                            '<input type="color" id="editColor" value="' + (user.color || '#3b82f6') + '">' +
                            '<span class="color-preview" style="background:' + (user.color || '#3b82f6') + '"></span>' +
                            '<div class="color-presets">' +
                                DEFAULT_COLORS.map(function(c) {
                                    return '<button type="button" class="color-preset-btn" data-color="' + c + '" style="background:' + c + '"></button>';
                                }).join('') +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<button type="submit" class="btn primary">Сохранить</button>' +
                '</form>' +
            '</div>';
        document.body.appendChild(modal);

        const colorInput = modal.querySelector('#editColor');
        const colorPreview = modal.querySelector('.color-preview');
        colorInput.addEventListener('input', function() {
            colorPreview.style.background = this.value;
        });
        modal.querySelectorAll('.color-preset-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                colorInput.value = this.dataset.color;
                colorPreview.style.background = this.dataset.color;
            });
        });

        modal.querySelector('#editUserForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const newLoginVal = modal.querySelector('#editLogin').value.trim();
            const newPasswordVal = modal.querySelector('#editPassword').value;
            const newColor = colorInput.value;
            const newEmail = modal.querySelector('#editEmail').value.trim();

            if (!newLoginVal) {
                alert('Логин не может быть пустым');
                return;
            }
            if (newLoginVal !== login && users.find(function(u) { return u.login === newLoginVal; })) {
                alert('Пользователь с таким логином уже существует');
                return;
            }

            const oldLogin = user.login;
            const updatedUser = Object.assign({}, user, {
                login: newLoginVal,
                color: newColor,
                email: newEmail
            });
            if (newPasswordVal) {
                updatedUser.passwordHash = hashPassword(newPasswordVal);
            }

            // Удаляем старую запись, создаём новую (если логин изменился)
            if (oldLogin !== newLoginVal) {
                removeUser(oldLogin);
                // Обновляем ссылки в задачах
                tasks.forEach(function(t) {
                    if (t.createdBy === oldLogin || t.assignedTo === oldLogin) {
                        var updated = Object.assign({}, t);
                        if (updated.createdBy === oldLogin) updated.createdBy = newLoginVal;
                        if (updated.assignedTo === oldLogin) updated.assignedTo = newLoginVal;
                        saveTask(updated);
                    }
                });
                if (currentUser.login === oldLogin) {
                    currentUser.login = newLoginVal;
                    saveSession(currentUser);
                }
            }
            saveUser(updatedUser);
            modal.remove();
        });

        modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
    }

    addUserForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const login = newLogin.value.trim();
        const password = newPassword.value.trim();
        const color = document.getElementById('newUserColor').value;
        const email = document.getElementById('newUserEmail').value.trim();
        if (!login || !password) return;
        if (users.find(function(u) { return u.login === login; })) {
            alert('Пользователь с таким логином уже существует');
            return;
        }
        saveUser({
            login: login,
            passwordHash: hashPassword(password),
            role: 'employee',
            color: color,
            email: email
        });
        newLogin.value = '';
        newPassword.value = '';
        document.getElementById('newUserEmail').value = '';
    });

    // Закрытие модальных окон
    document.querySelectorAll('.close-modal').forEach(function(el) {
        el.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });

    // ---------- Работа с задачами ----------
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function getTasksForUser() {
        if (currentUser.role === 'admin') return tasks;
        return tasks.filter(function(t) {
            return t.createdBy === currentUser.login || t.assignedTo === currentUser.login;
        });
    }

    function renderBoard() {
        try {
            const userTasks = getTasksForUser();
            userTasks.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

            const columns = ['urgent', 'in_progress', 'done'];
            columns.forEach(function(status) {
                const list = document.getElementById('list_' + status);
                const countEl = document.getElementById('count_' + status);
                if (!list || !countEl) return;
                const filtered = userTasks.filter(function(t) { return t.status === status; });
                countEl.textContent = filtered.length;
                list.innerHTML = '';
                if (filtered.length === 0) {
                    list.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem;text-align:center;padding:1rem 0;">Нет задач</p>';
                    return;
                }
                filtered.forEach(function(task) {
                    list.appendChild(createTaskCard(task));
                });
            });
            populateAssigneeSelect();
        } catch (e) {
            console.error('Ошибка при рендеринге доски:', e);
        }
    }

    function createTaskCard(task) {
        const div = document.createElement('div');
        div.className = 'task-card priority-' + (task.priority || 'medium');
        div.draggable = true;
        div.dataset.id = task.id;

        const assigneeUser = task.assignedTo ? users.find(function(u) { return u.login === task.assignedTo; }) : null;
        const assigneeName = task.assignedTo ? task.assignedTo : 'не назначен';
        const borderColor = assigneeUser ? assigneeUser.color : '';
        if (borderColor) {
            div.style.borderLeftColor = borderColor;
        }

        div.innerHTML =
            (task.delegated ? '<span class="task-delegate-arrow">↗</span>' : '') +
            '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
            '<div class="task-meta">' +
                '<span>📅 ' + new Date(task.createdAt).toLocaleDateString() + '</span>' +
                '<span>👤 ' + escapeHtml(assigneeName) + '</span>' +
                (task.dueDate ? '<span>⏳ ' + new Date(task.dueDate).toLocaleDateString() + '</span>' : '') +
            '</div>' +
            '<div class="task-actions-row1">' +
                (task.status !== 'done'
                    ? '<button class="btn-done" data-action="done">✅ Выполнить</button>'
                    : '<button class="btn-restore" data-action="restore">↩ Вернуть</button>') +
                (task.status !== 'done' && currentUser.role === 'admin'
                    ? '<button class="btn-delegate" data-action="delegate">📤 Делегировать</button>'
                    : '') +
            '</div>' +
            '<div class="task-actions-row2">' +
                '<button class="btn-open" data-action="open" title="Открыть">⭕</button>' +
                '<button class="btn-settings" data-action="settings" title="Настройки">⚙️</button>' +
                '<button class="btn-delete" data-action="delete" title="Удалить">🗑</button>' +
            '</div>';

        div.querySelectorAll('[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var action = this.dataset.action;
                if (action === 'delete') {
                    if (confirm('Удалить задачу?')) {
                        removeTask(task.id);
                    }
                } else if (action === 'done') {
                    changeStatus(task.id, 'done');
                } else if (action === 'restore') {
                    changeStatus(task.id, task.previousStatus || 'in_progress');
                } else if (action === 'delegate') {
                    showDelegateModal(task.id);
                } else if (action === 'open') {
                    showTaskDetails(task);
                } else if (action === 'settings') {
                    if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
                        alert('Вы не можете редактировать эту задачу');
                        return;
                    }
                    openTaskModal(task);
                }
            });
        });

        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragend', handleDragEnd);

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
        document.querySelectorAll('.task-list').forEach(function(el) { el.classList.remove('drag-over'); });
    }

    document.querySelectorAll('.task-list').forEach(function(list) {
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
            var column = this.closest('.column');
            if (!column) return;
            var newStatus = column.dataset.status;
            var task = tasks.find(function(t) { return t.id === draggedTaskId; });
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
        var newTask = {
            id: generateId(),
            title: taskData.title.trim(),
            description: taskData.description || '',
            status: 'in_progress',
            previousStatus: '',
            delegated: false,
            createdBy: currentUser.login,
            assignedTo: taskData.assignee || '',
            priority: taskData.priority || 'medium',
            dueDate: taskData.dueDate || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        saveTask(newTask);
        return newTask;
    }

    function changeStatus(id, newStatus) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;
        var updated = Object.assign({}, task);
        if (newStatus === 'done') {
            updated.previousStatus = task.status;
        }
        updated.status = newStatus;
        updated.updatedAt = new Date().toISOString();
        saveTask(updated);
    }

    function updateTask(id, updates) {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;
        var updated = Object.assign({}, task, updates);
        updated.updatedAt = new Date().toISOString();
        saveTask(updated);
    }

    // ---------- Показ деталей задачи ----------
    function showTaskDetails(task) {
        var assigneeName = task.assignedTo ? task.assignedTo : 'не назначен';
        var priorityLabels = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
        var statusLabels = { urgent: 'Срочно', in_progress: 'В работе', done: 'Выполнено' };
        var modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:450px;">' +
                '<span class="close-modal" onclick="this.closest(\'.modal\').remove()">&times;</span>' +
                '<h3>' + escapeHtml(task.title) + '</h3>' +
                '<div style="margin-top:1rem;font-size:0.95rem;color:#334155;">' +
                    '<p><strong>Описание:</strong> ' + (task.description ? escapeHtml(task.description) : '<em>нет</em>') + '</p>' +
                    '<p><strong>Статус:</strong> ' + (statusLabels[task.status] || task.status) + '</p>' +
                    '<p><strong>Приоритет:</strong> ' + (priorityLabels[task.priority] || task.priority) + '</p>' +
                    '<p><strong>Исполнитель:</strong> ' + escapeHtml(assigneeName) + '</p>' +
                    '<p><strong>Создал:</strong> ' + escapeHtml(task.createdBy || '—') + '</p>' +
                    '<p><strong>Создано:</strong> ' + new Date(task.createdAt).toLocaleString() + '</p>' +
                    (task.dueDate ? '<p><strong>Срок:</strong> ' + new Date(task.dueDate).toLocaleDateString() + '</p>' : '') +
                    (task.updatedAt ? '<p><strong>Обновлено:</strong> ' + new Date(task.updatedAt).toLocaleString() + '</p>' : '') +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    }

    // ---------- Делегирование ----------
    function showDelegateModal(taskId) {
        var task = tasks.find(function(t) { return t.id === taskId; });
        if (!task) return;
        var assignees = users
            .filter(function(u) { return u.login !== currentUser.login && u.role === 'employee'; })
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
                '<h3>Делегировать задачу</h3>' +
                '<p><strong>' + escapeHtml(task.title) + '</strong></p>' +
                '<div class="form-group">' +
                    '<label for="delegateSelect">Выберите сотрудника</label>' +
                    '<select id="delegateSelect">' +
                        assignees.map(function(login) {
                            return '<option value="' + escapeHtml(login) + '" ' + (task.assignedTo === login ? 'selected' : '') + '>' + escapeHtml(login) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
                '<button id="delegateConfirmBtn" class="btn primary">Делегировать</button>' +
            '</div>';
        document.body.appendChild(modal);
        modal.querySelector('#delegateConfirmBtn').addEventListener('click', function() {
            var selected = document.getElementById('delegateSelect').value;
            var updated = Object.assign({}, task, {
                assignedTo: selected,
                delegated: true,
                updatedAt: new Date().toISOString()
            });
            saveTask(updated);
            sendEmailNotification(selected, task.title);
            modal.remove();
        });
        modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
    }

    // ---------- Уведомления по почте ----------
    function sendEmailNotification(toLogin, taskTitle) {
        if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) return;
        if (typeof emailjs === 'undefined') return;
        var user = users.find(function(u) { return u.login === toLogin; });
        var toEmail = user && user.email ? user.email : '';
        if (!toEmail) return;
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: toEmail,
            to_name: toLogin,
            task_title: taskTitle,
            from_name: currentUser.login
        }).then(function(res) {
            console.log('EmailJS: письмо отправлено', res);
        }).catch(function(err) {
            console.error('EmailJS: ошибка отправки', err);
        });
    }

    // ---------- Популяция select исполнителей ----------
    function populateAssigneeSelect() {
        var select = taskAssignee;
        if (!select) return;
        var currentVal = select.value;
        select.innerHTML = '<option value="">Не назначен</option>';
        users
            .filter(function(u) { return u.login !== (currentUser && currentUser.login) && u.role === 'employee'; })
            .forEach(function(u) {
                var opt = document.createElement('option');
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
        var id = taskId.value;
        var title = taskTitle.value.trim();
        if (!title) return;
        var description = taskDesc.value.trim();
        var priority = taskPriority.value;
        var dueDate = taskDueDate.value;
        var assignee = taskAssignee.value;

        if (id) {
            var task = tasks.find(function(t) { return t.id === id; });
            if (task) {
                if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
                    alert('Вы не можете редактировать эту задачу');
                    return;
                }
                updateTask(id, {
                    title: title,
                    description: description,
                    priority: priority,
                    dueDate: dueDate,
                    assignedTo: assignee || ''
                });
                if (assignee && assignee !== task.assignedTo) {
                    sendEmailNotification(assignee, title);
                }
            }
        } else {
            var newTask = addTask({
                title: title,
                description: description,
                priority: priority,
                dueDate: dueDate,
                assignee: assignee || ''
            });
            if (assignee) {
                sendEmailNotification(assignee, title);
            }
        }
        taskModal.classList.remove('active');
    });

    addTaskBtn.addEventListener('click', function() {
        openTaskModal(null);
    });

    // ---------- Мобильные кнопки ----------
    var mobileAddBtn = document.getElementById('mobileAddBtn');
    var mobileManageBtn = document.getElementById('mobileManageBtn');
    var mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
    var mobileSettingsDropdown = document.getElementById('mobileSettingsDropdown');
    var mobileExportBtn = document.getElementById('mobileExportBtn');
    var mobileImportBtn = document.getElementById('mobileImportBtn');

    if (mobileAddBtn) {
        mobileAddBtn.addEventListener('click', function() { openTaskModal(null); });
    }
    if (mobileManageBtn) {
        mobileManageBtn.addEventListener('click', function() {
            if (currentUser.role !== 'admin') return;
            renderUsersList();
            usersModal.classList.add('active');
        });
    }
    if (mobileSettingsBtn) {
        mobileSettingsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            mobileSettingsDropdown.classList.toggle('active');
        });
    }
    if (mobileExportBtn) {
        mobileExportBtn.addEventListener('click', function() {
            mobileSettingsDropdown.classList.remove('active');
            exportBtn.click();
        });
    }
    if (mobileImportBtn) {
        mobileImportBtn.addEventListener('click', function() {
            mobileSettingsDropdown.classList.remove('active');
            importBtn.click();
        });
    }
    document.addEventListener('click', function() {
        if (mobileSettingsDropdown) mobileSettingsDropdown.classList.remove('active');
    });

    // ---------- Экспорт Excel ----------
    exportBtn.addEventListener('click', function() {
        if (typeof XLSX === 'undefined') {
            alert('Библиотека XLSX не загружена. Проверьте интернет-соединение.');
            return;
        }
        var dataToExport = tasks.map(function(t) {
            return {
                'ID': t.id,
                'Заголовок': t.title,
                'Описание': t.description || '',
                'Статус': t.status === 'urgent' ? 'Срочно' : (t.status === 'in_progress' ? 'В работе' : 'Выполнено'),
                'Создал': t.createdBy || '',
                'Исполнитель': t.assignedTo || '',
                'Приоритет': t.priority || 'medium',
                'Срок': t.dueDate || '',
                'Создано': t.createdAt ? new Date(t.createdAt).toLocaleString() : '',
                'Обновлено': t.updatedAt ? new Date(t.updatedAt).toLocaleString() : ''
            };
        });
        if (dataToExport.length === 0) {
            alert('Нет задач для экспорта');
            return;
        }
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [
            {wch:12}, {wch:25}, {wch:30}, {wch:15}, {wch:12},
            {wch:12}, {wch:10}, {wch:12}, {wch:25}, {wch:20}
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Задачи');
        XLSX.writeFile(wb, 'Задачи_' + new Date().toISOString().slice(0,10) + '.xlsx');
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
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            try {
                var data = new Uint8Array(ev.target.result);
                var workbook = XLSX.read(data, { type: 'array' });
                var sheet = workbook.Sheets[workbook.SheetNames[0]];
                var rows = XLSX.utils.sheet_to_json(sheet);
                var added = 0;
                rows.forEach(function(row) {
                    var id = row['ID'] || generateId();
                    var existing = tasks.find(function(t) { return t.id === id; });
                    if (existing) {
                        var updated = Object.assign({}, existing, {
                            title: row['Заголовок'] || existing.title,
                            description: row['Описание'] || existing.description,
                            status: row['Статус'] === 'Срочно' ? 'urgent' : (row['Статус'] === 'В работе' ? 'in_progress' : 'done'),
                            assignedTo: row['Исполнитель'] || existing.assignedTo,
                            priority: row['Приоритет'] || existing.priority,
                            dueDate: row['Срок'] || existing.dueDate,
                            updatedAt: new Date().toISOString()
                        });
                        saveTask(updated);
                    } else {
                        var newTask = {
                            id: id,
                            title: row['Заголовок'] || 'Без названия',
                            description: row['Описание'] || '',
                            status: row['Статус'] === 'Срочно' ? 'urgent' : (row['Статус'] === 'В работе' ? 'in_progress' : 'done'),
                            createdBy: row['Создал'] || currentUser.login,
                            assignedTo: row['Исполнитель'] || '',
                            priority: row['Приоритет'] || 'medium',
                            dueDate: row['Срок'] || '',
                            createdAt: row['Создано'] ? new Date(row['Создано']).toISOString() : new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        saveTask(newTask);
                        added++;
                    }
                });
                alert('Импорт завершён. Добавлено ' + added + ' новых задач.');
            } catch(err) {
                alert('Ошибка при импорте: ' + err.message);
            }
            fileInput.value = '';
        };
        reader.readAsArrayBuffer(file);
    });

    // ---------- Вспомогательные функции ----------
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ---------- Запуск ----------
    // Ждём загрузки Firebase SDK
    function waitForFirebase(callback) {
        if (typeof firebase !== 'undefined' && firebase.database) {
            callback();
        } else {
            setTimeout(function() { waitForFirebase(callback); }, 50);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            waitForFirebase(function() {
                firebase.initializeApp(FIREBASE_CONFIG);
                init();
            });
        });
    } else {
        waitForFirebase(function() {
            firebase.initializeApp(FIREBASE_CONFIG);
            init();
        });
    }

})();
