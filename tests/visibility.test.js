const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/helpers.js');

function item(status, createdBy, assignedTo) {
    return { status: status, createdBy: createdBy, assignedTo: assignedTo };
}

test('itemVisibleToUser: админ видит всё', function() {
    assert.strictEqual(H.itemVisibleToUser(item('done', 'alice', 'bob'), 'admin', true, ''), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', '', ''), 'admin', true, ''), true);
});

test('itemVisibleToUser: сотрудник видит только созданное или назначенное ему', function() {
    assert.strictEqual(H.itemVisibleToUser(item('done', 'me', 'other'), 'me', false, ''), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', 'other', 'me'), 'me', false, ''), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', 'a', 'b'), 'me', false, ''), false);
});

test('itemVisibleToUser: админ с выбранным сотрудником видит только его', function() {
    assert.strictEqual(H.itemVisibleToUser(item('done', 'bob', ''), 'boss', true, 'bob'), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', '', 'bob'), 'boss', true, 'bob'), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', 'alice', ''), 'boss', true, 'bob'), false);
});

test('itemVisibleToUser: для сотрудника фильтр по сотруднику игнорируется', function() {
    assert.strictEqual(H.itemVisibleToUser(item('done', 'me', ''), 'me', false, 'boss'), true);
    assert.strictEqual(H.itemVisibleToUser(item('done', 'boss', ''), 'me', false, 'boss'), false);
});

test('visibleTasks: фильтрует задачи по роли и выбранному сотруднику', function() {
    var tasks = [
        item('urgent', 'boss', 'alice'),
        item('in_progress', 'alice', ''),
        item('urgent', 'bob', '')
    ];
    assert.strictEqual(H.visibleTasks(tasks, 'boss', true, '').length, 3);
    assert.strictEqual(H.visibleTasks(tasks, 'boss', true, 'alice').length, 2);
    assert.strictEqual(H.visibleTasks(tasks, 'alice', false, '').length, 2);
});

test('visibleReports: пустой массив не падает и фильтрует по сотруднику', function() {
    var reports = [
        item('active', 'boss', 'alice'),
        item('active', 'alice', '')
    ];
    assert.strictEqual(H.visibleReports(reports, 'boss', true, '').length, 2);
    assert.strictEqual(H.visibleReports(reports, 'boss', true, 'alice').length, 2);
    assert.strictEqual(H.visibleReports(reports, 'alice', false, '').length, 2);
    assert.deepStrictEqual(H.visibleReports([], 'boss', true, ''), []);
});