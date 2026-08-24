const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/helpers.js');

function daysFromNow(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
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

test('deadlineStripClass: диапазоны дней', function() {
    assert.strictEqual(H.deadlineStripClass(6), 'strip-ok');
    assert.strictEqual(H.deadlineStripClass(5), 'strip-warn');
    assert.strictEqual(H.deadlineStripClass(4), 'strip-warn');
    assert.strictEqual(H.deadlineStripClass(3), 'strip-orange');
    assert.strictEqual(H.deadlineStripClass(2), 'strip-scarlet');
    assert.strictEqual(H.deadlineStripClass(1), 'strip-scarlet');
    assert.strictEqual(H.deadlineStripClass(0), 'strip-red');
    assert.strictEqual(H.deadlineStripClass(-5), 'strip-overdue');
    assert.strictEqual(H.deadlineStripClass(null), 'strip-none');
});

test('isCompletedLate: сравнение точного времени выполнения и срока', function() {
    assert.strictEqual(H.isCompletedLate(daysFromNow(2), daysFromNow(3)), false);
    assert.strictEqual(H.isCompletedLate(daysFromNow(3), daysFromNow(2)), true);
    assert.strictEqual(H.isCompletedLate('', daysFromNow(2)), false);
    assert.strictEqual(H.isCompletedLate(daysFromNow(2), ''), false);
});

test('doneStripClass: бордовая при просрочке, зелёная в срок, текущая срочность без отметки', function() {
    assert.strictEqual(H.doneStripClass(daysFromNow(2), daysFromNow(3), true), 'strip-overdue');
    assert.strictEqual(H.doneStripClass(daysFromNow(2), daysFromNow(3), false), 'strip-ok');
    assert.strictEqual(H.doneStripClass('', daysFromNow(10), undefined), 'strip-ok');
    assert.strictEqual(H.doneStripClass('', '', undefined), 'strip-none');
});
