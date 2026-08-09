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

    function deadlineStripClass(daysLeft) {
        if (daysLeft === null || typeof daysLeft === 'undefined') return 'strip-none';
        if (daysLeft > 5) return 'strip-ok';
        if (daysLeft >= 4) return 'strip-warn';
        if (daysLeft >= 3) return 'strip-orange';
        if (daysLeft >= 2) return 'strip-coral';
        if (daysLeft >= 1) return 'strip-red';
        return 'strip-overdue';
    }

    function isCompletedLate(completedAtStr, dueDateStr) {
        if (!completedAtStr || !dueDateStr) return false;
        var completed = new Date(completedAtStr);
        var due = new Date(dueDateStr);
        if (isNaN(completed.getTime()) || isNaN(due.getTime())) return false;
        return completed.getTime() > due.getTime();
    }

    function doneStripClass(completedAt, dueDate, completedLate) {
        if (completedLate) return 'strip-overdue';
        if (completedAt) return 'strip-ok';
        return deadlineStripClass(calendarDaysUntil(dueDate));
    }

    return {
        calendarDaysUntil: calendarDaysUntil,
        deadlineStripClass: deadlineStripClass,
        isCompletedLate: isCompletedLate,
        doneStripClass: doneStripClass
    };
}));
