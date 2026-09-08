// ============================================================
//  РўСЂРµРєРµСЂ Р·Р°РґР°С‡ вЂ” PWA СЃ Firebase Realtime Database + Auth
//  Р”Р°РЅРЅС‹Рµ СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓСЋС‚СЃСЏ РјРµР¶РґСѓ РІСЃРµРјРё СѓСЃС‚СЂРѕР№СЃС‚РІР°РјРё РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё
// ============================================================

(function() {
    'use strict';

    // ---------- Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ ----------
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
    let currentItemMode = 'task'; // 'task' | 'report' вЂ” СЂРµР¶РёРј РјРѕРґР°Р»РєРё РґРѕР±Р°РІР»РµРЅРёСЏ
    let activeView = 'tasks'; // 'tasks' | 'reports' вЂ” С‚РµРєСѓС‰Р°СЏ РІРєР»Р°РґРєР°
    let selectedEmployee = ''; // Р»РѕРіРёРЅ РІС‹Р±СЂР°РЅРЅРѕРіРѕ СЃРѕС‚СЂСѓРґРЅРёРєР° РІ С„РёР»СЊС‚СЂРµ; '' вЂ” РІСЃРµ

    // ---------- Р—РІСѓРєРѕРІРѕРµ СѓРІРµРґРѕРјР»РµРЅРёРµ ----------
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

    // ---------- Р‘РµР№РґР¶ РЅР° РёРєРѕРЅРєРµ PWA ----------
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
        // Canvas-favicon С„РѕР»Р±СЌРє
        setFaviconBadge(badgeCount);
    }

    function setFaviconBadge(count) {
        try {
            if (!baseFavicon) {
                baseFavicon = new Image();
                baseFavicon.src = 'logo.png?v=2';
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

    // ---------- Р’РёР·СѓР°Р»СЊРЅРѕРµ СѓРІРµРґРѕРјР»РµРЅРёРµ ----------
    function showToast(title, subtitle, type) {
        type = type || 'new-task';
        var container = document.getElementById('toastContainer');
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        var icon = type === 'delegated' ? 'рџ“¤' : 'рџ“‹';
        toast.innerHTML =
            '<span class="toast-icon">' + icon + '</span>' +
            '<div class="toast-body">' +
                '<span class="toast-title">' + escapeHtml(title) + '</span>' +
                '<span class="toast-subtitle">' + escapeHtml(subtitle) + '</span>' +
            '</div>' +
            '<button class="toast-close" title="Р—Р°РєСЂС‹С‚СЊ">&times;</button>';
        container.appendChild(toast);
        incrementBadge();
        toast.querySelector('.toast-close').addEventListener('click', function() {
            toast.classList.add('toast-exit');
            setTimeout(function() { toast.remove(); }, 300);
            if (badgeCount > 0) badgeCount--;
            updateBadge();
        });
    }

    // ---------- РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ EmailJS ----------
    const EMAILJS_PUBLIC_KEY = 'e1iKZl_RU3ZoaikIL';
    const EMAILJS_SERVICE_ID = 'service_5lbjjn3';
    const EMAILJS_TEMPLATE_ID = 'template_ql5rq3a';

    // ---------- Firebase РїСѓС‚Рё ----------
    function getTasksRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/tasks');
    }
    function getUsersRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/users');
    }
    function getReportsRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/reports');
    }

    // ---------- DOM-СЌР»РµРјРµРЅС‚С‹ ----------
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
    const itemTypeToggle = document.getElementById('itemTypeToggle');
    const taskStatusGroup = document.getElementById('taskStatusGroup');
    const viewTasksBtn = document.getElementById('viewTasksBtn');
    const viewReportsBtn = document.getElementById('viewReportsBtn');
    const employeeFilter = document.getElementById('employeeFilter');
    const reportsView = document.getElementById('reportsView');

    // ---------- Color picker interactivity ----------
    const DEFAULT_COLORS = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1'];

    // ---------- Р Р°Р±РѕС‚Р° СЃ localStorage (СЃРµСЃСЃРёСЏ) ----------
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

    // ---------- Firebase: Р·Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С… ----------
    let listenersInitialized = false;
    function initFirebaseListeners() {
        if (listenersInitialized) return;
        listenersInitialized = true;
        // РЎР»СѓС€Р°РµРј Р·Р°РґР°С‡Рё РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё
        getTasksRef().on('value', function(snapshot) {
            var data = snapshot.val();
            var newTasks = data ? Object.values(data) : [];
            newTasks.forEach(function(t) {
                if (t.status === 'delegated') t.status = 'in_progress';
                // РќРѕСЂРјР°Р»РёР·СѓРµРј СЃСЂРѕРє РІ ISO-СЃС‚СЂРѕРєСѓ (UTC): РµРґРёРЅС‹Р№ С„РѕСЂРјР°С‚ РґР»СЏ РІСЃРµС…
                // Р±СЂР°СѓР·РµСЂРѕРІ, С‡С‚РѕР±С‹ new Date(...)/toLocaleDateString РЅРµ Р±СЂРѕСЃР°Р»Рё RangeError.
                t.dueDate = DeadlineHelpers.normalizeDueDate(t.dueDate);
            });

            // РћР±РЅР°СЂСѓР¶РµРЅРёРµ РЅРѕРІС‹С… Р·Р°РґР°С‡
            if (initialLoadDone && currentUser) {
                newTasks.forEach(function(t) {
                    if (!knownTaskIds.has(t.id)) {
                        var assignedToMe = t.assignedTo === currentUser.login;
                        var isMyTask = t.createdBy === currentUser.login;
                        if (assignedToMe && !isMyTask) {
                            playNotificationSound();
                            if (t.delegated) {
                                showToast(t.title, 'Р”РµР»РµРіРёСЂРѕРІР°РЅРѕ РІР°Рј РѕС‚ ' + (t.createdBy || ''), 'delegated');
                            } else {
                                showToast(t.title, 'РќР°Р·РЅР°С‡РµРЅР° РІР°Рј РѕС‚ ' + (t.createdBy || ''), 'new-task');
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

        // РЎР»СѓС€Р°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё
        getUsersRef().on('value', function(snapshot) {
            const data = snapshot.val();
            const rawUsers = data ? Object.values(data) : [];
            users = rawUsers.map(function(u) {
                var normalized = DeadlineHelpers.normalizeUser(u);
                if (!normalized.color) {
                    normalized.color = DEFAULT_COLORS[rawUsers.indexOf(u) % DEFAULT_COLORS.length];
                }
                return normalized;
            });
            // Р•СЃР»Рё С‚РµРєСѓС‰РёР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РµСЃС‚СЊ РІ СЃРїРёСЃРєРµ вЂ” РѕР±РЅРѕРІР»СЏРµРј РµРіРѕ РґР°РЅРЅС‹Рµ
            if (currentUser) {
                const fresh = users.find(function(u) { return u.login === currentUser.login; });
                if (fresh) {
                    currentUser = { uid: fresh.uid, login: fresh.login, name: fresh.name || '', role: fresh.role, color: fresh.color, email: fresh.email, emoji: fresh.emoji };
                }
            }
            populateAssigneeSelect();
            populateEmployeeFilter();
            if (initialLoadDone) renderBoard();
        });

        // РЎР»СѓС€Р°РµРј РѕС‚С‡С‘С‚С‹ РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё
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

    // ---------- РђРІС‚РѕРїРµСЂРµС…РѕРґ РїСЂРѕСЃСЂРѕС‡РµРЅРЅС‹С… Р·Р°РґР°С‡ РІ "РЎСЂРѕС‡РЅРѕ" ----------
    var overdueNotified = new Set();

    function checkOverdueTasks() {
        if (!currentUser) return;
        var now = new Date();
        var updated = false;
        tasks.forEach(function(t) {
            if (!t.dueDate) return;
            var due = new Date(t.dueDate);
            // РџСЂРѕСЃСЂРѕС‡РµРЅР°: РІСЂРµРјСЏ РІС‹С€Р»Рѕ Рё Р·Р°РґР°С‡Р° РІ СЂР°Р±РѕС‚Рµ
            if (now > due && t.status === 'in_progress') {
                var patched = Object.assign({}, t, {
                    status: 'urgent',
                    updatedAt: now.toISOString()
                });
                saveTask(patched);
                updated = true;
            }
            // РџРѕСЃР»РµРґРЅРёР№ РґРµРЅСЊ СЃСЂРѕРєР°: СѓРІРµРґРѕРјР»РµРЅРёРµ РёСЃРїРѕР»РЅРёС‚РµР»СЋ Рё admin'Сѓ (С‚РѕР»СЊРєРѕ РґР»СЏ РЅРµРІС‹РїРѕР»РЅРµРЅРЅС‹С…)
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
        // РЈРІРµРґРѕРјР»РµРЅРёРµ РёСЃРїРѕР»РЅРёС‚РµР»СЋ
        if (task.assignedTo) {
            var assignee = users.find(function(u) { return u.login === task.assignedTo; });
            if (assignee && assignee.email) {
                sendEmailNotification(task.assignedTo, {
                    title: task.title,
                    description: 'РСЃС‚РµРєР°РµС‚ СЃСЂРѕРє Р·Р°РґР°С‡Рё: ' + dueStr,
                    priority: task.priority,
                    dueDate: task.dueDate
                });
            }
            showToast(task.title, 'РСЃС‚РµРєР°РµС‚ СЃСЂРѕРє! Р”Рѕ: ' + dueStr, 'new-task');
            playNotificationSound();
        }
        // РЈРІРµРґРѕРјР»РµРЅРёРµ admin'Сѓ
        if (currentUser.login !== task.assignedTo) {
            var admin = users.find(function(u) { return u.role === 'admin'; });
            if (admin && admin.email && admin.login !== currentUser.login) {
                sendEmailNotification(admin.login, {
                    title: task.title,
                    description: 'РСЃС‚РµРєР°РµС‚ СЃСЂРѕРє Р·Р°РґР°С‡Рё (РёСЃРїРѕР»РЅРёС‚РµР»СЊ: ' + (task.assignedTo || 'РЅРµ РЅР°Р·РЅР°С‡РµРЅ') + '): ' + dueStr,
                    priority: task.priority,
                    dueDate: task.dueDate
                });
            }
        }
    }

    // Р—Р°РїСѓСЃРє РїСЂРѕРІРµСЂРєРё РєР°Р¶РґСѓСЋ РјРёРЅСѓС‚Сѓ
    setInterval(checkOverdueTasks, 60000);

    // ---------- РћР±РЅРѕРІР»РµРЅРёРµ РёРЅРґРёРєР°С†РёРё РґРµРґР»Р°Р№РЅРѕРІ РїРѕ С‚Р°Р№РјРµСЂСѓ ----------
    // Р Р°Р· РІ РјРёРЅСѓС‚Сѓ РїРµСЂРµСЃС‡РёС‚С‹РІР°РµРј С†РІРµС‚ Р»РµРІРѕР№ РїРѕР»РѕСЃС‹ РєР°СЂС‚РѕС‡РµРє,
    // С‡С‚РѕР±С‹ С†РІРµС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РјРµРЅСЏР»СЃСЏ РїСЂРё РЅР°СЃС‚СѓРїР»РµРЅРёРё 17:00, РїРѕР»СѓРЅРѕС‡Рё Рё С‚.Рґ.
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
                card.setAttribute('aria-label', (task.title || 'РћС‚С‡С‘С‚') + '. ' + deadlineStatusLabel(task.dueDate));
            }
        });
    }

    setInterval(refreshDeadlineStrips, 60000);
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) refreshDeadlineStrips();
    });

    // РћС‡РёСЃС‚РєР° Р±РµР№РґР¶Р° РїСЂРё РєР»РёРєРµ РЅР° СЃС‚СЂР°РЅРёС†Сѓ
    document.addEventListener('click', function() {
        if (badgeCount > 0) clearBadge();
    });

    // ---------- Firebase: Р·Р°РїРёСЃСЊ РґР°РЅРЅС‹С… ----------
    function saveTask(task) {
        task.dueDate = DeadlineHelpers.normalizeDueDate(task.dueDate);
        return getTasksRef().child(task.id).set(task)
            .then(function() {
                console.log('Р—Р°РґР°С‡Р° СЃРѕС…СЂР°РЅРµРЅР° СѓСЃРїРµС€РЅРѕ:', task.id);
                return task;
            })
            .catch(function(error) {
                console.error('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ Р·Р°РґР°С‡Рё:', error);
                alert('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ Р·Р°РґР°С‡Рё: ' + error.message);
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
                console.log('РћС‚С‡С‘С‚ СЃРѕС…СЂР°РЅС‘РЅ:', report.id);
                return report;
            })
            .catch(function(error) {
                console.error('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РѕС‚С‡С‘С‚Р°:', error);
                alert('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РѕС‚С‡С‘С‚Р°: ' + error.message);
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

    // РќРѕСЂРјР°Р»РёР·Р°С†РёСЏ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ: РјРёРіСЂР°С†РёСЏ СЂРѕР»РµР№ + РїСЂРµСЃРµС‚ РїСЂР°РІ.
    function buildCurrentUser(userData, uid) {
        return DeadlineHelpers.normalizeUser(Object.assign({}, userData, {
            uid: uid || userData.uid
        }));
    }

    // ---------- РђРІС‚РѕСЃРѕР·РґР°РЅРёРµ admin-РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ----------
    function ensureAdminUser() {
        console.log('ensureAdminUser: РїРѕРїС‹С‚РєР° СЃРѕР·РґР°РЅРёСЏ admin...');
        auth.createUserWithEmailAndPassword('admin@tasktracker.local', 'admin123')
            .then(function(userCredential) {
                const uid = userCredential.user.uid;
                console.log('ensureAdminUser: admin СЃРѕР·РґР°РЅ РІ Auth, uid=' + uid + ', Р·Р°РїРёСЃС‹РІР°СЋ РІ DB...');
                return getUsersRef().child('admin').set(Object.assign({}, DeadlineHelpers.normalizeUser({
                    login: 'admin',
                    name: 'РҐР°СЂРёС‚РѕРЅ',
                    role: 'manager',
                    color: '#3b82f6',
                    email: '',
                    createdBy: ''
                }), { uid: uid }));
            })
            .then(function() {
                console.log('ensureAdminUser: admin Р·Р°РїРёСЃР°РЅ РІ DB. Р’РѕР№РґРёС‚Рµ: admin / admin123');
            })
            .catch(function(error) {
                if (error.code === 'auth/email-already-in-use') {
                    console.log('ensureAdminUser: admin СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚, РїСЂРѕРїСѓСЃРєР°СЋ');
                } else {
                    console.log('ensureAdminUser: РѕС€РёР±РєР° вЂ”', error.code, error.message);
                }
            });
    }

    // ---------- РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ ----------
    function init() {
        console.log('РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїСЂРёР»РѕР¶РµРЅРёСЏ...');

        // РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ Firebase Auth
        auth = firebase.auth();
        
        // РЎР»СѓС€Р°РµРј СЃРѕСЃС‚РѕСЏРЅРёРµ Р°РІС‚РѕСЂРёР·Р°С†РёРё
        auth.onAuthStateChanged(function(user) {
            if (user) {
                const login = user.email.replace('@tasktracker.local', '');
                getUsersRef().child(login).once('value').then(function(snapshot) {
                    const userData = snapshot.val();
                    if (userData) {
                        currentUser = buildCurrentUser(userData, user.uid);
                        // РџРµСЂРІРёС‡РЅР°СЏ РјРёРіСЂР°С†РёСЏ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµР№ Р·Р°РїРёСЃРё admin: РґРѕР±Р°РІР»СЏРµРј РёРјСЏ
                        if (login === 'admin' && !userData.name) {
                            currentUser.name = 'РҐР°СЂРёС‚РѕРЅ';
                            saveUser(currentUser);
                        }
                        saveSession(currentUser);
                        showMainPage();
                        initFirebaseListeners();
                    } else if (login === 'admin') {
                        // РџРµСЂРІС‹Р№ РІС…РѕРґ admin вЂ” СЃРѕР·РґР°С‘Рј Р·Р°РїРёСЃСЊ РІ Р‘Р”
                        currentUser = DeadlineHelpers.normalizeUser({
                            uid: user.uid,
                            login: login,
                            name: 'РҐР°СЂРёС‚РѕРЅ',
                            role: 'manager',
                            color: '#3b82f6',
                            email: '',
                            createdBy: ''
                        });
                        saveUser(currentUser);
                        saveSession(currentUser);
                        showMainPage();
                        initFirebaseListeners();
                    } else {
                        // Р—Р°РїРёСЃРё РЅРµС‚ РІ Р‘Р” вЂ” Р°РєРєР°СѓРЅС‚ СѓРґР°Р»С‘РЅ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј
                        blockedMessage = 'Р’Р°С€ Р°РєРєР°СѓРЅС‚ СѓРґР°Р»С‘РЅ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј';
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

        // РЎРѕР·РґР°С‘Рј admin РµСЃР»Рё РµРіРѕ РЅРµС‚
        ensureAdminUser();

        // РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ EmailJS
        if (EMAILJS_PUBLIC_KEY && typeof emailjs !== 'undefined') {
            try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch (e) {}
        }
    }

    // ---------- РЎС‚СЂР°РЅРёС†С‹ ----------
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
        userRoleBadge.textContent = currentUser.role === 'admin' ? 'Р СѓРєРѕРІРѕРґРёС‚РµР»СЊ' : 'РЎРѕС‚СЂСѓРґРЅРёРє';
        manageUsersBtn.style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
        const mobileManage = document.getElementById('mobileManageBtn');
        if (mobileManage) mobileManage.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
        populateAssigneeSelect();
        populateEmployeeFilter();
        switchView('tasks');
    }

    // ---------- РђРІС‚РѕСЂРёР·Р°С†РёСЏ ----------
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const login = loginInput.value.trim();
        const password = passwordInput.value;
        if (!login || !password) {
            loginError.textContent = 'Р—Р°РїРѕР»РЅРёС‚Рµ РѕР±Р° РїРѕР»СЏ';
            return;
        }

        const email = login + '@tasktracker.local';
        console.log('Р’С…РѕРґ: email=' + email);
        auth.signInWithEmailAndPassword(email, password)
            .then(function(userCredential) {
                console.log('Р’С…РѕРґ СѓСЃРїРµС€РµРЅ, uid=' + userCredential.user.uid);
                return getUsersRef().child(login).once('value');
            })
            .then(function(snapshot) {
                const userData = snapshot.val();
                console.log('Р”Р°РЅРЅС‹Рµ РёР· DB:', userData);
                if (userData) {
                    currentUser = buildCurrentUser(userData, user.uid);
                    saveSession(currentUser);
                    showMainPage();
                }
                // Р—Р°РїРёСЃРё РЅРµС‚ РІ Р‘Р” вЂ” СЃРѕР·РґР°РЅРёРµ Р·Р°РїРёСЃРё РґР»СЏ admin Рё Р±Р»РѕРєРёСЂРѕРІРєР° СѓРґР°Р»С‘РЅРЅС‹С…
                // РѕР±СЂР°Р±Р°С‚С‹РІР°СЋС‚СЃСЏ РІ onAuthStateChanged (РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹).
                // initFirebaseListeners СѓР¶Рµ РІС‹Р·С‹РІР°РµС‚СЃСЏ РІ onAuthStateChanged
            })
            .catch(function(error) {
                console.error('РћС€РёР±РєР°:', error.code, error.message);
                if (error.code === 'auth/user-not-found') {
                    loginError.textContent = 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ';
                } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    loginError.textContent = 'РќРµРІРµСЂРЅС‹Р№ РїР°СЂРѕР»СЊ';
                } else if (error.code === 'auth/too-many-requests') {
                    loginError.textContent = 'РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ РїРѕРїС‹С‚РѕРє. РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ';
                } else {
                    loginError.textContent = 'РћС€РёР±РєР°: ' + error.message;
                }
            });
    });

    logoutBtn.addEventListener('click', function() {
        // Р’С‹С…РѕРґ РёР· Firebase Auth
        auth.signOut().then(function() {
            // РћС‚РєР»СЋС‡Р°РµРј listeners
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
            console.error('РћС€РёР±РєР° РІС‹С…РѕРґР°:', error);
        });
    });

    // ---------- РЈРїСЂР°РІР»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё (РѕС‚РґРµР»СЊРЅР°СЏ СЃС‚СЂР°РЅРёС†Р°) ----------
    function openManagePanel(x, y) {
        if (!currentUser || !DeadlineHelpers.canDo(currentUser, 'manageRoles')) {
            return;
        }
        window.location.href = 'admin.html';
    }

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
                list.innerHTML = '<p class="archive-empty">РќРµС‚ Р°СЂС…РёРІРёСЂРѕРІР°РЅРЅС‹С… Р·Р°РґР°С‡</p>';
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
                        ? 'в„–' + r.reportNumber
                        : '';
                    var hay = (r.title || '').toLowerCase() + ' ' + numberLabel.toLowerCase();
                    return hay.indexOf(search) !== -1;
                });
            }
            if (archivedReports.length === 0) {
                list.innerHTML = '<p class="archive-empty">РќРµС‚ Р°СЂС…РёРІРёСЂРѕРІР°РЅРЅС‹С… РѕС‚С‡С‘С‚РѕРІ</p>';
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
                    '<span>рџ‘¤ ' + escapeHtml(formatUserName(task.assignedTo)) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="archive-row-actions">' +
                '<button class="btn-archived" data-action="open" title="РћС‚РєСЂС‹С‚СЊ"><i class="fa-solid fa-circle-info"></i> РћС‚РєСЂС‹С‚СЊ</button>' +
                '<button class="btn-archived" data-action="restore" title="Р’РµСЂРЅСѓС‚СЊ РЅР° РґРѕСЃРєСѓ"><i class="fa-solid fa-rotate-left"></i> Р’РµСЂРЅСѓС‚СЊ</button>' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-archived" data-action="delete" title="РЈРґР°Р»РёС‚СЊ"><i class="fa-solid fa-trash"></i> РЈРґР°Р»РёС‚СЊ</button>'
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
                    if (confirm('РЈРґР°Р»РёС‚СЊ Р·Р°РґР°С‡Сѓ?')) {
                        removeTask(task.id);
                    }
                }
            });
        });
        return div;
    }

    function createArchiveReportRow(report) {
        var numberLabel = report.reportNumber
            ? 'в„–' + report.reportNumber
            : 'РћС‚С‡С‘С‚';
        var assigneeLabel = report.assignedTo ? 'рџ‘¤ ' + escapeHtml(formatUserName(report.assignedTo)) : '';
        var div = document.createElement('div');
        div.className = 'archive-row archive-row-done ' + DeadlineHelpers.doneStripClass(report.completedAt, report.dueDate, report.completedLate);
        div.innerHTML =
            '<div class="archive-row-main">' +
                '<div class="task-title">' + escapeHtml(report.title) + '</div>' +
                '<div class="task-meta">' +
                    '<span>рџ“„ ' + escapeHtml(numberLabel) + '</span>' +
                    (report.dueDate ? '<span><i class="fa-regular fa-calendar"></i> ' + formatDateTime(report.dueDate) + '</span>' : '') +
                    (assigneeLabel ? '<span>' + assigneeLabel + '</span>' : '') +
                '</div>' +
            '</div>' +
            '<div class="archive-row-actions">' +
                '<button class="btn-archived" data-action="open" title="РћС‚РєСЂС‹С‚СЊ"><i class="fa-solid fa-circle-info"></i> РћС‚РєСЂС‹С‚СЊ</button>' +
                '<button class="btn-archived" data-action="restore" title="Р’РµСЂРЅСѓС‚СЊ РЅР° РґРѕСЃРєСѓ"><i class="fa-solid fa-rotate-left"></i> Р’РµСЂРЅСѓС‚СЊ</button>' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-archived" data-action="delete" title="РЈРґР°Р»РёС‚СЊ"><i class="fa-solid fa-trash"></i> РЈРґР°Р»РёС‚СЊ</button>'
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
                    if (confirm('РЈРґР°Р»РёС‚СЊ РѕС‚С‡С‘С‚?')) {
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
            alert('Р‘РёР±Р»РёРѕС‚РµРєР° XLSX РЅРµ Р·Р°РіСЂСѓР¶РµРЅР°. РџСЂРѕРІРµСЂСЊС‚Рµ РёРЅС‚РµСЂРЅРµС‚-СЃРѕРµРґРёРЅРµРЅРёРµ.');
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
                'РўРёРї': 'Р—Р°РґР°С‡Р°',
                'Р—Р°РіРѕР»РѕРІРѕРє': t.title,
                'РћРїРёСЃР°РЅРёРµ': t.description || '',
                'РЎСЂРѕРє': t.dueDate ? formatDateTime(t.dueDate) : '',
                'РЎРѕР·РґР°Р»': formatUserName(t.createdBy),
                'РСЃРїРѕР»РЅРёС‚РµР»СЊ': formatUserName(t.assignedTo)
            });
        });
        var archivedReports = reports.filter(function(r) {
            if (r.status !== 'done') return false;
            if (currentUser.role === 'admin') return true;
            return r.createdBy === currentUser.login || r.assignedTo === currentUser.login;
        });
        archivedReports.forEach(function(r) {
            rows.push({
                'РўРёРї': 'РћС‚С‡С‘С‚',
                'Р—Р°РіРѕР»РѕРІРѕРє': r.title,
                'РћРїРёСЃР°РЅРёРµ': r.description || '',
                'РЎСЂРѕРє': r.dueDate ? formatDateTime(r.dueDate) : '',
                'РЎРѕР·РґР°Р»': formatUserName(r.createdBy),
                'РСЃРїРѕР»РЅРёС‚РµР»СЊ': r.assignedTo ? formatUserName(r.assignedTo) : ''
            });
        });
        if (rows.length === 0) {
            alert('РќРµС‚ СЌР»РµРјРµРЅС‚РѕРІ РІ Р°СЂС…РёРІРµ РґР»СЏ РІС‹РіСЂСѓР·РєРё');
            return;
        }
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{wch:8},{wch:30},{wch:40},{wch:15},{wch:12},{wch:15}];
        XLSX.utils.book_append_sheet(wb, ws, 'РђСЂС…РёРІ');
        XLSX.writeFile(wb, 'РђСЂС…РёРІ_' + new Date().toISOString().slice(0,10) + '.xlsx');
    }

    // Р—Р°РєСЂС‹С‚РёРµ РјРѕРґР°Р»СЊРЅС‹С… РѕРєРѕРЅ
    document.querySelectorAll('.close-modal').forEach(function(el) {
        el.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });

    // ---------- Р Р°Р±РѕС‚Р° СЃ Р·Р°РґР°С‡Р°РјРё ----------
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function getTasksForUser() {
        return DeadlineHelpers.visibleTasks(tasks, currentUser.login, currentUser.role === 'admin', selectedEmployee);
    }

    // ---------- РџРµСЂРµРєР»СЋС‡РµРЅРёРµ РІРєР»Р°РґРѕРє В«Р—Р°РґР°С‡РёВ» / В«РћС‚С‡С‘С‚С‹В» ----------
    function switchView(view) {
        activeView = view === 'reports' ? 'reports' : 'tasks';
        const onTasks = activeView === 'tasks';
        if (viewTasksBtn) viewTasksBtn.classList.toggle('active', onTasks);
        if (viewReportsBtn) viewReportsBtn.classList.toggle('active', !onTasks);
        const boardEl = document.getElementById('board');
        if (boardEl) boardEl.style.display = onTasks ? '' : 'none';
        if (reportsView) reportsView.style.display = onTasks ? 'none' : '';
        renderBoard();
    }

    // ---------- Р¤РёР»СЊС‚СЂ РїРѕ СЃРѕС‚СЂСѓРґРЅРёРєР°Рј (С‚РѕР»СЊРєРѕ РґР»СЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°) ----------
    function populateEmployeeFilter() {
        if (!employeeFilter) return;
        const isAdmin = currentUser && currentUser.role === 'admin';
        employeeFilter.style.display = isAdmin ? '' : 'none';
        if (!isAdmin) {
            employeeFilter.value = '';
            selectedEmployee = '';
            return;
        }
        const prev = employeeFilter.value;
        employeeFilter.innerHTML = '<option value="">Р’СЃРµ СЃРѕС‚СЂСѓРґРЅРёРєРё</option>';
        users.slice().sort(function(a, b) {
            return (formatUserName(a.login) || a.login).localeCompare(formatUserName(b.login) || b.login, 'ru');
        }).forEach(function(u) {
            const opt = document.createElement('option');
            opt.value = u.login;
            opt.textContent = formatUserName(u.login) + (u.role === 'admin' ? ' (Р СѓРєРѕРІРѕРґРёС‚РµР»СЊ)' : '');
            employeeFilter.appendChild(opt);
        });
        employeeFilter.value = prev;
        if (employeeFilter.value !== prev) selectedEmployee = employeeFilter.value;
    }

    function renderBoard() {
        try {
            const userTasks = getTasksForUser();
            userTasks.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

            // Р•СЃР»Рё Р·Р°РґР°С‡Р° РёРјРµРµС‚ РІС‹СЃРѕРєРёР№ РїСЂРёРѕСЂРёС‚РµС‚, Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃС‚Р°РІРёРј РµС‘ РІ 'urgent'
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
                    list.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem;text-align:center;padding:1rem 0;">РќРµС‚ Р·Р°РґР°С‡</p>';
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
            console.error('РћС€РёР±РєР° РїСЂРё СЂРµРЅРґРµСЂРёРЅРіРµ РґРѕСЃРєРё:', e);
        }
    }

    // ---------- РљРѕР»СЊС†Рѕ СЃС‚Р°С‚РёСЃС‚РёРєРё (% РІС‹РїРѕР»РЅРµРЅРЅС‹С…) ----------
    function updateStatsRing() {
        var ringEl = document.getElementById('statsRing');
        var pctEl = document.getElementById('ringPct');
        if (!ringEl || !pctEl || !currentUser) return;
        var ringTasks = getTasksForUser();
        var ringReports = reports.filter(isMyReport);
        var stats = DeadlineHelpers.statsSummary(ringTasks, ringReports, currentUser.login, currentUser.role === 'admin');
        ringEl.style.setProperty('--p', stats.pct);
        pctEl.textContent = stats.pct + '%';
    }

    // ---------- РџРѕР»РЅР°СЏ РєР°СЂС‚РѕС‡РєР° Рё РјРѕР±РёР»СЊРЅС‹Рµ С‚Р°РїС‹ ----------
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
        // Р§РµР»РѕРІРµРєРѕС‡РёС‚Р°РµРјР°СЏ РїРѕРґРїРёСЃСЊ СЃС‚Р°С‚СѓСЃР° РґРµРґР»Р°Р№РЅР° РґР»СЏ РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё (aria-label)
        var status = DeadlineHelpers.getDeadlineStatus(dueDateStr);
        var labels = {
            'far': 'РЎСЂРѕРє РґР°Р»РµРєРѕ (Р±РѕР»РµРµ 4 РґРЅРµР№)',
            'close': 'РЎСЂРѕРє РїСЂРёР±Р»РёР¶Р°РµС‚СЃСЏ (2 РґРЅСЏ)',
            'soon': 'РЎСЂРѕРє Р·Р°РІС‚СЂР° (1 РґРµРЅСЊ)',
            'day': 'РЎСЂРѕРє СЃРµРіРѕРґРЅСЏ (РґРѕ 12:00)',
            'oday': 'РЎСЂРѕРє СЃРµРіРѕРґРЅСЏ, РїСЂРѕСЃСЂРѕС‡РµРЅРѕ (РїРѕСЃР»Рµ 17:00)',
            'odays': 'РЎСЂРѕРє РїСЂРѕСЃСЂРѕС‡РµРЅ (Р±РѕР»РµРµ 1 РґРЅСЏ)',
            'none': 'РЎСЂРѕРє РЅРµ Р·Р°РґР°РЅ'
        };
        return labels[status] || 'РЎСЂРѕРє РЅРµ Р·Р°РґР°РЅ';
    }
    function deadlineStatusLabelShort(dueDateStr) {
        // РљРѕСЂРѕС‚РєР°СЏ РїРѕРґРїРёСЃСЊ РґР»СЏ РёРєРѕРЅРєРё/РјРµС‚РєРё РЅР° РєР°СЂС‚РѕС‡РєРµ
        var status = DeadlineHelpers.getDeadlineStatus(dueDateStr);
        var labels = {
            'far': 'РЎСЂРѕРє: РґР°Р»РµРєРѕ',
            'close': 'РЎСЂРѕРє: 2 РґРЅСЏ',
            'soon': 'РЎСЂРѕРє: Р·Р°РІС‚СЂР°',
            'day': 'РЎСЂРѕРє СЃРµРіРѕРґРЅСЏ',
            'oday': 'РџСЂРѕСЃСЂРѕС‡РµРЅРѕ СЃРµРіРѕРґРЅСЏ',
            'odays': 'РџСЂРѕСЃСЂРѕС‡РµРЅРѕ РґР°РІРЅРѕ',
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
            div.setAttribute('aria-label', (task.title || 'Р—Р°РґР°С‡Р°') + '. ' + deadlineStatusLabel(task.dueDate));
        }

        const assigneeUser = task.assignedTo ? users.find(function(u) { return u.login === task.assignedTo; }) : null;
        const assigneeName = task.assignedTo ? formatUserName(task.assignedTo) : 'РЅРµ РЅР°Р·РЅР°С‡РµРЅ';
        const assigneeEmoji = assigneeUser ? (assigneeUser.emoji || 'рџ‘¤') : 'рџ‘¤';

        div.innerHTML =
            (task.delegated
                ? '<span class="task-delegate-arrow ' + (task.assignedTo === currentUser.login ? 'arrow-received' : 'arrow-delegated') + '">' + (task.assignedTo === currentUser.login ? 'в†™' : 'в†—') + '</span>'
                : '') +
            '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
            '<div class="task-meta">' +
                '<span>' + assigneeEmoji + ' ' + escapeHtml(assigneeName) + '</span>' +
                (task.dueDate ? '<span><i class="fa-regular fa-calendar"></i> ' + formatDateTime(task.dueDate) + '</span>' : '') +
            '</div>' +
            '<div class="task-actions-row1">' +
                (task.status !== 'done'
                    ? '<button class="btn-done" data-action="done"><i class="fa-solid fa-check"></i> Р’С‹РїРѕР»РЅРёС‚СЊ</button>'
                    : '<button class="btn-restore" data-action="restore"><i class="fa-solid fa-rotate-left"></i> Р’РµСЂРЅСѓС‚СЊ</button>') +
                (task.status !== 'done' && (currentUser.role === 'admin' || currentUser.login === task.createdBy)
                    ? '<button class="btn-delegate" data-action="delegate"><i class="fa-solid fa-paper-plane"></i> Р”РµР»РµРіРёСЂРѕРІР°С‚СЊ</button>'
                    : '') +
            '</div>' +
            '<div class="task-actions-row2">' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-delete" data-action="delete" title="РЈРґР°Р»РёС‚СЊ"><i class="fa-solid fa-trash"></i></button>'
                    : '') +
                '<button class="btn-settings" data-action="settings" title="РќР°СЃС‚СЂРѕР№РєРё"><i class="fa-solid fa-gear"></i></button>' +
                '<button class="btn-open" data-action="open" title="РћС‚РєСЂС‹С‚СЊ"><i class="fa-solid fa-circle-info"></i></button>' +
            '</div>';

        div.querySelectorAll('[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var action = this.dataset.action;
                var x = e.clientX;
                var y = e.clientY;
                if (action === 'delete') {
                    if (confirm('РЈРґР°Р»РёС‚СЊ Р·Р°РґР°С‡Сѓ?')) {
                        removeTask(task.id);
                    }
                } else if (action === 'done') {
                    changeStatus(task.id, 'done');
                } else if (action === 'restore') {
                    changeStatus(task.id, task.previousStatus || 'in_progress');
                } else if (action === 'delegate') {
                    showDelegateModal(task, saveTask, 'Р·Р°РґР°С‡Сѓ', x, y);
                } else if (action === 'open') {
                    showTaskDetails(task, x, y);
                } else if (action === 'settings') {
                    if (currentUser.role !== 'admin' && task.createdBy !== currentUser.login) {
                        alert('Р’С‹ РЅРµ РјРѕР¶РµС‚Рµ СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ СЌС‚Сѓ Р·Р°РґР°С‡Сѓ');
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
                alert('Р’С‹ РЅРµ РјРѕР¶РµС‚Рµ РёР·РјРµРЅСЏС‚СЊ СЌС‚Сѓ Р·Р°РґР°С‡Сѓ');
                draggedTaskId = null;
                return;
            }
            changeStatus(draggedTaskId, newStatus);
            draggedTaskId = null;
        });
    });

    // ---------- CRUD Р·Р°РґР°С‡ ----------
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

    // ---------- РџРѕРєР°Р· РґРµС‚Р°Р»РµР№ Р·Р°РґР°С‡Рё ----------
    function showTaskDetails(task, x, y) {
        var assigneeUser = task.assignedTo ? users.find(function(u) { return u.login === task.assignedTo; }) : null;
        var assigneeName = task.assignedTo ? formatUserName(task.assignedTo) : 'РЅРµ РЅР°Р·РЅР°С‡РµРЅ';
        var assigneeEmoji = assigneeUser ? (assigneeUser.emoji || 'рџ‘¤') : 'рџ‘¤';
        var priorityLabels = { low: 'РќРёР·РєРёР№', medium: 'РЎСЂРµРґРЅРёР№', high: 'Р’С‹СЃРѕРєРёР№' };
        var statusLabels = { urgent: 'РЎСЂРѕС‡РЅРѕ', in_progress: 'Р’ СЂР°Р±РѕС‚Рµ', done: 'Р’С‹РїРѕР»РЅРµРЅРѕ' };
        var modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:450px;">' +
                '<span class="close-modal" onclick="this.closest(\'.modal\').remove()">&times;</span>' +
                '<h3>' + escapeHtml(task.title) + '</h3>' +
                '<div style="margin-top:1rem;font-size:0.95rem;color:var(--muted);">' +
                    '<p><strong>РћРїРёСЃР°РЅРёРµ:</strong> ' + (task.description ? escapeHtml(task.description) : '<em>РЅРµС‚</em>') + '</p>' +
                    '<p><strong>РЎС‚Р°С‚СѓСЃ:</strong> ' + (statusLabels[task.status] || task.status) + '</p>' +
                    '<p><strong>РџСЂРёРѕСЂРёС‚РµС‚:</strong> ' + (priorityLabels[task.priority] || task.priority) + '</p>' +
                    '<p><strong>РСЃРїРѕР»РЅРёС‚РµР»СЊ:</strong> ' + assigneeEmoji + ' ' + escapeHtml(assigneeName) + '</p>' +
                    '<p><strong>РЎРѕР·РґР°Р»:</strong> ' + escapeHtml(formatUserName(task.createdBy)) + '</p>' +
                    '<p><strong>РЎРѕР·РґР°РЅРѕ:</strong> ' + formatDateTime(task.createdAt) + '</p>' +
                    (task.dueDate ? '<p><strong>РЎСЂРѕРє:</strong> ' + formatDateTime(task.dueDate) + '</p>' : '') +
                    (task.delegated ? '<p><strong>Р”РµР»РµРіРёСЂРѕРІР°РЅРѕ:</strong> ' + (task.delegatedBy === 'admin' ? 'Р СѓРєРѕРІРѕРґРёС‚РµР»РµРј' : 'РЎРѕС‚СЂСѓРґРЅРёРєРѕРј') + '</p>' : '') +
                    (task.updatedAt ? '<p><strong>РћР±РЅРѕРІР»РµРЅРѕ:</strong> ' + formatDateTime(task.updatedAt) + '</p>' : '') +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        positionModalAtPoint(modal, x, y);
        modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    }

    function showReportDetails(report, x, y) {
        var numberLabel = report.reportNumber
            ? 'в„–' + report.reportNumber
            : 'РћС‚С‡С‘С‚';
        var modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:450px;">' +
                '<span class="close-modal">&times;</span>' +
                '<h3>' + escapeHtml(report.title) + '</h3>' +
                '<div style="margin-top:1rem;font-size:0.95rem;color:var(--muted);">' +
                    '<p><strong>РќРѕРјРµСЂ:</strong> ' + escapeHtml(numberLabel) + '</p>' +
                    '<p><strong>РћРїРёСЃР°РЅРёРµ:</strong> ' + (report.description ? escapeHtml(report.description) : '<em>РЅРµС‚</em>') + '</p>' +
                    '<p><strong>РџСЂРёРѕСЂРёС‚РµС‚:</strong> ' + escapeHtml(PRIORITY_LABELS[report.priority] || 'РЎСЂРµРґРЅРёР№') + '</p>' +
                    (report.dueDate ? '<p><strong>РЎСЂРѕРє СЃРґР°С‡Рё:</strong> ' + formatDateTime(report.dueDate) + '</p>' : '') +
                    '<p><strong>РСЃРїРѕР»РЅРёС‚РµР»СЊ:</strong> ' + (report.assignedTo ? escapeHtml(formatUserName(report.assignedTo)) : '<em>РЅРµ РЅР°Р·РЅР°С‡РµРЅ</em>') + '</p>' +
                    (report.delegated ? '<p><strong>Р”РµР»РµРіРёСЂРѕРІР°РЅРѕ:</strong> ' + (report.delegatedBy === 'admin' ? 'Р СѓРєРѕРІРѕРґРёС‚РµР»РµРј' : 'РЎРѕС‚СЂСѓРґРЅРёРєРѕРј') + '</p>' : '') +
                    '<p><strong>РђРІС‚РѕСЂ:</strong> ' + escapeHtml(formatUserName(report.createdBy)) + '</p>' +
                    '<p><strong>РЎРѕР·РґР°РЅ:</strong> ' + formatDateTime(report.createdAt) + '</p>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        if (positionModalAtPoint) positionModalAtPoint(modal, x, y);
        modal.querySelector('.close-modal').addEventListener('click', function() { modal.remove(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    }

    // ---------- Р”РµР»РµРіРёСЂРѕРІР°РЅРёРµ ----------
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
            alert('РќРµС‚ РґРѕСЃС‚СѓРїРЅС‹С… СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ РґР»СЏ РґРµР»РµРіРёСЂРѕРІР°РЅРёСЏ');
            return;
        }
        var modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML =
            '<div class="modal-content" style="max-width:400px;">' +
                '<span class="close-modal" onclick="this.closest(\'.modal\').remove()">&times;</span>' +
                '<h3>Р”РµР»РµРіРёСЂРѕРІР°С‚СЊ ' + escapeHtml(kind) + '</h3>' +
                '<p><strong>' + escapeHtml(item.title) + '</strong></p>' +
                '<div class="form-group">' +
                    '<label for="delegateSelect">Р’С‹Р±РµСЂРёС‚Рµ СЃРѕС‚СЂСѓРґРЅРёРєР°</label>' +
                    '<select id="delegateSelect">' +
                        assignees.map(function(login) {
                            var u = users.find(function(usr) { return usr.login === login; });
                            var label = login + (u && u.role === 'admin' ? ' (Р СѓРєРѕРІРѕРґРёС‚РµР»СЊ)' : '');
                            return '<option value="' + escapeHtml(login) + '" ' + (item.assignedTo === login ? 'selected' : '') + '>' + escapeHtml(label) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
                '<button id="delegateConfirmBtn" class="btn primary">Р”РµР»РµРіРёСЂРѕРІР°С‚СЊ</button>' +
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

    // ---------- РЈРІРµРґРѕРјР»РµРЅРёСЏ РїРѕ РїРѕС‡С‚Рµ ----------
    var PRIORITY_LABELS = { low: 'РќРёР·РєРёР№', medium: 'РЎСЂРµРґРЅРёР№', high: 'Р’С‹СЃРѕРєРёР№' };

    function sendEmailNotification(toLogin, taskData) {
        if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) return;
        if (typeof emailjs === 'undefined') return;
        var user = users.find(function(u) { return u.login === toLogin; });
        var toEmail = user && user.email ? user.email : '';
        if (!toEmail) return;
        var dueDateStr = 'РЅРµ СѓРєР°Р·Р°РЅ';
        if (taskData.dueDate) {
            var dueD = new Date(taskData.dueDate);
            dueDateStr = isNaN(dueD.getTime()) ? 'РЅРµ СѓРєР°Р·Р°РЅ' : dueD.toLocaleDateString('ru-RU');
        }
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: toEmail,
            to_name: toLogin,
            subject: taskData.title || 'РќРѕРІР°СЏ Р·Р°РґР°С‡Р°',
            task_title: taskData.title || '',
            task_description: taskData.description || 'РЅРµС‚ РѕРїРёСЃР°РЅРёСЏ',
            task_priority: PRIORITY_LABELS[taskData.priority] || taskData.priority || 'РЎСЂРµРґРЅРёР№',
            task_due_date: dueDateStr,
            from_name: currentUser.login
        }).then(function(res) {
            console.log('EmailJS: РїРёСЃСЊРјРѕ РѕС‚РїСЂР°РІР»РµРЅРѕ', res);
        }).catch(function(err) {
            console.error('EmailJS: РѕС€РёР±РєР° РѕС‚РїСЂР°РІРєРё', err);
        });
    }

    // ---------- РџРѕРїСѓР»СЏС†РёСЏ select РёСЃРїРѕР»РЅРёС‚РµР»РµР№ ----------
    function populateAssigneeSelect() {
        populateSelect(taskAssignee);
        populateSelect(reportAssignee);
    }

    function populateSelect(select) {
        if (!select) return;
        var currentVal = select.value;
        select.innerHTML = '<option value="">РќРµ РЅР°Р·РЅР°С‡РµРЅ</option>';
        users.forEach(function(u) {
            var opt = document.createElement('option');
            opt.value = u.login;
            opt.textContent = u.login + (u.role === 'admin' ? ' (Р СѓРєРѕРІРѕРґРёС‚РµР»СЊ)' : '');
            select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
    }

    // ---------- РњРѕРґР°Р»СЊРЅРѕРµ РѕРєРЅРѕ Р·Р°РґР°С‡Рё ----------
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
            modalTitle.textContent = 'РќРѕРІС‹Р№ РѕС‚С‡С‘С‚';
            taskId.value = '';
            taskTitle.value = '';
            taskDesc.value = '';
            taskStatus.value = 'reports';
            taskPriority.value = 'medium';
            taskDueDate.value = '';
            taskAssignee.value = '';
        } else if (taskData) {
            modalTitle.textContent = 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ Р·Р°РґР°С‡Сѓ';
            taskId.value = taskData.id;
            taskTitle.value = taskData.title;
            taskDesc.value = taskData.description || '';
            taskStatus.value = taskData.status || 'in_progress';
            taskPriority.value = taskData.priority || 'medium';
            taskDueDate.value = DeadlineHelpers.toDateTimeLocalValue(taskData.dueDate);
            taskAssignee.value = taskData.assignedTo || '';
        } else {
            modalTitle.textContent = 'РќРѕРІР°СЏ Р·Р°РґР°С‡Р°';
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
            modalTitle.textContent = currentItemMode === 'report' ? 'РќРѕРІС‹Р№ РѕС‚С‡С‘С‚' : 'РќРѕРІР°СЏ Р·Р°РґР°С‡Р°';
        });
    }

    function openReportModal(reportData, x, y) {
        if (reportData) {
            reportModalTitle.textContent = 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РѕС‚С‡С‘С‚';
            reportId.value = reportData.id;
            reportTitle.value = reportData.title || '';
            reportDesc.value = reportData.description || '';
            reportPriority.value = reportData.priority || 'medium';
            reportDueDate.value = DeadlineHelpers.toDateTimeLocalValue(reportData.dueDate);
            reportAssignee.value = reportData.assignedTo || '';
            document.getElementById('reportStatus').value = 'reports';
        } else {
            reportModalTitle.textContent = 'РќРѕРІС‹Р№ РѕС‚С‡С‘С‚';
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
        // РќРѕСЂРјР°Р»РёР·СѓРµРј СЃСЂРѕРє РІ ISO-СЃС‚СЂРѕРєСѓ (UTC), С‡С‚РѕР±С‹ РµРґРёРЅС‹Р№ С„РѕСЂРјР°С‚ РґР°С‚
        // РєРѕСЂСЂРµРєС‚РЅРѕ РѕР±СЂР°Р±Р°С‚С‹РІР°Р»СЃСЏ РІРѕ РІСЃРµС… Р±СЂР°СѓР·РµСЂР°С… Рё С„СѓРЅРєС†РёСЏС… РїСЂРёР»РѕР¶РµРЅРёСЏ.
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
        // РќРѕСЂРјР°Р»РёР·СѓРµРј СЃСЂРѕРє РІ ISO-СЃС‚СЂРѕРєСѓ (UTC), С‡С‚РѕР±С‹ РµРґРёРЅС‹Р№ С„РѕСЂРјР°С‚ РґР°С‚
        // РєРѕСЂСЂРµРєС‚РЅРѕ РѕР±СЂР°Р±Р°С‚С‹РІР°Р»СЃСЏ РІРѕ РІСЃРµС… Р±СЂР°СѓР·РµСЂР°С… Рё С„СѓРЅРєС†РёСЏС… РїСЂРёР»РѕР¶РµРЅРёСЏ.
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
                    alert('Р’С‹ РЅРµ РјРѕР¶РµС‚Рµ СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ СЌС‚Сѓ Р·Р°РґР°С‡Сѓ');
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

    // ---------- РџРµСЂРµРєР»СЋС‡Р°С‚РµР»СЊ РІРєР»Р°РґРѕРє ----------
    if (viewTasksBtn) viewTasksBtn.addEventListener('click', function() { switchView('tasks'); });
    if (viewReportsBtn) viewReportsBtn.addEventListener('click', function() { switchView('reports'); });
    if (employeeFilter) employeeFilter.addEventListener('change', function() {
        selectedEmployee = employeeFilter.value;
        renderBoard();
    });

    // ---------- РЎРѕР·РґР°РЅРёРµ РїРѕ РґРІРѕР№РЅРѕРјСѓ РєР»РёРєСѓ РІ РєРѕР»РѕРЅРєРµ ----------
    // Р”РІРѕР№РЅРѕР№ РєР»РёРє/С‚Р°Рї РїРѕ РїСѓСЃС‚РѕРјСѓ РјРµСЃС‚Сѓ РєРѕР»РѕРЅРєРё РѕС‚РєСЂС‹РІР°РµС‚ РјРѕРґР°Р»РєСѓ СЃРѕР·РґР°РЅРёСЏ
    // СЃ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРѕРґСЃС‚Р°РІР»РµРЅРЅС‹Рј СЃС‚Р°С‚СѓСЃРѕРј СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РµР№ РєРѕР»РѕРЅРєРё:
    // В«РЎСЂРѕС‡РЅС‹РµВ» -> urgent, В«Р’ СЂР°Р±РѕС‚РµВ» -> in_progress, В«РћС‚С‡С‘С‚С‹В» -> СЂРµР¶РёРј РѕС‚С‡С‘С‚Р°.
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

    // ---------- РњРѕР±РёР»СЊРЅС‹Рµ РєРЅРѕРїРєРё ----------
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

    // ---------- Р”СЂРѕРїРґР°СѓРЅ РЅР°СЃС‚СЂРѕРµРє (РґРµСЃРєС‚РѕРї) ----------
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

    // ---------- Р­РєСЃРїРѕСЂС‚ Excel ----------
    exportBtn.addEventListener('click', function() {
        if (typeof XLSX === 'undefined') {
            alert('Р‘РёР±Р»РёРѕС‚РµРєР° XLSX РЅРµ Р·Р°РіСЂСѓР¶РµРЅР°. РџСЂРѕРІРµСЂСЊС‚Рµ РёРЅС‚РµСЂРЅРµС‚-СЃРѕРµРґРёРЅРµРЅРёРµ.');
            return;
        }
        var dataToExport = tasks.map(function(t) {
            return {
                'ID': t.id,
                'Р—Р°РіРѕР»РѕРІРѕРє': t.title,
                'РћРїРёСЃР°РЅРёРµ': t.description || '',
                'РЎС‚Р°С‚СѓСЃ': t.status === 'urgent' ? 'РЎСЂРѕС‡РЅРѕ' : (t.status === 'in_progress' ? 'Р’ СЂР°Р±РѕС‚Рµ' : 'Р’С‹РїРѕР»РЅРµРЅРѕ'),
                'РЎРѕР·РґР°Р»': formatUserName(t.createdBy),
                'РСЃРїРѕР»РЅРёС‚РµР»СЊ': formatUserName(t.assignedTo),
                'РџСЂРёРѕСЂРёС‚РµС‚': t.priority || 'medium',
                'РЎСЂРѕРє': formatDateTime(t.dueDate),
                'Р”РµР»РµРіРёСЂРѕРІР°РЅРѕ': t.delegated ? (t.delegatedBy === 'admin' ? 'Р СѓРєРѕРІРѕРґРёС‚РµР»РµРј' : 'РЎРѕС‚СЂСѓРґРЅРёРєРѕРј') : '',
                'РЎРѕР·РґР°РЅРѕ': formatDateTime(t.createdAt),
                'РћР±РЅРѕРІР»РµРЅРѕ': formatDateTime(t.updatedAt)
            };
        });
        if (dataToExport.length === 0) {
            alert('РќРµС‚ Р·Р°РґР°С‡ РґР»СЏ СЌРєСЃРїРѕСЂС‚Р°');
            return;
        }
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [
            {wch:12}, {wch:25}, {wch:30}, {wch:15}, {wch:12},
            {wch:12}, {wch:10}, {wch:12}, {wch:25}, {wch:20}
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Р—Р°РґР°С‡Рё');
        XLSX.writeFile(wb, 'Р—Р°РґР°С‡Рё_' + new Date().toISOString().slice(0,10) + '.xlsx');
    });

    // ---------- РРјРїРѕСЂС‚ Excel ----------
    importBtn.addEventListener('click', function() {
        if (typeof XLSX === 'undefined') {
            alert('Р‘РёР±Р»РёРѕС‚РµРєР° XLSX РЅРµ Р·Р°РіСЂСѓР¶РµРЅР°. РџСЂРѕРІРµСЂСЊС‚Рµ РёРЅС‚РµСЂРЅРµС‚-СЃРѕРµРґРёРЅРµРЅРёРµ.');
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
                            title: row['Р—Р°РіРѕР»РѕРІРѕРє'] || existing.title,
                            description: row['РћРїРёСЃР°РЅРёРµ'] || existing.description,
                            status: row['РЎС‚Р°С‚СѓСЃ'] === 'РЎСЂРѕС‡РЅРѕ' ? 'urgent' : (row['РЎС‚Р°С‚СѓСЃ'] === 'Р’ СЂР°Р±РѕС‚Рµ' ? 'in_progress' : 'done'),
                            assignedTo: row['РСЃРїРѕР»РЅРёС‚РµР»СЊ'] || existing.assignedTo,
                            priority: row['РџСЂРёРѕСЂРёС‚РµС‚'] || existing.priority,
                            dueDate: DeadlineHelpers.normalizeDueDate(row['РЎСЂРѕРє']) || existing.dueDate,
                            updatedAt: new Date().toISOString()
                        });
                        saveTask(updated);
                    } else {
                        var newTask = {
                            id: id,
                            title: row['Р—Р°РіРѕР»РѕРІРѕРє'] || 'Р‘РµР· РЅР°Р·РІР°РЅРёСЏ',
                            description: row['РћРїРёСЃР°РЅРёРµ'] || '',
                            status: row['РЎС‚Р°С‚СѓСЃ'] === 'РЎСЂРѕС‡РЅРѕ' ? 'urgent' : (row['РЎС‚Р°С‚СѓСЃ'] === 'Р’ СЂР°Р±РѕС‚Рµ' ? 'in_progress' : 'done'),
                            createdBy: row['РЎРѕР·РґР°Р»'] || currentUser.login,
                            assignedTo: row['РСЃРїРѕР»РЅРёС‚РµР»СЊ'] || '',
                            priority: row['РџСЂРёРѕСЂРёС‚РµС‚'] || 'medium',
                            dueDate: DeadlineHelpers.normalizeDueDate(row['РЎСЂРѕРє']) || '',
                            createdAt: row['РЎРѕР·РґР°РЅРѕ'] ? new Date(row['РЎРѕР·РґР°РЅРѕ']).toISOString() : new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        saveTask(newTask);
                        added++;
                    }
                });
                alert('РРјРїРѕСЂС‚ Р·Р°РІРµСЂС€С‘РЅ. Р”РѕР±Р°РІР»РµРЅРѕ ' + added + ' РЅРѕРІС‹С… Р·Р°РґР°С‡.');
            } catch(err) {
                alert('РћС€РёР±РєР° РїСЂРё РёРјРїРѕСЂС‚Рµ: ' + err.message);
            }
            fileInput.value = '';
        };
        reader.readAsArrayBuffer(file);
    });

    // ---------- Р’СЃРїРѕРјРѕРіР°С‚РµР»СЊРЅС‹Рµ С„СѓРЅРєС†РёРё ----------
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
        if (!login) return 'вЂ”';
        var u = users.find(function(u) { return u.login === login; });
        if (u && u.name) return u.name;
        if (u && u.role === 'admin') return 'Р СѓРєРѕРІРѕРґРёС‚РµР»СЊ';
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
        return DeadlineHelpers.itemVisibleToUser(report, currentUser.login, currentUser.role === 'admin', selectedEmployee);
    }

    function createReportCard(report) {
        const div = document.createElement('div');
        var stripClass = DeadlineHelpers.deadlineStripClassFromDate(report.dueDate);
        div.className = 'task-card report-card priority-' + (report.priority || 'medium') + ' ' + stripClass;
        div.dataset.id = report.id;
        if (report.dueDate) {
            div.setAttribute('role', 'listitem');
            div.setAttribute('aria-label', (report.title || 'РћС‚С‡С‘С‚') + '. ' + deadlineStatusLabel(report.dueDate));
        }

        var numberLabel = report.reportNumber
            ? 'в„–' + report.reportNumber
            : 'РћС‚С‡С‘С‚';
        var assigneeLabel = report.assignedTo ? 'рџ‘¤ ' + escapeHtml(formatUserName(report.assignedTo)) : '';

        div.innerHTML =
            (report.delegated
                ? '<span class="task-delegate-arrow ' + (report.assignedTo === currentUser.login ? 'arrow-received' : 'arrow-delegated') + '">' + (report.assignedTo === currentUser.login ? 'в†™' : 'в†—') + '</span>'
                : '') +
            '<div class="task-title">' + escapeHtml(report.title || 'Р‘РµР· РЅР°Р·РІР°РЅРёСЏ') + '</div>' +
            '<div class="task-meta">' +
                '<span>рџ“„ ' + escapeHtml(numberLabel) + '</span>' +
                (report.dueDate ? '<span><i class="fa-regular fa-calendar"></i> ' + formatDateTime(report.dueDate) + '</span>' : '') +
                (assigneeLabel ? '<span>' + assigneeLabel + '</span>' : '') +
                '<span>рџ‘¤ ' + escapeHtml(formatUserName(report.createdBy)) + '</span>' +
            '</div>' +
            '<div class="task-actions-row1">' +
                '<button class="btn-done" data-action="done"><i class="fa-solid fa-check"></i> Р’С‹РїРѕР»РЅРёС‚СЊ</button>' +
                (report.status !== 'done' && (currentUser.role === 'admin' || currentUser.login === report.createdBy)
                    ? '<button class="btn-delegate" data-action="delegate"><i class="fa-solid fa-paper-plane"></i> Р”РµР»РµРіРёСЂРѕРІР°С‚СЊ</button>'
                    : '') +
            '</div>' +
            '<div class="task-actions-row2">' +
                (currentUser.role === 'admin'
                    ? '<button class="btn-delete" data-action="delete" title="РЈРґР°Р»РёС‚СЊ"><i class="fa-solid fa-trash"></i></button>'
                    : '') +
                '<button class="btn-settings" data-action="settings" title="РР·РјРµРЅРёС‚СЊ"><i class="fa-solid fa-gear"></i></button>' +
                '<button class="btn-open" data-action="open" title="РћС‚РєСЂС‹С‚СЊ"><i class="fa-solid fa-circle-info"></i></button>' +
            '</div>';

        div.querySelectorAll('[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var action = this.dataset.action;
                var x = e.clientX;
                var y = e.clientY;
                if (action === 'delete') {
                    if (confirm('РЈРґР°Р»РёС‚СЊ РѕС‚С‡С‘С‚?')) {
                        removeReport(report.id);
                    }
                } else if (action === 'done') {
                    changeReportStatus(report.id, 'done');
                } else if (action === 'delegate') {
                    showDelegateModal(report, saveReport, 'РѕС‚С‡С‘С‚', x, y);
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
            list.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem;text-align:center;padding:1rem 0;">РќРµС‚ РѕС‚С‡С‘С‚РѕРІ</p>';
            return;
        }
        visible.forEach(function(r) {
            list.appendChild(createReportCard(r));
        });
    }

    // ---------- Р—Р°РїСѓСЃРє ----------
    // РџСЂРёРІРµС‚СЃС‚РІРёРµ Рё С‚РµРєСѓС‰Р°СЏ РґР°С‚Р° РІ С€Р°РїРєРµ (РёРјСЏ РїРѕРґС‚СЏРіРёРІР°РµС‚СЃСЏ РёР· РїСЂРѕС„РёР»СЏ/СЃРµСЃСЃРёРё)
    function updateHeaderGreeting(user) {
        var greetEl = document.getElementById('greeting');
        var dateEl = document.getElementById('currentDate');
        if (greetEl) {
            var now = new Date();
            var h = now.getHours();
            var greetingText = h < 5 ? 'Р”РѕР±СЂРѕР№ РЅРѕС‡Рё' : h < 12 ? 'Р”РѕР±СЂРѕРµ СѓС‚СЂРѕ' : h < 18 ? 'Р”РѕР±СЂС‹Р№ РґРµРЅСЊ' : 'Р”РѕР±СЂС‹Р№ РІРµС‡РµСЂ';
            var displayName = (user && user.name) || (user && user.login) || '';
            greetEl.textContent = displayName ? greetingText + ', ' + displayName + '!' : greetingText + '!';
        }
        if (dateEl) {
            var now2 = new Date();
            var s = now2.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
            dateEl.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        }
    }

    updateHeaderGreeting(null); // РџРѕРєР°Р·С‹РІР°РµРј РїСЂРёРІРµС‚СЃС‚РІРёРµ/РґР°С‚Сѓ РґРѕ Р°РІС‚РѕСЂРёР·Р°С†РёРё

    // Р–РґС‘Рј Р·Р°РіСЂСѓР·РєРё Firebase SDK
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
