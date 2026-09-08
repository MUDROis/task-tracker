'use strict';
const test = require('node:test');
const { strict: assert } = require('node:assert');
const DH = require('../js/helpers.js');

const FLAT = {
  addEmployees: true, deleteEmployees: true, editEmployees: true,
  deleteManagerEmployees: true, editManagerEmployees: true,
  assignTasksToManagement: true, assignTasksToDepartment: true, assignTasksToSpecialist: true,
  createTasks: true, editTasks: true, deleteTasks: true,
  manageRoles: true, viewReports: true, exportData: true, systemSettings: true
};

test('ROLES содержит 4 роли', () => {
  for (const r of ['manager', 'management', 'department', 'specialist']) {
    assert.ok(DH.ROLES[r], r + ' отсутствует');
    assert.ok(typeof DH.ROLES[r].label === 'string');
  }
});

test('PERMISSIONS имеет 15 пунктов с уникальными ключами', () => {
  assert.strictEqual(DH.PERMISSIONS.length, 15);
  const keys = DH.PERMISSIONS.map(p => p.key);
  assert.strictEqual(new Set(keys).size, 15);
});

test('нормализация: admin->manager, employee->specialist, пресет', () => {
  const admin = DH.normalizeUser({ login: 'admin', role: 'admin' });
  assert.strictEqual(admin.role, 'manager');
  assert.strictEqual(admin.permissions.manageRoles, true);
  const emp = DH.normalizeUser({ login: 'ivan', role: 'employee' });
  assert.strictEqual(emp.role, 'specialist');
  assert.strictEqual(emp.permissions.viewReports, false);
});

test('canDo и canAssignTo', () => {
  const mgr = { role: 'manager', permissions: { ...FLAT } };
  assert.strictEqual(DH.canDo(mgr, 'systemSettings'), true);
  assert.strictEqual(DH.canAssignTo(mgr, 'department'), true);
  const spec = { role: 'specialist', permissions: DH.ROLE_PRESETS.specialist };
  assert.strictEqual(DH.canAssignTo(spec, 'department'), false);
  assert.strictEqual(DH.canDo(spec, 'createTasks'), true);
  assert.strictEqual(DH.canAssignTo(spec, 'specialist'), true);
});

test('видимость specialist: только своё', () => {
  const usersArr = [];
  const tasks = [
    { id: 1, createdBy: 'spec', assignedTo: '', title: 'mine' },
    { id: 2, createdBy: 'boss', assignedTo: 'spec', title: 'asg' },
    { id: 3, createdBy: 'boss', assignedTo: 'other', title: 'other' }
  ];
  const visible = DH.visibleHierarchyTasks(tasks, 'spec', 'specialist', usersArr);
  assert.deepStrictEqual(visible.map(t => t.id), [1, 2]);
});

test('department видит своё и подчинённых по цепочке createdBy', () => {
  const users = [
    { login: 'dep', role: 'department', createdBy: '' },
    { login: 'spec', role: 'specialist', createdBy: 'dep' },
    { login: 'spec2', role: 'specialist', createdBy: 'spec' }
  ];
  const tasks = [
    { id: 1, createdBy: 'dep', assignedTo: '', title: 'own' },
    { id: 2, createdBy: 'spec', assignedTo: '', title: 'direct' },
    { id: 3, createdBy: 'spec2', assignedTo: '', title: 'grandchild' },
    { id: 4, createdBy: 'other', assignedTo: '', title: 'unrelated' },
    { id: 5, createdBy: 'manager', assignedTo: 'dep', title: 'assigned' }
  ];
  const visible = DH.visibleHierarchyTasks(tasks, 'dep', 'department', users);
  const ids = visible.map(t => t.id).sort();
  assert.deepStrictEqual(ids, [1, 2, 3, 5]);
});

test('manager и management видят всё', () => {
  const tasks = [{ id: 1, createdBy: 'a' }, { id: 2, createdBy: 'b' }];
  for (const role of ['manager', 'management']) {
    assert.strictEqual(DH.visibleHierarchyTasks(tasks, 'me', role, []).length, 2);
  }
});

test('collectSubordinateLogins рекурсивно собирает цепочку', () => {
  const users = [
    { login: 'dep', createdBy: '' },
    { login: 'spec', createdBy: 'dep' },
    { login: 'spec2', createdBy: 'spec' }
  ];
  const subs = DH.collectSubordinateLogins('dep', users).sort();
  assert.deepStrictEqual(subs, ['spec', 'spec2']);
});