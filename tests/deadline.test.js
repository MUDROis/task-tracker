const test = require('node:test');
const assert = require('node:assert');
const H = require('../js/helpers.js');

function daysFromNow(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
}

test('calendarDaysUntil: СЃС‡РёС‚Р°РµС‚ РєР°Р»РµРЅРґР°СЂРЅС‹Рµ РґРЅРё', function() {
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(6)), 6);
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(3)), 3);
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(0)), 0);
    assert.strictEqual(H.calendarDaysUntil(daysFromNow(-2)), -2);
});

test('calendarDaysUntil: null РґР»СЏ РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РµР№/РЅРµРІРµСЂРЅРѕР№ РґР°С‚С‹', function() {
    assert.strictEqual(H.calendarDaysUntil(''), null);
    assert.strictEqual(H.calendarDaysUntil('not-a-date'), null);
});

test('deadlineStripClass: РґРёР°РїР°Р·РѕРЅС‹ РґРЅРµР№', function() {
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

test('isCompletedLate: СЃСЂР°РІРЅРµРЅРёРµ С‚РѕС‡РЅРѕРіРѕ РІСЂРµРјРµРЅРё РІС‹РїРѕР»РЅРµРЅРёСЏ Рё СЃСЂРѕРєР°', function() {
    assert.strictEqual(H.isCompletedLate(daysFromNow(2), daysFromNow(3)), false);
    assert.strictEqual(H.isCompletedLate(daysFromNow(3), daysFromNow(2)), true);
    assert.strictEqual(H.isCompletedLate('', daysFromNow(2)), false);
    assert.strictEqual(H.isCompletedLate(daysFromNow(2), ''), false);
});

test('doneStripClass: Р±РѕСЂРґРѕРІР°СЏ РїСЂРё РїСЂРѕСЃСЂРѕС‡РєРµ, Р·РµР»С‘РЅР°СЏ РІ СЃСЂРѕРє, С‚РµРєСѓС‰Р°СЏ СЃСЂРѕС‡РЅРѕСЃС‚СЊ Р±РµР· РѕС‚РјРµС‚РєРё', function() {
    assert.strictEqual(H.doneStripClass(daysFromNow(2), daysFromNow(3), true), 'strip-overdue');
    assert.strictEqual(H.doneStripClass(daysFromNow(2), daysFromNow(3), false), 'strip-ok');
    assert.strictEqual(H.doneStripClass('', daysFromNow(10), undefined), 'strip-ok');
    assert.strictEqual(H.doneStripClass('', '', undefined), 'strip-none');
});
