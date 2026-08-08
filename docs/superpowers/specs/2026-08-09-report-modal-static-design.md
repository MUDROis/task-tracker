# Статичная модалка отчёта (по образцу #taskModal)

Дата: 2026-08-09

## Цель

Привести модальное окно создания/редактирования отчёта к тому же устройству, что и окно задачи: статичный HTML в `index.html`, а JS только заполняет поля, показывает/скрывает окно и обрабатывает submit.

## Текущее состояние

- Модалка задачи `#taskModal` — статичный HTML в `index.html`; `openTaskModal(taskData, x, y)` заполняет поля и вызывает `taskModal.classList.add('active')` + `positionModalAtPoint`. Закрытие по крестику — общий обработчик `document.querySelectorAll('.close-modal')` (app.js:1060).
- Модалка отчёта создаётся динамически в `openReportModal(reportData, x, y)` (app.js:1450-1519): строит `div.modal` через `innerHTML`, вешает обработчики и удаляет `modal.remove()`.

## Изменения

### index.html

Добавить статичную модалку `#reportModal` сразу после `#taskModal` (перед `#usersModal`):

```html
<!-- Модальное окно создания/редактирования отчёта -->
<div id="reportModal" class="modal">
    <div class="modal-content">
        <span class="close-modal">&times;</span>
        <h3 id="reportModalTitle">Новый отчёт</h3>
        <form id="reportForm">
            <input type="hidden" id="reportId">
            <div class="form-group">
                <label for="reportTitle">Название *</label>
                <input type="text" id="reportTitle" required>
            </div>
            <div class="form-group">
                <label for="reportDesc">Описание</label>
                <textarea id="reportDesc" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label for="reportPeriod">Месяц</label>
                <input type="month" id="reportPeriod" required>
            </div>
            <div class="form-group">
                <label for="reportDueDate">Срок сдачи</label>
                <input type="datetime-local" id="reportDueDate" step="900">
            </div>
            <button type="submit" class="btn primary">Сохранить</button>
        </form>
    </div>
</div>
```

### app.js

1. **`openReportModal(reportData, x, y)`** — переписать по образцу `openTaskModal`: заполнить `#reportModalTitle` («Новый отчёт» / «Редактировать отчёт»), `#reportId`, `#reportTitle`, `#reportDesc`, `#reportPeriod`, `#reportDueDate` из `reportData` (или пустыми), затем `reportModal.classList.add('active')` и `positionModalAtPoint(reportModal, x, y)`. Динамическое создание DOM и `modal.remove()` удаляются.

2. **Обработчик submit на `#reportForm`** — перенести логику из текущего обработчика (чтение `reportId`, `reportTitle`, `reportDesc`, `reportPeriod`, `reportDueDate`; создание/обновление отчёта через `saveReport` с `computeReportNumber(period)` для новых) на статичную форму по образцу `taskForm`; в конце — `reportModal.classList.remove('active')`.

Поля и поведение не меняются: те же поля, та же логика месячной нумерации.

## Критерии приёмки

1. Модалка отчёта открывается с колонки «Отчёты» (➕) и с карточки отчёта (⚙️) как статичный HTML-блок, идентично по вёрстке окну задачи.
2. Новый отчёт создаётся и сохраняется (запись в `teams/<TEAM_ID>/reports`), редактирование обновляет отчёт.
3. Закрытие работает по крестику и клику по фону.
4. Позиционирование под курсором на ПК и по центру на мобильной ширине сохранено (общая механика `positionModalAtPoint`).
5. Задача с фиксом правил Firebase: `database.rules.json` содержит узел `reports` с `.read/.write: "auth != null"` (уже закоммичен в `abda888`; требуется публикация правил в консоли Firebase).
