### Task 1: Чистые функции срока (`js/helpers.js`) с тестами

**Files:**
- Create: `js/helpers.js`
- Test: `tests/deadline.test.js`

**Interfaces:**
- Produces (используются всеми следующими задачами):
  - `DeadlineHelpers.calendarDaysUntil(dueDateStr) → number|null` (календарные дни до срока, без времени суток; `null` при отсутствии/неверной дате)
  - `DeadlineHelpers.deadlineStripClass(daysLeft) → string` (один из: `strip-ok`, `strip-warn`, `strip-orange`, `strip-coral`, `strip-red`, `strip-overdue`, `strip-none`)
  - `DeadlineHelpers.isCompletedLate(completedAtStr, dueDateStr) → boolean`
  - `DeadlineHelpers.doneStripClass(completedAt, dueDate, completedLate) → string`

- [ ] **Step 1: Создать каталог и написать падающий тест**

Создать `tests/deadline.test.js`:

```js
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
    assert.strictEqual(H.deadlineStripClass(2), 'strip-coral');
    assert.strictEqual(H.deadlineStripClass(1), 'strip-red');
    assert.strictEqual(H.deadlineStripClass(0), 'strip-overdue');
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
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `node --test "tests/*.test.js"`
Expected: FAIL — `Error: Cannot find module '../js/helpers.js'`

- [ ] **Step 3: Создать `js/helpers.js`**

```js
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
```

- [ ] **Step 4: Запустить тест и убедиться, что он проходит**

Run: `node --test "tests/*.test.js"`
Expected: 5 тестов PASS

- [ ] **Step 5: Commit**

```bash
git add js/helpers.js tests/deadline.test.js
git commit -m "feat: deadline strip helpers with unit tests"
```

---

