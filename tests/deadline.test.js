const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/helpers.js');

function daysFromNow(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
}

function hoursFromNow(n) {
    return new Date(Date.now() + n * 3600000).toISOString();
}

test('calendarDaysUntil: считает календарные дни', function() {
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(6)), 6);
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(3)), 3);
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(0)), 0);
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(-2)), -2);
});

test('calendarDaysUntil: null для отсутствующей/неверной даты', function() {
    assert.strictEqual(H.calendarDaysUntil(''), null);
    assert.strictEqual(H.calendarDaysUntil('not-a-date'), null);
});

test('getDeadlineStatus: дальний срок (более/ровно 4 дня) — far', function() {
    assert.strictEqual(H.getDeadlineStatus(daysFromNow(7)), 'far');
    assert.strictEqual(H.getDeadlineStatus(hoursFromNow(120)), 'far');   // 5 дней
    assert.strictEqual(H.getDeadlineStatus(hoursFromNow(96)), 'far');    // ровно 4 дня
});

test('getDeadlineStatus: ровно 2 дня — close', function() {
    assert.strictEqual(H.getDeadlineStatus(hoursFromNow(48)), 'close');
});

test('getDeadlineStatus: ровно 1 день — soon', function() {
    assert.strictEqual(H.getDeadlineStatus(hoursFromNow(24)), 'soon');
});

test('getDeadlineStatus: просрочено более суток назад — odays', function() {
    assert.strictEqual(H.getDeadlineStatus(daysFromNow(-2)), 'odays');
    assert.strictEqual(H.getDeadlineStatus(hoursFromNow(-30)), 'odays');
});

test('getDeadlineStatus: сегодня день сдачи — day/oday в зависимости от времени', function() {
    var now = new Date();
    var hour = now.getHours();
    if (hour < 17) {
        // Дедлайн сегодня на 18:00 ещё не наступил — день сдачи.
        var todayDue = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
        assert.strictEqual(H.getDeadlineStatus(todayDue.toISOString()), 'day');
    } else {
        // Время уже >= 17:00, дедлайн был сегодня на 12:00 — просрочено сегодня.
        var pastDue = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
        assert.strictEqual(H.getDeadlineStatus(pastDue.toISOString()), 'oday');
    }
});

test('getDeadlineStatus: без дедлайна/неверная дата — none', function() {
    assert.strictEqual(H.getDeadlineStatus(''), 'none');
    assert.strictEqual(H.getDeadlineStatus(null), 'none');
    assert.strictEqual(H.getDeadlineStatus('not-a-date'), 'none');
});

test('deadlineStripClassFromDate: маппинг статуса в CSS-класс полосы', function() {
    assert.strictEqual(H.deadlineStripClassFromDate(daysFromNow(7)), 'strip-far');
    assert.strictEqual(H.deadlineStripClassFromDate(hoursFromNow(48)), 'strip-close');
    assert.strictEqual(H.deadlineStripClassFromDate(hoursFromNow(24)), 'strip-soon');
    assert.strictEqual(H.deadlineStripClassFromDate(daysFromNow(-2)), 'strip-overdue');
    assert.strictEqual(H.deadlineStripClassFromDate(''), 'strip-none');
});

test('deadlineStripClass: числовая совместимость по новой схеме', function() {
    assert.strictEqual(H.deadlineStripClass(6), 'strip-far');
    assert.strictEqual(H.deadlineStripClass(4), 'strip-far');
    assert.strictEqual(H.deadlineStripClass(3), 'strip-far');
    assert.strictEqual(H.deadlineStripClass(2), 'strip-close');
    assert.strictEqual(H.deadlineStripClass(1), 'strip-soon');
    assert.strictEqual(H.deadlineStripClass(0), 'strip-day');
    assert.strictEqual(H.deadlineStripClass(-5), 'strip-overdue');
    assert.strictEqual(H.deadlineStripClass(null), 'strip-none');
});

test('isCompletedLate: сравнение точного времени выполнения и срока', function() {
    assert.strictEqual(H.isCompletedLate(daysFromNow(2), daysFromNow(3)), false);
    assert.strictEqual(H.isCompletedLate(daysFromNow(3), daysFromNow(2)), true);
    assert.strictEqual(H.isCompletedLate('', daysFromNow(2)), false);
    assert.strictEqual(H.isCompletedLate(daysFromNow(2), ''), false);
});

test('doneStripClass: бордовый при просрочке, зелёный в срок, текущая срочность без отметки', function() {
    assert.strictEqual(H.doneStripClass(daysFromNow(2), daysFromNow(3), true), 'strip-overdue');
    assert.strictEqual(H.doneStripClass(daysFromNow(2), daysFromNow(3), false), 'strip-ok');
    assert.strictEqual(H.doneStripClass('', daysFromNow(10), undefined), 'strip-far');
    assert.strictEqual(H.doneStripClass('', '', undefined), 'strip-none');
});

test('normalizeDueDate: формат datetime-local в ISO-строку (UTC)', function() {
    var src = new Date();
    var pad = function(n) { return (n < 10 ? '0' : '') + n; };
    var local = src.getFullYear() + '-' + pad(src.getMonth() + 1) + '-' + pad(src.getDate()) +
                'T' + pad(src.getHours()) + ':' + pad(src.getMinutes());
    var normalized = H.normalizeDueDate(local);
    assert.ok(normalized);
    var d = new Date(normalized);
    assert.strictEqual(isNaN(d.getTime()), false);
    // Круглые сутки/часы не меняются: минуты исходного времени сохраняются.
    assert.strictEqual(d.getMinutes(), src.getMinutes());
});

test('normalizeDueDate: корректно парсит уже ISO-строку (idempotent)', function() {
    var iso = new Date().toISOString();
    assert.strictEqual(H.normalizeDueDate(iso), iso);
});

test('normalizeDueDate: пустое/нераспознанное значение — пустая строка', function() {
    assert.strictEqual(H.normalizeDueDate(''), '');
    assert.strictEqual(H.normalizeDueDate(null), '');
    assert.strictEqual(H.normalizeDueDate(undefined), '');
    assert.strictEqual(H.normalizeDueDate('not-a-date'), '');
});

test('toDateTimeLocalValue: ISO-строка в формат datetime-local (YYYY-MM-DDTHH:mm)', function() {
    var d = new Date();
    var pad = function(n) { return (n < 10 ? '0' : '') + n; };
    var expected = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                   'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    assert.strictEqual(H.toDateTimeLocalValue(d.toISOString()), expected);
});

test('toDateTimeLocalValue: пустое/неверное значение — пустая строка', function() {
    assert.strictEqual(H.toDateTimeLocalValue(''), '');
    assert.strictEqual(H.toDateTimeLocalValue('not-a-date'), '');
});

test('normalizeDueDate <-> toDateTimeLocalValue: обратимы без потери минут', function() {
    var local = H.toDateTimeLocalValue(H.normalizeDueDate('2026-09-05T14:30'));
    assert.strictEqual(local, '2026-09-05T14:30');
});