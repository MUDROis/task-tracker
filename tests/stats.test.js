const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/helpers.js');

function t(status, createdBy, assignedTo) {
    return { status: status, createdBy: createdBy, assignedTo: assignedTo };
}

test('statsSummary: считает выполненные и процент по задачам и отчётам', function() {
    var tasks = [t('done'), t('in_progress'), t('urgent')];
    var reports = [{ status: 'active' }, { status: 'done' }];
    var s = H.statsSummary(tasks, reports, 'boss', true);
    assert.strictEqual(s.total, 5);
    assert.strictEqual(s.done, 2);
    assert.strictEqual(s.pct, 40);
});

test('statsSummary: сотрудник видит только свои задачи и отчёты', function() {
    var tasks = [
        Object.assign(t('done'), { createdBy: 'me' }),
        Object.assign(t('urgent'), { assignedTo: 'me' }),
        t('done')
    ];
    var reports = [
        Object.assign({ status: 'active' }, { createdBy: 'other' }),
        Object.assign({ status: 'active' }, { assignedTo: 'me' })
    ];
    var s = H.statsSummary(tasks, reports, 'me', false);
    assert.strictEqual(s.total, 3);
    assert.strictEqual(s.done, 1);
    assert.strictEqual(s.pct, 33);
});

test('statsSummary: админ видит всё', function() {
    var tasks = [t('done'), t('done')];
    var reports = [];
    var s = H.statsSummary(tasks, reports, 'boss', true);
    assert.strictEqual(s.total, 2);
    assert.strictEqual(s.done, 2);
    assert.strictEqual(s.pct, 100);
});

test('statsSummary: пустой список — 0% без деления на ноль', function() {
    var s = H.statsSummary([], [], 'me', false);
    assert.deepStrictEqual(s, { total: 0, done: 0, pct: 0 });
});
