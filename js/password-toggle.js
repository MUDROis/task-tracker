// Глаз в поле пароля: показать/скрыть пароль.
// Кнопка помечена атрибутом data-toggle-password="<id поля>".
// Подключается на страницах с паролями (вход, админ-панель).
(function () {
    'use strict';

    function toggle(input, button) {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.setAttribute('aria-pressed', show ? 'true' : 'false');
        button.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
        if (show) {
            // курсор остаётся в конце введённого пароля
            var len = input.value.length;
            input.focus();
            if (input.setSelectionRange) input.setSelectionRange(len, len);
        }
    }

    function init(scope) {
        var buttons = scope.querySelectorAll('[data-toggle-password]');
        Array.prototype.forEach.call(buttons, function (button) {
            if (button.getAttribute('data-password-ready')) return;
            button.setAttribute('data-password-ready', '1');
            var input = document.getElementById(button.getAttribute('data-toggle-password'));
            if (!input) return;
            button.addEventListener('click', function () {
                toggle(input, button);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(document); });
    } else {
        init(document);
    }

    window.PasswordToggle = { init: init, toggle: toggle };
})();
