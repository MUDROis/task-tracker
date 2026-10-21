'use strict';
const test = require('node:test');
const { strict: assert } = require('node:assert');
const DH = require('../js/helpers.js');

test('validateLogin: пустой логин отклоняется', () => {
  assert.ok(DH.validateLogin(''));
  assert.ok(DH.validateLogin('   '));
  assert.ok(DH.validateLogin(null));
  assert.ok(DH.validateLogin(undefined));
});

test('validateLogin: логины из продакшена принимаются', () => {
  for (const login of ['admin', 'Kupriyanov', 'Анна', 'Рыжий', 'artem_1', 'user-2', 'Петров']) {
    assert.strictEqual(DH.validateLogin(login), null, login + ' должен быть допустим');
  }
});

test('validateLogin: пробел отклоняется (auth/invalid-email в Firebase)', () => {
  const err = DH.validateLogin('Артём Куприянов');
  assert.ok(err, 'логин с пробелом должен отклоняться');
  assert.match(err, /пробел/i);
  assert.ok(DH.validateLogin('artem kupriyanov'));
  assert.ok(DH.validateLogin('artem\tkupriyanov'), 'внутренний табулятор отклоняется');
});

test('validateLogin: краевые пробелы обрезаются, логин остаётся валидным', () => {
  assert.strictEqual(DH.validateLogin('  artem  '), null);
  assert.strictEqual(DH.validateLogin('artem\t'), null);
});

test('validateLogin: символы, запрещённые Firebase или RTDB, отклоняются', () => {
  for (const login of ['artem.kupriyanov', 'artem#k', 'artem$k', 'artem[k', 'artem]k', 'artem/k', 'artem@k', 'artem:k']) {
    assert.ok(DH.validateLogin(login), login + ' должен отклоняться');
  }
});

test('validateLogin: слишком длинный логин отклоняется', () => {
  assert.strictEqual(DH.validateLogin('a'.repeat(64)), null);
  assert.ok(DH.validateLogin('a'.repeat(65)));
});

test('validateLogin: сообщение об ошибке — строка на русском', () => {
  const err = DH.validateLogin('bad login');
  assert.equal(typeof err, 'string');
  assert.ok(err.length > 10);
});

// Firebase нормализует email в нижний регистр: 'Kupriyanov@tasktracker.local'
// возвращается как 'kupriyanov@tasktracker.local'. Запись в БД лежит под ключом
// 'Kupriyanov', поэтому поиск по точному логину не находит сотрудника
// и показывается «Ваш аккаунт удалён администратором».
test('findUserByLogin: находит сотрудника без учёта регистра', () => {
  const users = {
    Kupriyanov: { login: 'Kupriyanov', name: 'Артём', role: 'management' },
    admin: { login: 'admin', name: 'Харитон', role: 'manager' },
    'Анна': { login: 'Анна', role: 'specialist' }
  };
  assert.strictEqual(DH.findUserByLogin(users, 'kupriyanov').name, 'Артём');
  assert.strictEqual(DH.findUserByLogin(users, 'Kupriyanov').name, 'Артём');
  assert.strictEqual(DH.findUserByLogin(users, 'KUPRIYANOV').name, 'Артём');
  assert.strictEqual(DH.findUserByLogin(users, 'admin').name, 'Харитон');
  assert.strictEqual(DH.findUserByLogin(users, 'анна').role, 'specialist');
  assert.strictEqual(DH.findUserByLogin(users, 'Анна').role, 'specialist');
});

test('findUserByLogin: отсутствующий логин даёт null', () => {
  const users = { admin: { login: 'admin' } };
  assert.strictEqual(DH.findUserByLogin(users, 'kupriyanov'), null);
  assert.strictEqual(DH.findUserByLogin(users, ''), null);
  assert.strictEqual(DH.findUserByLogin(null, 'admin'), null);
  assert.strictEqual(DH.findUserByLogin({}, 'admin'), null);
});

test('findUserByLogin: берёт логин из ключа, если в записи его нет', () => {
  const users = { legacy: { name: 'Без логина' } };
  assert.strictEqual(DH.findUserByLogin(users, 'legacy').name, 'Без логина');
});

test('buildLoginChangePatch: переносит запись сотрудника и ссылки в задачах/отчётах', () => {
  const users = {
    Kupriyanov: { login: 'Kupriyanov', name: 'Артём', role: 'management' },
    admin: { login: 'admin', createdBy: 'Kupriyanov' }
  };
  const tasks = {
    t1: { createdBy: 'Kupriyanov', assignedTo: 'admin' },
    t2: { createdBy: 'admin', assignedTo: 'Kupriyanov' }
  };
  const reports = { r1: { createdBy: 'Kupriyanov', assignedTo: 'Kupriyanov' } };
  const newRecord = { login: 'Куприянов', name: 'Артём', role: 'management', uid: 'NEWUID' };
  const patch = DH.buildLoginChangePatch(users, tasks, reports, 'Kupriyanov', 'Куприянов', newRecord);

  assert.deepStrictEqual(patch['users/Куприянов'], newRecord);
  assert.strictEqual(patch['tasks/t1/createdBy'], 'Куприянов');
  assert.strictEqual(patch['tasks/t2/assignedTo'], 'Куприянов');
  assert.strictEqual(patch['reports/r1/createdBy'], 'Куприянов');
  assert.strictEqual(patch['reports/r1/assignedTo'], 'Куприянов');
  assert.strictEqual(patch['users/admin/createdBy'], 'Куприянов');
  // ссылки, не относящиеся к сотруднику, не трогаются
  assert.strictEqual(patch['tasks/t1/assignedTo'], undefined);
  assert.strictEqual(patch['tasks/t2/createdBy'], undefined);
});

test('buildLoginChangePatch: сравнение ссылок без учёта регистра', () => {
  const tasks = { t1: { assignedTo: 'kupriyanov' } };
  const patch = DH.buildLoginChangePatch({}, tasks, {}, 'Kupriyanov', 'Куприянов', { login: 'Куприянов' });
  assert.strictEqual(patch['tasks/t1/assignedTo'], 'Куприянов');
});

test('buildLoginChangePatch: пустые значения не переписываются', () => {
  const tasks = { t1: { assignedTo: '', createdBy: 'admin' } };
  const patch = DH.buildLoginChangePatch({}, tasks, {}, 'Kupriyanov', 'Куприянов', { login: 'Куприянов' });
  assert.strictEqual(patch['tasks/t1/assignedTo'], undefined);
  assert.strictEqual(patch['tasks/t1/createdBy'], undefined);
});

test('buildLoginChangePatch: легаси-запись без поля login берёт логин из ключа', () => {
  const users = { legacy: { name: 'Без логина' } };
  const tasks = { t1: { createdBy: 'legacy' } };
  const patch = DH.buildLoginChangePatch(users, tasks, {}, 'legacy', 'Новый', { login: 'Новый' });
  assert.strictEqual(patch['tasks/t1/createdBy'], 'Новый');
  assert.ok(patch['users/Новый']);
});

test('buildLoginChangePatch: пустые коллекции дают патч только с новой записью', () => {
  const patch = DH.buildLoginChangePatch(null, null, null, 'old', 'new', { login: 'new' });
  assert.deepStrictEqual(Object.keys(patch), ['users/new']);
});

