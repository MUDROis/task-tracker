### Task 3: Стили — полоски срока, переключатель, выполненная запись

**Files:**
- Modify: `style.css` (правила приоритета 370-378, блок `.task-card` 336-345, блок `.archive-row` 885-894, конец файла)

**Interfaces:**
- Consumes: классы из Task 1 (`strip-ok`, `strip-warn`, `strip-orange`, `strip-coral`, `strip-red`, `strip-overdue`, `strip-none`), разметка из Task 2.
- Produces: CSS-классы для карточек/строк и переключателя.

- [ ] **Step 1: Убрать приоритетную окраску полоски, добавить классы срока**

Заменить строки 370-378:

```css
.task-card.priority-high {
    border-left-color: #22c55e;
}
.task-card.priority-medium {
    border-left-color: #3b82f6;
}
.task-card.priority-low {
    border-left-color: #94a3b8;
}
```

на:

```css
.task-card.strip-ok { border-left-color: #22c55e; }
.task-card.strip-warn { border-left-color: #a3e635; }
.task-card.strip-orange { border-left-color: #f97316; }
.task-card.strip-coral { border-left-color: #fb7185; }
.task-card.strip-red { border-left-color: #ef4444; }
.task-card.strip-overdue { border-left-color: #7f1d1d; }
.task-card.strip-none { border-left-color: #94a3b8; }
```

- [ ] **Step 2: Добавить стили переключателя**

Добавить в конец `style.css`:

```css
/* ===== TYPE TOGGLE (Задача | Отчёт) ===== */
.item-type-toggle {
    display: flex;
    background: #f1f5f9;
    border-radius: 0.6rem;
    padding: 0.25rem;
    gap: 0.25rem;
}
.item-type-btn {
    flex: 1;
    border: none;
    background: transparent;
    padding: 0.45rem 0.5rem;
    border-radius: 0.45rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    color: #64748b;
    transition: background 0.15s, color 0.15s;
}
.item-type-btn.active {
    background: #fff;
    color: #1e293b;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}

/* ===== ARCHIVE DONE ROW ===== */
.archive-row {
    border-left: 4px solid transparent;
}
.archive-row-done {
    background: #f0fdf4;
}
.archive-row.strip-ok { border-left-color: #22c55e; }
.archive-row.strip-warn { border-left-color: #a3e635; }
.archive-row.strip-orange { border-left-color: #f97316; }
.archive-row.strip-coral { border-left-color: #fb7185; }
.archive-row.strip-red { border-left-color: #ef4444; }
.archive-row.strip-overdue { border-left-color: #7f1d1d; }
.archive-row.strip-none { border-left-color: #94a3b8; }
```

Примечание: правило `.archive-row { border-left: 4px solid transparent; }` добавлено отдельным селектором ниже, чтобы перебить `border: 1px solid #e2e8f0` из существующего блока (одинаковая специфичность — побеждает более поздний порядок в файле). Не удалять существующий блок `.archive-row`.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: deadline strip and archive-done styles"
```

---

