# Модалка отчёта как у задачи + компактная ширина

Дата: 2026-08-09

## Цель

Привести модальное окно создания/редактирования отчёта к тем же полям, что у задачи, без «Статуса» и без «Месяца», и сделать окно компактнее по ширине (max-width 420px).

## Текущее состояние

- Окно отчёта `#reportModal` (index.html:168-193) — статичный HTML: Название, Описание, Месяц, Срок сдачи.
- Отчёт хранит: `title`, `description`, `period`, `reportNumber`, `dueDate`, `createdBy`, `status` ('active'|'done' — управляет архивом), `createdAt`, `updatedAt`.
- Нумерация месячная: `computeReportNumber(period)` считает макс. `reportNumber` среди отчётов с тем же `period`.
- Карточка отчёта (app.js:1797) использует класс `report-card priority-medium`, метку «№N за <месяц>», `formatPeriod(report.period)`.
- Детали отчёта (app.js:1315) показывают «Номер» (№N за месяц), Описание, Срок сдачи, Автор, Создан.
- Архив: поиск (app.js:698-704) и строка `createArchiveReportRow` (app.js:753) используют `formatPeriod`; Excel-выгрузка (app.js:859-868) в колонку «Исполнитель» кладёт месяц (`r.period ? formatPeriod(r.period) : ''`).
- `populateAssigneeSelect()` (app.js:1419) заполняет только `taskAssignee`.

## Изменения

### index.html — поля окна отчёта

В `#reportModal` заменить поля на (структура — точная копия `#taskModal`):

- **Заголовок *** (text, required) — `reportTitle`
- **Описание** (textarea rows=3) — `reportDesc`
- **Приоритет** (select: `low` «Низкий», `medium` «Средний» selected, `high` «Высокий») — `reportPriority`
- **Срок выполнения** (datetime-local, step=900) — `reportDueDate`
- **Исполнитель (делегировать)** (select, пустой option «Не назначен») — `reportAssignee`

«Статус» и «Месяц» отсутствуют. `reportModalTitle` («Новый отчёт»/«Редактировать отчёт»), `reportId`, `reportForm` сохраняются. Кнопка «Сохранить» `btn primary`.

### style.css — компактная ширина

```css
.report-modal {
    max-width: 420px;
}
```

### app.js — данные и логика

1. **DOM-ссылки**: добавить `reportPriority`, `reportAssignee`; удалить `reportPeriod`.
2. **openReportModal(reportData, x, y)**: заполнять `reportTitle`, `reportDesc`, `reportPriority` (по умолчанию `'medium'`), `reportDueDate`, `reportAssignee` (по умолчанию `''`). `reportPeriod` не трогать.
3. **submit `#reportForm`**:
   - новый отчёт: `saveReport({ id: generateId(), title, description, priority, dueDate, assignedTo, reportNumber: computeReportNumber(), createdBy: currentUser.login, status: 'active', createdAt, updatedAt })`;
   - редактирование: `saveReport(Object.assign({}, rep, { title, description, priority, dueDate, assignedTo, updatedAt }))`;
   - `reportModal.classList.remove('active')`.
4. **computeReportNumber()**: без аргумента — глобальный счётчик `max = 0` по всем отчётам, вернуть `max + 1`.
5. **createReportCard** (app.js:1797): класс `'task-card report-card priority-' + (report.priority || 'medium')`; метка `'№' + report.reportNumber` (без месяца); при наличии `assignedTo` показать «👤 <имя>` в `task-meta`.
6. **showReportDetails** (app.js:1315): убрать `formatPeriod`; «Номер: №N»; добавить «Приоритет» (`PRIORITY_LABELS[report.priority]`) и «Исполнитель» (имя или «не назначен»), если применимо.
7. **Архив**:
   - поиск (app.js:698-704): `numberLabel = '№' + r.reportNumber` (без месяца);
   - `createArchiveReportRow` (app.js:753): то же; при наличии `assignedTo` показать в `task-meta`;
   - Excel (app.js:859-868): колонка «Исполнитель» = `formatUserName(r.assignedTo)` (или `''`).
8. **populateAssigneeSelect**: сделать функцию с параметром select, вызывать для `taskAssignee` и `reportAssignee` (на месте существующих вызовов для `taskAssignee` + добавить для `reportAssignee`).

Примечание: `formatPeriod` может остаться неиспользуемым в коде отчётов; удалять его не обязательно (используется только в этих местах — проверить при реализации, удалить, если не осталось вызовов).

## Критерии приёмки

1. Окно отчёта открывается (➕ в колонке Отчёты, ⚙️ на карточке) с полями: Заголовок, Описание, Приоритет, Срок выполнения, Исполнитель — без Статуса и Месяца; ширина компактная (≤420px).
2. Новый отчёт создаётся: номер «№N» без месячной привязки, цвет карточки от приоритета, исполнитель отображается.
3. Редактирование обновляет все поля.
4. Архив: поиск по «№N» работает, строка показывает номер без месяца, Excel-выгрузка в колонке «Исполнитель» содержит имя исполнителя.
5. Детали отчёта показывают Приоритет и Исполнителя, без месяца.
6. Старые отчёты (с `period`) отображаются корректно — просто без месяца в метке.
7. `node --check app.js` проходит.
