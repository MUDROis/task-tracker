// Чистые функции расчёта полоски срока и отметки просрочки.
// В браузере доступны как window.DeadlineHelpers, в Node — через require().
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DeadlineHelpers = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var DAY_MS = 24 * 60 * 60 * 1000;

    function startOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }

    function calendarDaysUntil(dueDateStr) {
        if (!dueDateStr) return null;
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return null;
        var now = new Date();
        return Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
    }

    // ====================================================================
    //  Новая time-based логика индикации дедлайна (по ТЗ).
    //  Сравнивает конкретный момент времени (new Date()) с дедлайном задачи.
    //  Возвращает ключ статуса, который затем маппится в CSS-класс/HEX.
    // --------------------------------------------------------------------
    //  Статус               | Условие                                 | Класс          | Цвет
    //  ---------------------|-----------------------------------------|----------------|-----------
    //  Приближается (далеко)| более 4 дней или ровно 4 дня (96 часов) | strip-far      | #00a550
    //  Приближается (2 дня) | ровно 2 дня (48 часов)                  | strip-close    | #4cbb17
    //  Приближается (1 день)| ровно 1 день (24 часа)                  | strip-soon     | #F1C40F
    //  День дедлайна        | день наступил, время до 12:00            | strip-day      | #ced23a
    //  Просрочено (день)    | день наступил, время >= 17:00            | strip-red      | #E74C3C
    //  Просрочено (след.дни)| прошло более 1 дня с дедлайна            | strip-overdue  | #8B0000
    //  Нет дедлайна         | дедлайн не задан / некорректный          | strip-none     | #64748b
    // ====================================================================
    var HOUR_MS = 3600 * 1000;

    function isSameCalendarDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth() === b.getMonth() &&
               a.getDate() === b.getDate();
    }

    function getDeadlineStatus(dueDateStr) {
        if (!dueDateStr) return 'none';
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return 'none';

        var now = new Date();
        var diffMs = due.getTime() - now.getTime(); // > 0 => ещё не наступил

        // 1. Просрочено (след. дни): с момента дедлайна прошло более одних суток.
        if (diffMs < 0 && -diffMs > DAY_MS) return 'odays';

        // 2. Сегодня — день дедлайна.
        if (isSameCalendarDay(now, due)) {
            if (diffMs < 0 && now.getHours() >= 17) return 'oday'; // время уже >= 17:00 — просрочено
            return 'day';                                          // день дедлайна, ещё успеваем (до 17:00)
        }

        // 3. Дедлайн уже позади, но меньше суток назад и не сегодня — просрочено.
        if (diffMs < 0) return 'odays';

        // 4. Пока дедлайн впереди (не сегодня) — оцениваем по количеству полных суток.
        var diffHours = diffMs / HOUR_MS;
        var fullDays = Math.ceil(diffHours / 24); // сколько полных суток до дедлайна
        // ровно 1 день (24 часа) — желтый
        if (fullDays <= 1) return 'soon';
        // ровно 2 дня (48 часов) — ирландский зелёный
        if (fullDays === 2) return 'close';
        // более 4 дней или ровно 4 дня (96 часов) — зелёный
        return 'far';
    }

    // Маппинг статуса дедлайна в CSS-класс левой полосы карточки.
    function deadlineStripClassFromDate(dueDateStr) {
        var status = getDeadlineStatus(dueDateStr);
        var map = {
            'far': 'strip-far',
            'close': 'strip-close',
            'soon': 'strip-soon',
            'day': 'strip-day',
            'oday': 'strip-red',
            'odays': 'strip-overdue',
            'none': 'strip-none'
        };
        return map[status] || 'strip-none';
    }

    // Устаревшая числовая версия (по календарным дням) — сохранена для обратной
    // совместимости со старыми вызовами и строкой архива.
    // Маппинг согласован с новой схемой: 4+ дня — зелёный, 2 дня — ирландский,
    // 1 день — жёлтый, сегодня — жёлто-зелёный, просрочено — бордовый.
    function deadlineStripClass(daysLeft) {
        if (daysLeft === null || typeof daysLeft === 'undefined') return 'strip-none';
        if (daysLeft > 2) return 'strip-far';
        if (daysLeft === 2) return 'strip-close';
        if (daysLeft === 1) return 'strip-soon';
        if (daysLeft === 0) return 'strip-day';
        return 'strip-overdue';
    }

    function isCompletedLate(completedAtStr, dueDateStr) {
        if (!completedAtStr || !dueDateStr) return false;
        var completed = new Date(completedAtStr);
        var due = new Date(dueDateStr);
        if (isNaN(completed.getTime()) || isNaN(due.getTime())) return false;
        return completed.getTime() > due.getTime();
    }

    // Нормализует значение срока выполнения (из datetime-local "YYYY-MM-DDTHH:mm"
    // или уже готовой ISO-строки) в каноническую ISO-строку (UTC) для хранения в Firebase.
    // Пустое/нераспознанное значение -> '' (пустая строка), чтобы не ломать
    // последующий разбор дат в других браузерах (RangeError: Invalid time value).
    function normalizeDueDate(value) {
        if (!value) return '';
        var d = new Date(value);
        if (isNaN(d.getTime())) return '';
        return d.toISOString();
    }

    // Обратное преобразование ISO-строки в формат datetime-local (YYYY-MM-DDTHH:mm)
    // для корректного заполнения полей ввода при редактировании задачи/отчёта.
    function toDateTimeLocalValue(value) {
        if (!value) return '';
        var d = new Date(value);
        if (isNaN(d.getTime())) return '';
        function pad(n) { return n < 10 ? '0' + n : String(n); }
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
               'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function doneStripClass(completedAt, dueDate, completedLate) {
        if (completedLate) return 'strip-overdue';
        if (completedAt) return 'strip-ok';
        return deadlineStripClass(calendarDaysUntil(dueDate));
    }

    // Сводка для кольца статистики: {total, done, pct} по доступным пользователю задачам и отчётам.
    function statsSummary(tasks, reports, login, isAdmin) {
        var visible = isAdmin ? function () { return true; } : function (item) {
            return item.createdBy === login || item.assignedTo === login;
        };
        var all = [].concat(tasks || [], reports || []).filter(visible);
        var done = all.filter(function (item) { return item.status === 'done'; }).length;
        return {
            total: all.length,
            done: done,
            pct: all.length ? Math.round(done / all.length * 100) : 0
        };
    }

    // Видимость элемента для пользователя: не-админ — только своё
    // (createdBy === login || assignedTo === login), админ — всё.
    // selectedEmployee применяется только для админа.
    function itemVisibleToUser(item, login, isAdmin, selectedEmployee) {
        if (!item) return false;
        if (!isAdmin && item.createdBy !== login && item.assignedTo !== login) return false;
        if (isAdmin && selectedEmployee) {
            return item.createdBy === selectedEmployee || item.assignedTo === selectedEmployee;
        }
        return true;
    }

    // Задачи, видимые пользователю (учётка роли и фильтра по сотруднику).
    function visibleTasks(tasks, login, isAdmin, selectedEmployee) {
        return (tasks || []).filter(function (t) {
            return itemVisibleToUser(t, login, isAdmin, selectedEmployee);
        });
    }

    // Отчёты, видимые пользователю (учётка роли и фильтра по сотруднику).
    function visibleReports(reports, login, isAdmin, selectedEmployee) {
        return (reports || []).filter(function (r) {
            return itemVisibleToUser(r, login, isAdmin, selectedEmployee);
        });
    }

    // ====================================================================
    //  Роли, права (чекбоксы функций) и иерархическая видимость.
    //  Полный перечень функций системы — ровно 15 пунктов (по ТЗ).
    // ====================================================================
    var ROLES = {
        manager: { label: 'Менеджер (админ)', description: 'Полный доступ ко всем функциям системы.' },
        management: { label: 'Управление', description: 'Административная роль; не может удалять/редактировать сотрудников Менеджера и удалять задачи.' },
        department: { label: 'Отдел', description: 'Отдел; не управляет сотрудниками и не назначает задачи Управлению.' },
        specialist: { label: 'Специалист', description: 'Базовая роль для работы с задачами.' }
    };

    var PERMISSIONS = [
        { key: 'addEmployees', label: 'Добавлять сотрудников' },
        { key: 'deleteEmployees', label: 'Удалять сотрудников' },
        { key: 'editEmployees', label: 'Редактировать сотрудников' },
        { key: 'deleteManagerEmployees', label: 'Удалять сотрудников, созданных Менеджером' },
        { key: 'editManagerEmployees', label: 'Редактировать сотрудников, добавленных Менеджером' },
        { key: 'assignTasksToManagement', label: 'Назначать задачи Управлению' },
        { key: 'assignTasksToDepartment', label: 'Назначать задачи Отделу' },
        { key: 'assignTasksToSpecialist', label: 'Назначать задачи Специалистам' },
        { key: 'createTasks', label: 'Создавать задачи' },
        { key: 'editTasks', label: 'Редактировать задачи' },
        { key: 'deleteTasks', label: 'Удалять задачи' },
        { key: 'manageRoles', label: 'Управлять ролями и правами пользователей' },
        { key: 'viewReports', label: 'Просматривать отчёты и аналитику' },
        { key: 'exportData', label: 'Экспортировать данные' },
        { key: 'systemSettings', label: 'Настраивать систему' }
    ];

    function allTrue() {
        var out = {};
        PERMISSIONS.forEach(function (p) { out[p.key] = true; });
        return out;
    }

    var ROLE_PRESETS = {
        manager: allTrue(),
        management: (function () {
            var o = allTrue();
            o.deleteManagerEmployees = false;
            o.editManagerEmployees = false;
            o.deleteTasks = false;
            o.manageRoles = false;
            o.systemSettings = false;
            return o;
        }()),
        department: (function () {
            var o = allTrue();
            o.addEmployees = false;
            o.deleteEmployees = false;
            o.editEmployees = false;
            o.deleteManagerEmployees = false;
            o.editManagerEmployees = false;
            o.assignTasksToManagement = false;
            o.deleteTasks = false;
            o.manageRoles = false;
            o.exportData = false;
            o.systemSettings = false;
            return o;
        }()),
        specialist: (function () {
            var o = allTrue();
            o.addEmployees = false;
            o.deleteEmployees = false;
            o.editEmployees = false;
            o.deleteManagerEmployees = false;
            o.editManagerEmployees = false;
            o.assignTasksToManagement = false;
            o.assignTasksToDepartment = false;
            o.deleteTasks = false;
            o.manageRoles = false;
            o.viewReports = false;
            o.exportData = false;
            o.systemSettings = false;
            return o;
        }())
    };

    function copyMap(src) {
        return JSON.parse(JSON.stringify(src || {}));
    }

    // Нормализует пользователя из БД: миграция старых ролей admin/employee,
    // подстановка пресета прав, если permissions не задан.
    function normalizeUser(u) {
        u = u || {};
        var role = u.role || 'specialist';
        if (role === 'admin') role = 'manager';
        if (role === 'employee') role = 'specialist';
        if (!ROLES[role]) role = 'specialist';
        return {
            uid: u.uid || '',
            login: u.login,
            name: u.name || '',
            role: role,
            permissions: u.permissions ? copyMap(u.permissions) : copyMap(ROLE_PRESETS[role]),
            email: u.email || '',
            color: u.color || '',
            emoji: u.emoji || '',
            createdBy: u.createdBy || '',
            createdAt: u.createdAt || ''
        };
    }

    function isManager(user) {
        return !!(user && user.role === 'manager');
    }

    function canDo(user, permissionKey) {
        if (!user) return false;
        if (user.role === 'manager') return true;
        return !!(user.permissions && user.permissions[permissionKey] === true);
    }

    function canAssignTo(user, targetRole) {
        if (!user) return false;
        if (user.role === 'manager') return true;
        var map = {
            management: 'assignTasksToManagement',
            department: 'assignTasksToDepartment',
            specialist: 'assignTasksToSpecialist'
        };
        var key = map[targetRole];
        if (!key) return false;
        return !!(user.permissions && user.permissions[key] === true);
    }

    // Логины сотрудников, подчинённых login по цепочке createdBy (рекурсивно).
    function collectSubordinateLogins(login, usersArr) {
        var list = usersArr || [];
        var result = [];
        var seen = {};
        function visit(current) {
            list.forEach(function (u) {
                if (u.createdBy === current && !seen[u.login]) {
                    seen[u.login] = true;
                    result.push(u.login);
                    visit(u.login);
                }
            });
        }
        visit(login);
        return result;
    }

    // Главный фильтр видимости с учётом роли.
    // manager/management — всё; department — своё + подчинённые по цепочке
    // createdBy (а также назначенное лично и делегированное им); specialist — своё.
    function visibleHierarchyItems(items, login, role, usersArr) {
        if (role === 'manager' || role === 'management') {
            return (items || []).slice();
        }
        var mine = {};
        mine[login] = true;
        if (role === 'department') {
            collectSubordinateLogins(login, usersArr).forEach(function (s) { mine[s] = true; });
        }
        return (items || []).filter(function (item) {
            return mine[item.createdBy] === true || item.assignedTo === login || item.delegatedBy === login;
        });
    }

    function visibleHierarchyTasks(tasks, login, role, usersArr) {
        return visibleHierarchyItems(tasks, login, role, usersArr);
    }

    function visibleHierarchyReports(reports, login, role, usersArr) {
        return visibleHierarchyItems(reports, login, role, usersArr);
    }

    return {
        calendarDaysUntil: calendarDaysUntil,
        deadlineStripClass: deadlineStripClass,
        deadlineStripClassFromDate: deadlineStripClassFromDate,
        getDeadlineStatus: getDeadlineStatus,
        isCompletedLate: isCompletedLate,
        normalizeDueDate: normalizeDueDate,
        toDateTimeLocalValue: toDateTimeLocalValue,
        doneStripClass: doneStripClass,
        statsSummary: statsSummary,
        itemVisibleToUser: itemVisibleToUser,
        visibleTasks: visibleTasks,
        visibleReports: visibleReports,
        ROLES: ROLES,
        PERMISSIONS: PERMISSIONS,
        ROLE_PRESETS: ROLE_PRESETS,
        normalizeUser: normalizeUser,
        canDo: canDo,
        canAssignTo: canAssignTo,
        isManager: isManager,
        collectSubordinateLogins: collectSubordinateLogins,
        visibleHierarchyTasks: visibleHierarchyTasks,
        visibleHierarchyReports: visibleHierarchyReports
    };
}));
