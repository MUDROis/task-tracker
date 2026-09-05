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

    return {
        calendarDaysUntil: calendarDaysUntil,
        deadlineStripClass: deadlineStripClass,
        deadlineStripClassFromDate: deadlineStripClassFromDate,
        getDeadlineStatus: getDeadlineStatus,
        isCompletedLate: isCompletedLate,
        normalizeDueDate: normalizeDueDate,
        toDateTimeLocalValue: toDateTimeLocalValue,
        doneStripClass: doneStripClass,
        statsSummary: statsSummary
    };
}));
