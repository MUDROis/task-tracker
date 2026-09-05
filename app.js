// ============================================================
//  Трекер задач — PWA с Firebase Realtime Database + Auth
//  Данные синхронизируются между всеми устройствами в реальном времени
// ============================================================

(function() {
    'use strict';

    // ---------- Глобальные переменные ----------
    let currentUser = null;
    let tasks = [];
    let reports = [];
    let users = [];
    let firebaseReady = false;
    let db = null;
    let auth = null;
    let knownTaskIds = new Set();
    let initialLoadDone = false;
    var blockedMessage = null;
    let currentItemMode = 'task'; // 'task' | 'report' — режим модалки добавления

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

    // ---------- Бейдж на иконке PWA ----------
    var badgeCount = 0;
    var baseFavicon = null;

    function updateBadge() {
        // Badge API (Chrome, Edge)
        if (navigator.setAppBadge) {
            try {
                if (badgeCount > 0) {
                    navigator.setAppBadge(badgeCount);
                } else {
                    navigator.clearAppBadge();
                }
            } catch (e) {}
        }
        // Canvas-favicon фолбэк
        setFaviconBadge(badgeCount);
    }

    function setFaviconBadge(count) {
        try {
            if (!baseFavicon) {
                baseFavicon = new Image();
                baseFavicon.src = 'logo.png';
            }
            var canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            var ctx = canvas.getContext('2d');
            baseFavicon.onload = function() {
                ctx.drawImage(baseFavicon, 0, 0, 64, 64);
                if (count > 0) {
                    ctx.beginPath();
                    ctx.arc(48, 16, 14, 0, Math.PI * 2);
                    ctx.fillStyle = '#ef4444';
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(count > 99 ? '99+' : String(count), 48, 16);
                }
                setLinkFavicon(canvas.toDataURL());
            };
            if (baseFavicon.complete) {
                ctx.drawImage(baseFavicon, 0, 0, 64, 64);
                if (count > 0) {
                    ctx.beginPath();
                    ctx.arc(48, 16, 14, 0, Math.PI * 2);
                    ctx.fillStyle = '#ef4444';
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(count > 99 ? '99+' : String(count), 48, 16);
                }
                setLinkFavicon(canvas.toDataURL());
            }
        } catch (e) {}
    }

    function setLinkFavicon(dataUrl) {
        var link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = dataUrl;
    }

    function incrementBadge() {
        badgeCount++;
        updateBadge();
    }

    function clearBadge() {
        badgeCount = 0;
        updateBadge();
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
            '</div>' +
            '<button class="toast-close" title="Закрыть">&times;</button>';
        container.appendChild(toast);
        incrementBadge();
        toast.querySelector('.toast-close').addEventListener('click', function() {
            toast.classList.add('toast-exit');
            setTimeout(function() { toast.remove(); }, 300);
            if (badgeCount > 0) badgeCount--;
            updateBadge();
        });
    }

    // ---------- Конфигурация EmailJS ----------
    const EMAILJS_PUBLIC_KEY = 'e1iKZl_RU3ZoaikIL';
    const EMAILJS_SERVICE_ID = 'service_k6yu0eb';
    const EMAILJS_TEMPLATE_ID = 'template_ql5rq3a';

    // ---------- Firebase пути ----------
    function getTasksRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/tasks');
    }
    function getUsersRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/users');
    }
    function getReportsRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/reports');
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
    const taskStatus = document.getElementById('taskStatus');
    const taskDueDate = document.getElementById('taskDueDate');
    const taskAssignee = document.getElementById('taskAssignee');
    const reportModal = document.getElementById('reportModal');
    const reportModalTitle = document.getElementById('reportModalTitle');
    const reportForm = document.getElementById('reportForm');
    const reportId = document.getElementById('reportId');
    const reportTitle = document.getElementById('reportTitle');
    const reportDesc = document.getElementById('reportDesc');
    const reportPriority = document.getElementById('reportPriority');
    const reportDueDate = document.getElementById('reportDueDate');
    const reportAssignee = document.getElementById('reportAssignee');
    const closeModal = document.querySelector('.close-modal');
    const usersModal = document.getElementById('usersModal');
    const usersList = document.getElementById('usersList');
    const addUserForm = document.getElementById('addUserForm');
    const newLogin = document.getElementById('newLogin');
    const newPassword = document.getElementById('newPassword');
    const itemTypeToggle = document.getElementById('itemTypeToggle');
    const taskStatusGroup = document.getElementById('taskStatusGroup');

    // ---------- Color picker interactivity ----------
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

    // ---------- Firebase: загрузка данных ----------
    let listenersInitialized = false;
    function initFirebaseListeners() {
        if (listenersInitialized) return;
        listenersInitialized = true;
        // Слушаем задачи в реальном времени
        getTasksRef().on('value', function(snapshot) {
            var data = snapshot.val();
            var newTasks = data ? Object.values(data) : [];
            newTasks.forEach(function(t) {
                if (t.status === 'delegated') t.status = 'in_progress';
                // Нормализуем срок в ISO-строку (UTC): единый формат для всех
                // браузеров, чтобы new Date(...)/toLocaleDateString не бросали RangeError.
                t.dueDate = DeadlineHelpers.normalizeDueDate(t.dueDate);
            });

            // Обнаружение новых задач
            if (initialLoadDone && currentUser) {
                newTasks.forEach(function(t) {
                    if (!knownTaskIds.has(t.id)) {
                        var assignedToMe = t.assignedTo === currentUser.login;
                        var isMyTask = t.createdBy === currentUser.login;
                        if (assignedToMe && !isMyTask) {
                            playNotificationSound();
                            if (t.delegated) {
                                showToast(t.title, 'Делегировано вам от ' + (t.createdBy || ''), 'delegated');
                            } else {
                                showToast(t.title, 'Назначена вам от ' + (t.createdBy || ''), 'new-task');
                            }
                        }
                    }
                });
            }

            tasks = newTasks;
            knownTaskIds = new Set(tasks.map(function(t) { return t.id; }));
            initialLoadDone = true;
            renderBoard();
            checkOverdueTasks();
        });

        // Слушаем пользователей в реальном времени
        getUsersRef().on('value', function(snapshot) {
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
            // Если текущий пользователь есть в списке — обновляем его данные
            if (currentUser) {
                const fresh = users.find(function(u) { return u.login === currentUser.login; });
                if (fresh) {
                    currentUser = { uid: fresh.uid, login: fresh.login, name: fresh.name || '', role: fresh.role, color: fresh.color, email: fresh.email, emoji: fresh.emoji };
                }
            }
            populateAssigneeSelect();
            if (initialLoadDone) renderBoard();
        });

        // Слушаем отчёты в реальном времени
        getReportsRef().on('value', function(snapshot) {
            var data = snapshot.val();
            reports = data ? Object.values(data) : [];
            reports = reports.map(function(r) {
                return Object.assign({}, r, {
                    status: r.status || 'active',
                    title: r.title || '',
                    description: r.description || '',
                    reportNumber: r.reportNumber || 0,
                    dueDate: DeadlineHelpers.normalizeDueDate(r.dueDate),
                    createdBy: r.createdBy || ''
                });
            });
            if (initialLoadDone) renderBoard();
        });
    }

    // ---------- Автопереход просроченных задач в "Срочно" ----------
    var overdueNotified = new Set();

    function checkOverdueTasks() {
        if (!currentUser) return;
        var now = new Date();
        var updated = false;
        tasks.forEach(function(t) {
            if (!t.dueDate) return;
            var due = new Date(t.dueDate);
            // Просрочена: время вышло и задача в работе
            if (now > due && t.status === 'in_progress') {
                var patched = Object.assign({}, t, {
                    status: 'urgent',
                    updatedAt: now.toISOString()
                });
                saveTask(patched);
                updated = true;
            }
            // Последний день срока: уведомление исполнителю и admin'у (только для невыполненных)
            var dayMs = 24 * 60 * 60 * 1000;
            var diffMs = due.getTime() - now.getTime();
            if (t.status !== 'done' && diffMs > 0 && diffMs <= dayMs && !overdueNotified.has(t.id)) {
                overdueNotified.add(t.id);
                sendDeadlineNotification(t);
            }
        });
    }

    function sendDeadlineNotification(task) {
        var dueD = new Date(task.dueDate);
        var dueStr = isNaN(dueD.getTime())
            ? ''
            : dueD.toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' + dueD.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
        // Уведомление исполнителю
        if (task.assignedTo) {
            var assignee = users.find(function(u) { return u.login === task.assignedTo; });
            if (assignee && assignee.email) {
                sendEmailNotification(task.assignedTo, {
                    title: task.title,
                    description: 'Истекает срок задачи: ' + dueStr,
                    priority: task.priority,
                    dueDate: task.dueDate
                });
            }
            showToast(task.title, 'Истекает срок! До: ' + dueStr, 'new-task');
            playNotificationSound();
        }
        // Уведомление admin'у
        if (currentUser.login !== task.assignedTo) {
            var admin = users.find(function(u) { return u.role === 'admin'; });
            if (admin && admin.email && admin.login !== currentUser.login) {
                sendEmailNotification(admin.login, {
                    title: task.title,
                    description: 'Истекает срок задачи (исполнитель: ' + (task.assignedTo || 'не назначен') + '): ' + dueStr,
                    priority: task.priority,
                    dueDate: task.dueDate
                });
            }
        }
    }

    // Запуск проверки каждую минуту
    setInterval(checkOverdueTasks, 60000);

    // ---------- Обновление индикации дедлайнов по таймеру ----------
    // Раз в минуту пересчитываем цвет левой полосы карточек,
    // чтобы цвет автоматически менялся при наступлении 17:00, полуночи и т.д.
    function refreshDeadlineStrips() {
        if (!currentUser) return;
        document.querySelectorAll('.task-card').forEach(function(card) {
            var task = tasks.find(function(t) { return t.id === card.dataset.id; }) ||
                       reports.find(function(r) { return r.id === card.dataset.id; });
            if (!task) return;
            var newClass = DeadlineHelpers.deadlineStripClassFromDate(task.dueDate);
            var baseClasses = [
                'strip-far','strip-close','strip-soon','strip-day',
                'strip-red','strip-overdue','strip-none'
            ];
            baseClasses.forEach(function(c) { card.classList.remove(c); });
            card.classList.add(newClass);
            if (task.dueDate) {
                card.setAttribute('aria-label', (task.title || 'Отчёт') + '. ' + deadlineStatusLabel(task.dueDate));
            }
        });
    }

    setInterval(refreshDeadlineStrips, 60000);
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) refreshDeadlineStrips();
    });

    // Очистка бейджа при клике на страницу
    document.addEventListener('click', function() {
        if (badgeCount > 0) clearBadge();
    });

    // ---------- Firebase: запись данных ----------
    function saveTask(task) {
        task.dueDate = DeadlineHelpers.normalizeDueDate(task.dueDate);
        return getTasksRef().child(task.id).set(task)
            .then(function() {
                console.log('Задача сохранена успешно:', task.id);
                return task;
            })
            .catch(function(error) {
                console.error('Ошибка сохранения задачи:', error);
                alert('Ошибка сохранения задачи: ' + error.message);
                throw error;
            });
    }

    function removeTask(taskId) {
        getTasksRef().child(taskId).remove();
    }

    function saveReport(report) {
        report.dueDate = DeadlineHelpers.normalizeDueDate(report.dueDate);
        return getReportsRef().child(report.id).set(report)
            .then(function() {
                console.log('Отчёт сохранён:', report.id);
                return report;
            })
            .catch(function(error) {
                console.error('Ошибка сохранения отчёта:', error);
                alert('Ошибка сохранения отчёта: ' + error.message);
                throw error;
            });
    }

    function removeReport(reportId) {
        getReportsRef().child(reportId).remove();
    }

    function changeReportStatus(id, newStatus) {
        var report = reports.find(function(r) { return r.id === id; });
        if (!report) return;
        var updated = Object.assign({}, report, {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
        if (newStatus === 'done') {
            updated.completedAt = new Date().toISOString();
            updated.completedLate = DeadlineHelpers.isCompletedLate(updated.completedAt, report.dueDate);
        }
        saveReport(updated);
    }

    function saveUser(user) {
        return getUsersRef().child(user.login).set(user);
    }

    function removeUser(login) {
        getUsersRef().child(login).remove();
    }

    // ---------- Автосоздание admin-пользователя ----------
    function ensureAdminUser() {
        console.log('ensureAdminUser: попытка создания admin...');
        auth.createUserWithEmailAndPassword('admin@tasktracker.local', 'admin123')
            .then(function(userCredential) {
                const uid = userCredential.user.uid;
                console.log('ensureAdminUser: admin создан в Auth, uid=' + uid + ', записываю в DB...');
                return getUsersRef().child('admin').set({
                    uid: uid,
                    login: 'admin',
                    name: 'Харитон',
                    role: 'admin',
                    color: '#3b82f6',
                    email: ''
                });
            })
            .then(function() {
                console.log('ensureAdminUser: admin записан в DB. Войдите: admin / admin123');
            })
            .catch(function(error) {
                if (error.code === 'auth/email-already-in-use') {
                    console.log('ensureAdminUser: admin уже существует, пропускаю');
                } else {
                    console.log('ensureAdminUser: ошибка —', error.code, error.message);
                }
            });
    }

    // ---------- Инициализация ----------
    function init() {
        console.log('Инициализация приложения...');

        // Инициализация Firebase Auth
        auth = firebase.auth();
        
        // Слушаем состояние авторизации
        auth.onAuthStateChanged(function(user) {
            if (user) {
                const login = user.email.replace('@tasktracker.local', '');
                getUsersRef().child(login).once('value').then(function(snapshot) {
                    const userData = snapshot.val();
                    if (userData) {
                        currentUser = {
                            uid: user.uid,
                            login: userData.login,
                            name: userData.name || '',
                            role: userData.role,
                            color: userData.color,
                            email: userData.email,
                            emoji: userData.emoji || ''
                        };
                        // Первичная миграция существующей записи admin: добавляем имя
                        if (login === 'admin' && !userData.name) {
                            currentUser.name = 'Харитон';
                            saveUser(currentUser);
                        }
                        saveSession(currentUser);
                        showMainPage();
                        initFirebaseListeners();
                    } else if (login === 'admin') {
                        // Первый вход admin — создаём запись в БД
                        currentUser = {
                            uid: user.uid,
                            login: login,
                            name: 'Харитон',
                            role: 'admin',
                            color: '#3b82f6',
                            email: '',
                            emoji: ''
                        };
                        saveUser(currentUser);
                        saveSession(currentUser);
                        showMainPage();
                        initFirebaseListeners();
                    } else {
                        // Записи нет в БД — аккаунт удалён администратором
                        blockedMessage = 'Ваш аккаунт удалён администратором';
                        auth.signOut();
                    }
                });
            } else {
                currentUser = null;
                showLoginPage();
                if (blockedMessage) {
                    loginError.textContent = blockedMessage;
                    blockedMessage = null;
                }
            }
        });

        // Создаём admin если его нет
        ensureAdminUser();

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
        updateHeaderGreeting(currentUser);
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

        const email = login + '@tasktracker.local';
        console.log('Вход: email=' + email);
        auth.signInWithEmailAndPassword(email, password)
            .then(function(userCredential) {
                console.log('Вход успешен, uid=' + userCredential.user.uid);
                return getUsersRef().child(login).once('value');
            })
            .then(function(snapshot) {
                const userData = snapshot.val();
                console.log('Данные из DB:', userData);
                if (userData) {
                    currentUser = {
                        uid: userData.uid,
                        login: userData.login,
                        name: userData.name || '',
                        role: userData.role,
                        color: userData.color,
                        email: userData.email,
                        emoji: userData.emoji || ''
                    };
                    saveSession(currentUser);
                    showMainPage();
                }
                // Записи нет в БД — создание записи для admin и блокировка удалённых
                // обрабатываются в onAuthStateChanged (единый источник истины).
                // initFirebaseListeners уже вызывается в onAuthStateChanged
            })
            .catch(function(error) {
                console.error('Ошибка:', error.code, error.message);
                if (error.code === 'auth/user-not-found') {
                    loginError.textContent = 'Пользователь не найден';
                } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    loginError.textContent = 'Неверный пароль';
                } else if (error.code === 'auth/too-many-requests') {
                    loginError.textContent = 'Слишком много попыток. Попробуйте позже';
                } else {
                    loginError.textContent = 'Ошибка: ' + error.message;
                }
            });
    });

    logoutBtn.addEventListener('click', function() {
        // Выход из Firebase Auth
        auth.signOut().then(function() {
            // Отключаем listeners
            getTasksRef().off();
            getUsersRef().off();
            getReportsRef().off();
            clearSession();
            currentUser = null;
            reports = [];
            knownTaskIds = new Set();
            initialLoadDone = false;
            listenersInitialized = false;
            showLoginPage();
        }).catch(function(error) {
            console.error('Ошибка выхода:', error);
        });
    });

    // ---------- Управление пользователями ----------
    function openManagePanel(x, y) {
        console.log('openManagePanel: currentUser =', currentUser);
        if (!currentUser || currentUser.role !== 'admin') {
            console.log('openManagePanel: нет доступа, role =', currentUser && currentUser.role);
            return;
        }
        getUsersRef().once('value').then(function(snapshot) {
            const data = snapshot.val();
            users = data ? Object.values(data) : [];
            users = users.map(function(u) {
                return Object.assign({}, u, {
                    role: u.role || 'employee',
                    color: u.color || DEFAULT_COLORS[0],
                    email: u.email || '',
                    emoji: u.emoji || ''
                });
            });
            renderUsersList();
            usersModal.classList.add('active');
            positionModalAtPoint(usersModal, x, y);
        }).catch(function(err) {
            console.error('Ошибка загрузки пользователей:', err);
            alert('Не удалось загрузить список пользователей');
        });
    }

    console.log('manageUsersBtn =', manageUsersBtn);
    manageUsersBtn.addEventListener('click', function(e) {
        openManagePanel(e.clientX, e.clientY);
    });

    var archiveTab = 'tasks';
    var archiveModal = document.getElementById('archiveModal');

    function openArchive(x, y) {
        if (!archiveModal) return;
        archiveTab = 'tasks';
        var search = document.getElementById('archiveSearch');
        if (search) search.value = '';
        archiveModal.querySelectorAll('.archive-tab').forEach(function(t) {
            t.classList.toggle('active', t.dataset.tab === 'tasks');
        });
        archiveModal.classList.add('active');
        if (positionModalAtPoint) positionModalAtPoint(archiveModal, x, y);
        renderArchive();
    }

    function renderArchive() {
        var list = document.getElementById('archiveList');
        if (!list) return;
        var search = (document.getElementById('archiveSearch').value || '').trim().toLowerCase();
        list.innerHTML = '';
        if (archiveTab === 'tasks') {
            var archivedTasks = tasks.filter(function(t) {
                if (t.status !== 'done') return false;
                if (currentUser.role === 'admin') return true;
                return t.createdBy === currentUser.login || t.assignedTo === currentUser.login;
            });
            if (search) {
                archivedTasks = archivedTasks.filter(function(t) {
                    return (t.title || '').toLowerCase().indexOf(search) !== -1;
                });
            }
            if (archivedTasks.length === 0) {
                list.innerHTML = '<p class="archive-empty">Нет архивированных задач</p>';
                return;
            }
            archivedTasks.forEach(function(t) {
                list.appendChild(createArchiveTaskRow(t));
            });
        } else {
            var archivedReports = reports.filter(function(r) {
                if (r.status !== 'done') return false;
                if (currentUser.role === 'admin') return true;
                return r.createdBy === currentUser.login || r.assignedTo === currentUser.login;
            });
            if (search) {
                archivedReports = archivedReports.filter(function(r) {
                    var numberLabel = r.reportNumber
                        ? '№' + r.reportNumber
                        : '';
                    var hay = (r.title || '').toLowerCase() + ' ' + numberLabel.toLowerCase();
                    return hay.indexOf(search) !== -1;
                });
            }
            if (archivedReports.length === 0) {
                list.innerHTML = '<p class="archive-empty">Нет архивированных отчётов</p>';
                return;
            }
            archivedReports.forEach(function(r) {
                list.appendChild(createArchiveReportRow(r));
            });
        }
    }

    function createArchiveTaskRow(task) {
        var div = document.createElement('div');
        div.className = 'archive-row archive-row-done ' + DeadlineHelpers.doneStripClass(task.completedAt, task.dueDate, task.completedLate);
        div.innerHTML =
            '<div class="archive-row-main">' +
                '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
                '<div class="task-meta">' +
                    (task.dueDate ? '<span><i class="fa-regular fa-calendar"></i> ' + formatDateTime(task.dueDate) + '</span>' : '') +
                    '<span>👤 ' + escapeHtml(formatUserName(task.assignedTo)) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="archive-row-actions">' +
                '<button class="btn-archived" data-action="open" title="Открыть"><i class="fa-solid fa-circle-info"></i> Открыть</button>' +
                '<button class="btn-archived" data-action="restore" title="Вернуть на доску"><i class="fa-solid fa-rotate-left"></i> Вернуть</button>' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-archived" data-action="delete" title="Удалить"><i class="fa-solid fa-trash"></i> Удалить</button>'
                    : '') +
            '</div>';
        div.querySelectorAll('[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                var action = this.dataset.action;
                var x = e.clientX;
                var y = e.clientY;
                if (action === 'open') {
                    showTaskDetails(task, x, y);
                } else if (action === 'restore') {
                    changeStatus(task.id, task.previousStatus || 'in_progress');
                } else if (action === 'delete') {
                    if (confirm('Удалить задачу?')) {
                        removeTask(task.id);
                    }
                }
            });
        });
        return div;
    }

    function createArchiveReportRow(report) {
        var numberLabel = report.reportNumber
            ? '№' + report.reportNumber
            : 'Отчёт';
        var assigneeLabel = report.assignedTo ? '👤 ' + escapeHtml(formatUserName(report.assignedTo)) : '';
        var div = document.createElement('div');
        div.className = 'archive-row archive-row-done ' + DeadlineHelpers.doneStripClass(report.completedAt, report.dueDate, report.completedLate);
        div.innerHTML =
            '<div class="archive-row-main">' +
                '<div class="task-title">' + escapeHtml(report.title) + '</div>' +
                '<div class="task-meta">' +
                    '<span>📄 ' + escapeHtml(numberLabel) + '</span>' +
                    (report.dueDate ? '<span><i class="fa-regular fa-calendar"></i> ' + formatDateTime(report.dueDate) + '</span>' : '') +
                    (assigneeLabel ? '<span>' + assigneeLabel + '</span>' : '') +
                '</div>' +
            '</div>' +
            '<div class="archive-row-actions">' +
                '<button class="btn-archived" data-action="open" title="Открыть"><i class="fa-solid fa-circle-info"></i> Открыть</button>' +
                '<button class="btn-archived" data-action="restore" title="Вернуть на доску"><i class="fa-solid fa-rotate-left"></i> Вернуть</button>' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-archived" data-action="delete" title="Удалить"><i class="fa-solid fa-trash"></i> Удалить</button>'
                    : '') +
            '</div>';
        div.querySelectorAll('[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                var action = this.dataset.action;
                var x = e.clientX;
                var y = e.clientY;
                if (action === 'open') {
                    showReportDetails(report, x, y);
                } else if (action === 'restore') {
                    changeReportStatus(report.id, 'active');
                } else if (action === 'delete') {
                    if (confirm('Удалить отчёт?')) {
                        removeReport(report.id);
                    }
                }
            });
        });
        return div;
    }

    var archiveBtn = document.getElementById('archiveBtn');
    if (archiveBtn) {
        archiveBtn.addEventListener('click', function(e) {
            openArchive(e.clientX, e.clientY);
        });
    }
    var mobileArchiveBtn = document.getElementById('mobileArchiveBtn');
    if (mobileArchiveBtn) {
        mobileArchiveBtn.addEventListener('click', function(e) {
            openArchive(e.clientX, e.clientY);
        });
    }

    if (archiveModal) {
        archiveModal.querySelectorAll('.archive-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                archiveTab = this.dataset.tab;
                archiveModal.querySelectorAll('.archive-tab').forEach(function(t) {
                    t.classList.toggle('active', t === tab);
                });
                renderArchive();
            });
        });
        var archiveSearch = document.getElementById('archiveSearch');
        if (archiveSearch) {
            archiveSearch.addEventListener('input', renderArchive);
        }
        var archiveExportBtn = document.getElementById('archiveExportBtn');
        if (archiveExportBtn) {
            archiveExportBtn.addEventListener('click', exportArchiveExcel);
        }
        var archiveClose = archiveModal.querySelector('.close-modal');
        if (archiveClose) {
            archiveClose.addEventListener('click', function() {
                archiveModal.classList.remove('active');
            });
        }
    }

    function exportArchiveExcel() {
        if (typeof XLSX === 'undefined') {
            alert('Библиотека XLSX не загружена. Проверьте интернет-соединение.');
            return;
        }
        var rows = [];
        var archivedTasks = tasks.filter(function(t) {
            if (t.status !== 'done') return false;
            if (currentUser.role === 'admin') return true;
            return t.createdBy === currentUser.login || t.assignedTo === currentUser.login;
        });
        archivedTasks.forEach(function(t) {
            rows.push({
                'Тип': 'Задача',
                'Заголовок': t.title,
                'Описание': t.description || '',
                'Срок': t.dueDate ? formatDateTime(t.dueDate) : '',
                'Создал': formatUserName(t.createdBy),
                'Исполнитель': formatUserName(t.assignedTo)
            });
        });
        var archivedReports = reports.filter(function(r) {
            if (r.status !== 'done') return false;
            if (currentUser.role === 'admin') return true;
            return r.createdBy === currentUser.login || r.assignedTo === currentUser.login;
        });
        archivedReports.forEach(function(r) {
            rows.push({
                'Тип': 'Отчёт',
                'Заголовок': r.title,
                'Описание': r.description || '',
                'Срок': r.dueDate ? formatDateTime(r.dueDate) : '',
                'Создал': formatUserName(r.createdBy),
                'Исполнитель': r.assignedTo ? formatUserName(r.assignedTo) : ''
            });
        });
        if (rows.length === 0) {
            alert('Нет элементов в архиве для выгрузки');
            return;
        }
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{wch:8},{wch:30},{wch:40},{wch:15},{wch:12},{wch:15}];
        XLSX.utils.book_append_sheet(wb, ws, 'Архив');
        XLSX.writeFile(wb, 'Архив_' + new Date().toISOString().slice(0,10) + '.xlsx');
    }

    function renderUsersList() {
        usersList.innerHTML = users.map(function(u) {
            var isAdmin = u.login === 'admin';
            return '<div class="user-row" data-user="' + escapeHtml(u.login) + '">' +
                '<div class="user-row-view">' +
                    '<span class="user-emoji-avatar">' + (u.emoji || '👤') + '</span>' +
                    '<span><strong>' + escapeHtml(u.name || u.login) + '</strong> (' + (u.role === 'admin' ? 'Руководитель' : 'Сотрудник') + ')' + (u.email ? ' · ' + escapeHtml(u.email) : '') + '</span>' +
                    '<div class="user-row-actions">' +
                        '<button class="btn outline btn-edit-user" data-login="' + escapeHtml(u.login) + '" style="padding:0.2rem 0.6rem;font-size:0.8rem;">Изменить</button>' +
                        (u.login !== 'admin' && u.login !== currentUser.login
                            ? '<button class="btn outline btn-delete-user" data-login="' + escapeHtml(u.login) + '" style="padding:0.2rem 0.6rem;font-size:0.8rem;color:var(--danger);">Удалить</button>'
                            : '') +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        usersList.querySelectorAll('.btn-edit-user').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                openEditUserModal(this.dataset.login, e.clientX, e.clientY);
            });
        });

        usersList.querySelectorAll('.btn-delete-user').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                deleteUser(this.dataset.login);
            });
        });
    }

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
        users = users.filter(function(u) { return u.login !== login; });
        renderUsersList();
    }

    function openEditUserModal(login, x, y) {
        const user = users.find(function(u) { return u.login === login; });
        if (!user) return;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:400px;">' +
                '<span class="close-modal" onclick="this.closest(\'.modal\').remove()">&times;</span>' +
                '<h3>Редактировать: ' + escapeHtml(user.login) + '</h3>' +
                '<form id="editUserForm">' +
                    '<div class="form-group">' +
                        '<label for="editLogin">Логин</label>' +
                        '<input type="text" id="editLogin" value="' + escapeHtml(user.login) + '" required>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label for="editRole">Роль</label>' +
                        '<select id="editRole">' +
                            '<option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>Руководитель</option>' +
                            '<option value="employee"' + (user.role !== 'admin' ? ' selected' : '') + '>Сотрудник</option>' +
                        '</select>' +
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
                        '<label>Аватар (эмодзи)</label>' +
                        '<div class="emoji-picker-row">' +
                            '<span class="emoji-preview" id="editEmojiPreview">' + (user.emoji || '👤') + '</span>' +
                            '<input type="text" id="editEmoji" value="' + escapeHtml(user.emoji || '') + '" placeholder="👤" maxlength="4" style="width:60px;text-align:center;">' +
                            '<div class="emoji-presets">' +
                                ['👤','👨','👩','🧑','👨‍💼','👩‍💼','🧑‍💼','👨‍💻','👩‍💻','🧑‍💻','👨‍🔧','👩‍🔧','🧑‍🔧','👨‍🏫','👩‍🏫','🧑‍🏫','🦸','🦸‍♀️','🧙','🧙‍♀️','🦊','🐱','🐶','🦁','🐸','🐼'].map(function(e) {
                                    return '<button type="button" class="emoji-preset-btn" data-emoji="' + e + '">' + e + '</button>';
                                }).join('') +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<button type="submit" class="btn primary">Сохранить</button>' +
                '</form>' +
            '</div>';
        document.body.appendChild(modal);
        positionModalAtPoint(modal, x, y);

        // Emoji picker
        const emojiInput = modal.querySelector('#editEmoji');
        const emojiPreview = modal.querySelector('#editEmojiPreview');
        emojiInput.addEventListener('input', function() {
            emojiPreview.textContent = this.value || '👤';
        });
        modal.querySelectorAll('.emoji-preset-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                emojiInput.value = this.dataset.emoji;
                emojiPreview.textContent = this.dataset.emoji;
            });
        });

        modal.querySelector('#editUserForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const newLoginVal = modal.querySelector('#editLogin').value.trim();
            const newPasswordVal = modal.querySelector('#editPassword').value;
            const newRole = modal.querySelector('#editRole').value;
            const newEmail = modal.querySelector('#editEmail').value.trim();
            const newEmoji = modal.querySelector('#editEmoji').value || '';

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
                role: newRole,
                email: newEmail,
                emoji: newEmoji
            });

            // Обновляем данные пользователя в Realtime Database
            saveUser(updatedUser);
            
            // Если изменился пароль, обновляем через Firebase Auth
            if (newPasswordVal && user.uid) {
                // Примечание: изменение пароля другого пользователя требует Admin SDK
                // В клиентском приложении это ограничение Firebase
                alert('Для изменения пароля пользователю ' + newLoginVal + ' используйте Firebase Console');
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
            modal.remove();
            renderUsersList();
        });

        modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
    }

    addUserForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const login = newLogin.value.trim();
        const password = newPassword.value.trim();
        const email = document.getElementById('newUserEmail').value.trim();
        if (!login || !password) return;
        if (users.find(function(u) { return u.login === login; })) {
            alert('Пользователь с таким логином уже существует');
            return;
        }
        const submitBtn = addUserForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        // Создаем пользователя в Firebase Auth — всегда login@tasktracker.local
        const authEmail = login + '@tasktracker.local';
        auth.createUserWithEmailAndPassword(authEmail, password)
            .then(function(userCredential) {
                const uid = userCredential.user.uid;
                // Сохраняем данные пользователя в Realtime Database
                return saveUser({
                    uid: uid,
                    login: login,
                    role: 'employee',
                    color: '#3b82f6',
                    email: email,
                    emoji: ''
                });
            })
            .then(function() {
                newLogin.value = '';
                newPassword.value = '';
                document.getElementById('newUserEmail').value = '';
                alert('Пользователь ' + login + ' успешно создан');
            })
            .catch(function(error) {
                console.error('Ошибка создания пользователя:', error);
                if (error.code === 'auth/email-already-in-use') {
                    alert('Пользователь с таким email уже существует');
                } else {
                    alert('Ошибка создания пользователя: ' + error.message);
                }
            })
            .finally(function() {
                if (submitBtn) submitBtn.disabled = false;
            });
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

            // Если задача имеет высокий приоритет, автоматически ставим её в 'urgent'
            userTasks.forEach(function(t) {
                if (t.priority === 'high' && t.status !== 'urgent' && t.status !== 'done') {
                    t.status = 'urgent';
                }
            });

            const columns = ['urgent', 'in_progress'];
            columns.forEach(function(status) {
                const list = document.getElementById('list_' + status);
                const countEl = document.getElementById('count_' + status);
                if (!list || !countEl) return;
                const filtered = userTasks.filter(function(t) { return t.status === status; });
                filtered.sort(sortByDueDate);
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
            renderReports();
            populateAssigneeSelect();
            updateStatsRing();
        } catch (e) {
            console.error('Ошибка при рендеринге доски:', e);
        }
    }

    // ---------- Кольцо статистики (% выполненных) ----------
    function updateStatsRing() {
        var ringEl = document.getElementById('statsRing');
        var pctEl = document.getElementById('ringPct');
        if (!ringEl || !pctEl || !currentUser) return;
        var stats = DeadlineHelpers.statsSummary(tasks, reports, currentUser.login, currentUser.role === 'admin');
        ringEl.style.setProperty('--p', stats.pct);
        pctEl.textContent = stats.pct + '%';
    }

    // ---------- Полная карточка и мобильные тапы ----------
    var TOUCH_TAP_MS = 300;
    var isTouchDevice = window.matchMedia && window.matchMedia('(hover: none)').matches;

    function canEditItem(item) {
        return currentUser.role === 'admin' || item.createdBy === currentUser.login;
    }

    function openFullTask(task, x, y) {
        if (canEditItem(task)) openTaskModal(task, x, y);
        else showTaskDetails(task, x, y);
    }

    function openFullReport(report, x, y) {
        if (canEditItem(report)) openReportModal(report, x, y);
        else showReportDetails(report, x, y);
    }

    function attachMobileTapHandlers(cardEl, openFullFn) {
        if (!isTouchDevice) return;
        var lastTapTime = 0;
        var singleTapTimer = null;
        cardEl.addEventListener('click', function(e) {
            if (e.target.closest('[data-action]')) return;
            var now = Date.now();
            if (now - lastTapTime < TOUCH_TAP_MS) {
                if (singleTapTimer) { clearTimeout(singleTapTimer); singleTapTimer = null; }
                lastTapTime = 0;
                openFullFn(e.clientX, e.clientY);
                return;
            }
            lastTapTime = now;
            if (singleTapTimer) clearTimeout(singleTapTimer);
            document.querySelectorAll('.task-card.controls-open').forEach(function(el) {
                if (el !== cardEl) el.classList.remove('controls-open');
            });
            singleTapTimer = setTimeout(function() {
                cardEl.classList.toggle('controls-open');
                singleTapTimer = null;
            }, TOUCH_TAP_MS);
        });
    }

    function deadlineStatusLabel(dueDateStr) {
        // Человекочитаемая подпись статуса дедлайна для доступности (aria-label)
        var status = DeadlineHelpers.getDeadlineStatus(dueDateStr);
        var labels = {
            'far': 'Срок далеко (более 4 дней)',
            'close': 'Срок приближается (2 дня)',
            'soon': 'Срок завтра (1 день)',
            'day': 'Срок сегодня (до 12:00)',
            'oday': 'Срок сегодня, просрочено (после 17:00)',
            'odays': 'Срок просрочен (более 1 дня)',
            'none': 'Срок не задан'
        };
        return labels[status] || 'Срок не задан';
    }
    function deadlineStatusLabelShort(dueDateStr) {
        // Короткая подпись для иконки/метки на карточке
        var status = DeadlineHelpers.getDeadlineStatus(dueDateStr);
        var labels = {
            'far': 'Срок: далеко',
            'close': 'Срок: 2 дня',
            'soon': 'Срок: завтра',
            'day': 'Срок сегодня',
            'oday': 'Просрочено сегодня',
            'odays': 'Просрочено давно',
            'none': ''
        };
        return labels[status] || '';
    }

    function createTaskCard(task) {
        const div = document.createElement('div');
        var stripClass = DeadlineHelpers.deadlineStripClassFromDate(task.dueDate);
        div.className = 'task-card priority-' + (task.priority || 'medium') + ' ' + stripClass;
        div.draggable = true;
        div.dataset.id = task.id;
        if (task.dueDate) {
            div.setAttribute('role', 'listitem');
            div.setAttribute('aria-label', (task.title || 'Задача') + '. ' + deadlineStatusLabel(task.dueDate));
        }

        const assigneeUser = task.assignedTo ? users.find(function(u) { return u.login === task.assignedTo; }) : null;
        const assigneeName = task.assignedTo ? formatUserName(task.assignedTo) : 'не назначен';
        const assigneeEmoji = assigneeUser ? (assigneeUser.emoji || '👤') : '👤';

        div.innerHTML =
            (task.delegated
                ? '<span class="task-delegate-arrow ' + (task.assignedTo === currentUser.login ? 'arrow-received' : 'arrow-delegated') + '">' + (task.assignedTo === currentUser.login ? '↙' : '↗') + '</span>'
                : '') +
            '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
            '<div class="task-meta">' +
                '<span>' + assigneeEmoji + ' ' + escapeHtml(assigneeName) + '</span>' +
                (task.dueDate ? '<span><i class="fa-regular fa-calendar"></i> ' + formatDateTime(task.dueDate) + '</span>' : '') +
            '</div>' +
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

        div.querySelectorAll('[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var action = this.dataset.action;
                var x = e.clientX;
                var y = e.clientY;
                if (action === 'delete') {
                    if (confirm('Удалить задачу?')) {
                        removeTask(task.id);
                    }
                } else if (action === 'done') {
                    changeStatus(task.id, 'done');
                } else if (action === 'restore') {
                    changeStatus(task.id, task.previousStatus || 'in_progress');
                } else if (action === 'delegate') {
                    showDelegateModal(task, saveTask, 'задачу', x, y);
                } else if (action === 'open') {
                    showTaskDetails(task, x, y);
                } else if (action === 'settings') {
                    if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
                        alert('Вы не можете редактировать эту задачу');
                        return;
                    }
                    openTaskModal(task, x, y);
                }
            });
        });

        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragend', handleDragEnd);

        div.addEventListener('dblclick', function(e) {
            e.preventDefault();
            openFullTask(task, e.clientX, e.clientY);
        });

        attachMobileTapHandlers(div, function(x, y) { openFullTask(task, x, y); });

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

    ['list_urgent', 'list_in_progress'].forEach(function(listId) {
        var list = document.getElementById(listId);
        if (!list) return;
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
            status: taskData.status || 'in_progress',
            previousStatus: '',
            delegated: false,
            delegatedBy: '',
            createdBy: currentUser.login,
            assignedTo: taskData.assignee || '',
            priority: taskData.priority || 'medium',
            dueDate: DeadlineHelpers.normalizeDueDate(taskData.dueDate),
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
            updated.completedAt = new Date().toISOString();
            updated.completedLate = DeadlineHelpers.isCompletedLate(updated.completedAt, task.dueDate);
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

    // ---------- Показ деталей задачи ----------
    function showTaskDetails(task, x, y) {
        var assigneeUser = task.assignedTo ? users.find(function(u) { return u.login === task.assignedTo; }) : null;
        var assigneeName = task.assignedTo ? formatUserName(task.assignedTo) : 'не назначен';
        var assigneeEmoji = assigneeUser ? (assigneeUser.emoji || '👤') : '👤';
        var priorityLabels = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
        var statusLabels = { urgent: 'Срочно', in_progress: 'В работе', done: 'Выполнено' };
        var modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:450px;">' +
                '<span class="close-modal" onclick="this.closest(\'.modal\').remove()">&times;</span>' +
                '<h3>' + escapeHtml(task.title) + '</h3>' +
                '<div style="margin-top:1rem;font-size:0.95rem;color:var(--muted);">' +
                    '<p><strong>Описание:</strong> ' + (task.description ? escapeHtml(task.description) : '<em>нет</em>') + '</p>' +
                    '<p><strong>Статус:</strong> ' + (statusLabels[task.status] || task.status) + '</p>' +
                    '<p><strong>Приоритет:</strong> ' + (priorityLabels[task.priority] || task.priority) + '</p>' +
                    '<p><strong>Исполнитель:</strong> ' + assigneeEmoji + ' ' + escapeHtml(assigneeName) + '</p>' +
                    '<p><strong>Создал:</strong> ' + escapeHtml(formatUserName(task.createdBy)) + '</p>' +
                    '<p><strong>Создано:</strong> ' + formatDateTime(task.createdAt) + '</p>' +
                    (task.dueDate ? '<p><strong>Срок:</strong> ' + formatDateTime(task.dueDate) + '</p>' : '') +
                    (task.delegated ? '<p><strong>Делегировано:</strong> ' + (task.delegatedBy === 'admin' ? 'Руководителем' : 'Сотрудником') + '</p>' : '') +
                    (task.updatedAt ? '<p><strong>Обновлено:</strong> ' + formatDateTime(task.updatedAt) + '</p>' : '') +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        positionModalAtPoint(modal, x, y);
        modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    }

    function showReportDetails(report, x, y) {
        var numberLabel = report.reportNumber
            ? '№' + report.reportNumber
            : 'Отчёт';
        var modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:450px;">' +
                '<span class="close-modal">&times;</span>' +
                '<h3>' + escapeHtml(report.title) + '</h3>' +
                '<div style="margin-top:1rem;font-size:0.95rem;color:var(--muted);">' +
                    '<p><strong>Номер:</strong> ' + escapeHtml(numberLabel) + '</p>' +
                    '<p><strong>Описание:</strong> ' + (report.description ? escapeHtml(report.description) : '<em>нет</em>') + '</p>' +
                    '<p><strong>Приоритет:</strong> ' + escapeHtml(PRIORITY_LABELS[report.priority] || 'Средний') + '</p>' +
                    (report.dueDate ? '<p><strong>Срок сдачи:</strong> ' + formatDateTime(report.dueDate) + '</p>' : '') +
                    '<p><strong>Исполнитель:</strong> ' + (report.assignedTo ? escapeHtml(formatUserName(report.assignedTo)) : '<em>не назначен</em>') + '</p>' +
                    (report.delegated ? '<p><strong>Делегировано:</strong> ' + (report.delegatedBy === 'admin' ? 'Руководителем' : 'Сотрудником') + '</p>' : '') +
                    '<p><strong>Автор:</strong> ' + escapeHtml(formatUserName(report.createdBy)) + '</p>' +
                    '<p><strong>Создан:</strong> ' + formatDateTime(report.createdAt) + '</p>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        if (positionModalAtPoint) positionModalAtPoint(modal, x, y);
        modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    }

    // ---------- Делегирование ----------
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
                '<h3>Делегировать ' + escapeHtml(kind) + '</h3>' +
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

    // ---------- Уведомления по почте ----------
    var PRIORITY_LABELS = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };

    function sendEmailNotification(toLogin, taskData) {
        if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) return;
        if (typeof emailjs === 'undefined') return;
        var user = users.find(function(u) { return u.login === toLogin; });
        var toEmail = user && user.email ? user.email : '';
        if (!toEmail) return;
        var dueDateStr = 'не указан';
        if (taskData.dueDate) {
            var dueD = new Date(taskData.dueDate);
            dueDateStr = isNaN(dueD.getTime()) ? 'не указан' : dueD.toLocaleDateString('ru-RU');
        }
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: toEmail,
            to_name: toLogin,
            subject: taskData.title || 'Новая задача',
            task_title: taskData.title || '',
            task_description: taskData.description || 'нет описания',
            task_priority: PRIORITY_LABELS[taskData.priority] || taskData.priority || 'Средний',
            task_due_date: dueDateStr,
            from_name: currentUser.login
        }).then(function(res) {
            console.log('EmailJS: письмо отправлено', res);
        }).catch(function(err) {
            console.error('EmailJS: ошибка отправки', err);
        });
    }

    // ---------- Популяция select исполнителей ----------
    function populateAssigneeSelect() {
        populateSelect(taskAssignee);
        populateSelect(reportAssignee);
    }

    function populateSelect(select) {
        if (!select) return;
        var currentVal = select.value;
        select.innerHTML = '<option value="">Не назначен</option>';
        users.forEach(function(u) {
            var opt = document.createElement('option');
            opt.value = u.login;
            opt.textContent = u.login + (u.role === 'admin' ? ' (Руководитель)' : '');
            select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
    }

    // ---------- Модальное окно задачи ----------
    function openTaskModal(taskData, x, y, mode, presetStatus) {
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
            taskDueDate.value = DeadlineHelpers.toDateTimeLocalValue(taskData.dueDate);
            taskAssignee.value = taskData.assignedTo || '';
        } else {
            modalTitle.textContent = 'Новая задача';
            taskId.value = '';
            taskTitle.value = '';
            taskDesc.value = '';
            taskStatus.value = presetStatus || 'in_progress';
            taskPriority.value = 'medium';
            taskDueDate.value = '';
            taskAssignee.value = '';
        }
        taskModal.classList.add('active');
        positionModalAtPoint(taskModal, x, y);
    }

    if (itemTypeToggle) {
        itemTypeToggle.addEventListener('click', function(e) {
            var btn = e.target.closest('.item-type-btn');
            if (!btn) return;
            currentItemMode = btn.dataset.type;
            if (currentItemMode === 'report') taskId.value = '';
            itemTypeToggle.querySelectorAll('.item-type-btn').forEach(function(b) {
                b.classList.toggle('active', b === btn);
            });
            if (taskStatusGroup) {
                taskStatusGroup.style.display = currentItemMode === 'report' ? 'none' : '';
            }
            modalTitle.textContent = currentItemMode === 'report' ? 'Новый отчёт' : 'Новая задача';
        });
    }

    function openReportModal(reportData, x, y) {
        if (reportData) {
            reportModalTitle.textContent = 'Редактировать отчёт';
            reportId.value = reportData.id;
            reportTitle.value = reportData.title || '';
            reportDesc.value = reportData.description || '';
            reportPriority.value = reportData.priority || 'medium';
            reportDueDate.value = DeadlineHelpers.toDateTimeLocalValue(reportData.dueDate);
            reportAssignee.value = reportData.assignedTo || '';
            document.getElementById('reportStatus').value = 'reports';
        } else {
            reportModalTitle.textContent = 'Новый отчёт';
            reportId.value = '';
            reportTitle.value = '';
            reportDesc.value = '';
            reportPriority.value = 'medium';
            reportDueDate.value = '';
            reportAssignee.value = '';
        }
        document.getElementById('reportStatus').value = 'reports';
        reportModal.classList.add('active');
        positionModalAtPoint(reportModal, x, y);
    }

    reportForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var id = reportId.value;
        var title = reportTitle.value.trim();
        if (!title) return;
        var desc = reportDesc.value.trim();
        var priority = reportPriority.value;
        // Нормализуем срок в ISO-строку (UTC), чтобы единый формат дат
        // корректно обрабатывался во всех браузерах и функциях приложения.
        var dueDate = DeadlineHelpers.normalizeDueDate(reportDueDate.value);
        var assignee = reportAssignee.value;
        var reportStatus = document.getElementById('reportStatus').value;

        if (reportStatus === 'urgent' || reportStatus === 'in_progress') {
            if (id) {
                var rep = reports.find(function(r) { return r.id === id; });
                if (rep) {
                    var convertedReport = Object.assign({}, rep, {
                        title: title,
                        description: desc,
                        priority: priority,
                        dueDate: dueDate,
                        assignedTo: assignee || ''
                    });
                    reportToTask(convertedReport, reportStatus).then(function() { removeReport(rep.id); });
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

    taskForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var id = taskId.value;
        var title = taskTitle.value.trim();
        if (!title) return;
        var description = taskDesc.value.trim();
        var status = taskStatus.value;
        var priority = taskPriority.value;
        // Нормализуем срок в ISO-строку (UTC), чтобы единый формат дат
        // корректно обрабатывался во всех браузерах и функциях приложения.
        var dueDate = DeadlineHelpers.normalizeDueDate(taskDueDate.value);
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
                    var convertedTask = Object.assign({}, task, {
                        title: title,
                        description: description,
                        priority: priority,
                        dueDate: dueDate,
                        assignedTo: assignee || ''
                    });
                    taskToReport(convertedTask).then(function() { removeTask(task.id); });
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

    addTaskBtn.addEventListener('click', function(e) {
        openTaskModal(null, e.clientX, e.clientY, 'task');
    });

    var addReportBtn = document.getElementById('addReportBtn');
    if (addReportBtn) {
        addReportBtn.addEventListener('click', function(e) {
            openTaskModal(null, e.clientX, e.clientY, 'report');
        });
    }

    // ---------- Создание по двойному клику в колонке ----------
    // Двойной клик/тап по пустому месту колонки открывает модалку создания
    // с автоматически подставленным статусом соответствующей колонки:
    // «Срочные» -> urgent, «В работе» -> in_progress, «Отчёты» -> режим отчёта.
    function columnCreateTask(e, column) {
        var status = column.dataset.status;
        if (status === 'reports') {
            openTaskModal(null, e.clientX, e.clientY, 'report');
        } else {
            openTaskModal(null, e.clientX, e.clientY, 'task', status);
        }
    }

    function isColumnInteractiveTarget(target) {
        return !!target.closest('.task-card, button, input, select, textarea, [data-action]');
    }

    document.querySelectorAll('.column').forEach(function(column) {
        column.addEventListener('dblclick', function(e) {
            if (isColumnInteractiveTarget(e.target)) return;
            columnCreateTask(e, column);
        });
        if (isTouchDevice) {
            var lastColumnTapTime = 0;
            column.addEventListener('click', function(e) {
                if (isColumnInteractiveTarget(e.target)) return;
                var now = Date.now();
                if (now - lastColumnTapTime < TOUCH_TAP_MS) {
                    lastColumnTapTime = 0;
                    columnCreateTask(e, column);
                } else {
                    lastColumnTapTime = now;
                }
            });
        }
    });

    // ---------- Мобильные кнопки ----------
    var mobileAddBtn = document.getElementById('mobileAddBtn');
    var mobileManageBtn = document.getElementById('mobileManageBtn');
    var mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
    var mobileSettingsDropdown = document.getElementById('mobileSettingsDropdown');
    var mobileExportBtn = document.getElementById('mobileExportBtn');
    var mobileImportBtn = document.getElementById('mobileImportBtn');

    if (mobileAddBtn) {
        mobileAddBtn.addEventListener('click', function(e) {
            openTaskModal(null, e.clientX, e.clientY, 'task');
        });
    }
    if (mobileManageBtn) {
        mobileManageBtn.addEventListener('click', function(e) {
            openManagePanel(e.clientX, e.clientY);
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

    // ---------- Дропдаун настроек (десктоп) ----------
    var toolbarSettingsBtn = document.getElementById('toolbarSettingsBtn');
    var toolbarSettingsDropdown = document.getElementById('toolbarSettingsDropdown');
    if (toolbarSettingsBtn) {
        toolbarSettingsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toolbarSettingsDropdown.classList.toggle('active');
        });
    }

    document.addEventListener('click', function() {
        if (mobileSettingsDropdown) mobileSettingsDropdown.classList.remove('active');
        if (toolbarSettingsDropdown) toolbarSettingsDropdown.classList.remove('active');
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
                'Создал': formatUserName(t.createdBy),
                'Исполнитель': formatUserName(t.assignedTo),
                'Приоритет': t.priority || 'medium',
                'Срок': formatDateTime(t.dueDate),
                'Делегировано': t.delegated ? (t.delegatedBy === 'admin' ? 'Руководителем' : 'Сотрудником') : '',
                'Создано': formatDateTime(t.createdAt),
                'Обновлено': formatDateTime(t.updatedAt)
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
                            dueDate: DeadlineHelpers.normalizeDueDate(row['Срок']) || existing.dueDate,
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
                            dueDate: DeadlineHelpers.normalizeDueDate(row['Срок']) || '',
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

    function positionModalAtPoint(modal, x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') return;
        var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
        if (!finePointer) return;
        var content = modal.querySelector('.modal-content');
        if (!content) return;
        content.style.position = 'fixed';
        content.style.margin = '0';
        content.style.maxHeight = '90vh';
        content.style.overflowY = 'auto';
        var w = content.offsetWidth;
        var h = content.offsetHeight;
        var pad = 8;
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var left = Math.min(x + pad, vw - w - pad);
        var top = Math.min(y + pad, vh - h - pad);
        if (left < pad) left = pad;
        if (top < pad) top = pad;
        content.style.left = left + 'px';
        content.style.top = top + 'px';
    }

    function formatUserName(login) {
        if (!login) return '—';
        var u = users.find(function(u) { return u.login === login; });
        if (u && u.name) return u.name;
        if (u && u.role === 'admin') return 'Руководитель';
        return login;
    }

    function computeReportNumber() {
        var max = 0;
        reports.forEach(function(r) {
            if (r.reportNumber > max) max = r.reportNumber;
        });
        return max + 1;
    }

    function sortByDueDate(a, b) {
        var aDue = a.dueDate ? new Date(a.dueDate).getTime() : null;
        var bDue = b.dueDate ? new Date(b.dueDate).getTime() : null;
        if (aDue === null && bDue === null) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
        if (aDue === null) return 1;
        if (bDue === null) return -1;
        if (aDue !== bDue) return aDue - bDue;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' + d.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
    }

    function isMyReport(report) {
        if (currentUser.role === 'admin') return true;
        return report.createdBy === currentUser.login || report.assignedTo === currentUser.login;
    }

    function createReportCard(report) {
        const div = document.createElement('div');
        var stripClass = DeadlineHelpers.deadlineStripClassFromDate(report.dueDate);
        div.className = 'task-card report-card priority-' + (report.priority || 'medium') + ' ' + stripClass;
        div.dataset.id = report.id;
        if (report.dueDate) {
            div.setAttribute('role', 'listitem');
            div.setAttribute('aria-label', (report.title || 'Отчёт') + '. ' + deadlineStatusLabel(report.dueDate));
        }

        var numberLabel = report.reportNumber
            ? '№' + report.reportNumber
            : 'Отчёт';
        var assigneeLabel = report.assignedTo ? '👤 ' + escapeHtml(formatUserName(report.assignedTo)) : '';

        div.innerHTML =
            (report.delegated
                ? '<span class="task-delegate-arrow ' + (report.assignedTo === currentUser.login ? 'arrow-received' : 'arrow-delegated') + '">' + (report.assignedTo === currentUser.login ? '↙' : '↗') + '</span>'
                : '') +
            '<div class="task-title">' + escapeHtml(report.title || 'Без названия') + '</div>' +
            '<div class="task-meta">' +
                '<span>📄 ' + escapeHtml(numberLabel) + '</span>' +
                (report.dueDate ? '<span><i class="fa-regular fa-calendar"></i> ' + formatDateTime(report.dueDate) + '</span>' : '') +
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

        div.querySelectorAll('[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var action = this.dataset.action;
                var x = e.clientX;
                var y = e.clientY;
                if (action === 'delete') {
                    if (confirm('Удалить отчёт?')) {
                        removeReport(report.id);
                    }
                } else if (action === 'done') {
                    changeReportStatus(report.id, 'done');
                } else if (action === 'delegate') {
                    showDelegateModal(report, saveReport, 'отчёт', x, y);
                } else if (action === 'open') {
                    showReportDetails(report, x, y);
                } else if (action === 'settings') {
                    openReportModal(report, x, y);
                }
            });
        });

        div.addEventListener('dblclick', function(e) {
            e.preventDefault();
            openFullReport(report, e.clientX, e.clientY);
        });

        attachMobileTapHandlers(div, function(x, y) { openFullReport(report, x, y); });

        return div;
    }

    function renderReports() {
        const list = document.getElementById('list_reports');
        const countEl = document.getElementById('count_reports');
        if (!list || !countEl) return;
        const visible = reports.filter(function(r) {
            return r.status === 'active' && isMyReport(r);
        });
        visible.sort(sortByDueDate);
        countEl.textContent = visible.length;
        list.innerHTML = '';
        if (visible.length === 0) {
            list.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem;text-align:center;padding:1rem 0;">Нет отчётов</p>';
            return;
        }
        visible.forEach(function(r) {
            list.appendChild(createReportCard(r));
        });
    }

    // ---------- Запуск ----------
    // Приветствие и текущая дата в шапке (имя подтягивается из профиля/сессии)
    function updateHeaderGreeting(user) {
        var greetEl = document.getElementById('greeting');
        var dateEl = document.getElementById('currentDate');
        if (greetEl) {
            var now = new Date();
            var h = now.getHours();
            var greetingText = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
            var displayName = (user && user.name) || (user && user.login) || '';
            greetEl.textContent = displayName ? greetingText + ', ' + displayName + '!' : greetingText + '!';
        }
        if (dateEl) {
            var now2 = new Date();
            var s = now2.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
            dateEl.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        }
    }

    updateHeaderGreeting(null); // Показываем приветствие/дату до авторизации

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
