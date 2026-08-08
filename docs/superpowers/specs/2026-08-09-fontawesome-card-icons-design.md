# Font Awesome-иконки на карточках задач и отчётов

Дата: 2026-08-09

## Цель

Заменить эмодзи-значки в кнопках карточек задач и отчётов на иконки Font Awesome в сером цвете. Сами кнопки (фон, обводка, текст) не меняются.

## Область изменений

Только кнопки внутри карточек задач, карточек отчётов и строк архива. Панель инструментов, мобильная панель, заголовки колонок и прочие эмодзи не затрагиваются.

## Подключение Font Awesome

В `index.html` добавить CDN Font Awesome 6 (по аналогии с SheetJS):

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
```

## Замена значков

| Кнопка | Было | Стало |
|---|---|---|
| ✅ Выполнить (задача) | ✅ | `fa-solid fa-check` |
| ✅ В архив (отчёт) | ✅ | `fa-solid fa-box-archive` |
| ↩ Вернуть | ↩ | `fa-solid fa-rotate-left` |
| 📤 Делегировать | 📤 | `fa-solid fa-paper-plane` |
| 🗑 Удалить | 🗑 | `fa-solid fa-trash` |
| ⚙️ Изменить/Настройки | ⚙️ | `fa-solid fa-gear` |
| ⭕ Открыть | ⭕ | `fa-solid fa-circle-info` |

Кнопки архива («⭕ Открыть», «↩ Вернуть», «🗑 Удалить») получают те же иконки.

## Стиль иконок

Иконки серые, цвет `#64748b` (slate-500). Кнопки не изменяются: их текущий фон, обводка и цвет текста сохраняются.

В `style.css` добавляется правило, красящее иконки внутри кнопок карточек и архива в серый:

```css
.task-card .btn-done i,
.task-card .btn-delegate i,
.task-card .btn-restore i,
.task-card .btn-delete i,
.task-card .btn-settings i,
.task-card .btn-open i,
.archive-row .btn-archived i {
    color: #64748b;
}
```

## Файлы

- `index.html` — CDN Font Awesome
- `app.js` — эмодзи в кнопках `createTaskCard`, `createReportCard`, `createArchiveTaskRow`, `createArchiveReportRow` заменяются на `<i class="fa-solid ..."></i>`
- `style.css` — правило серого цвета иконок

## Критерии приёмки

1. На карточках задач/отчётов и в архиве вместо эмодзи отображаются иконки Font Awesome.
2. Иконки серые (#64748b).
3. Кнопки выглядят как раньше (цвет фона/обводки/текста не изменился).
4. Панель инструментов, мобильная панель, заголовки колонок не изменены.
