(function () {
    'use strict';

    (function waitFirebase(cb) {
        if (typeof firebase !== 'undefined' && firebase.database) cb();
        else setTimeout(function () { waitFirebase(cb); }, 50);
    })(function () {
        firebase.initializeApp(FIREBASE_CONFIG);
        init();
    });

    function getUsersRef() {
        return firebase.database().ref('teams/' + TEAM_ID + '/users');
    }

    function copyPreset(roleKey) {
        return JSON.parse(JSON.stringify(DeadlineHelpers.ROLE_PRESETS[roleKey] || {}));
    }

    var selectedLogin = null;
    var dirty = false;
    var users = [];

    var userSelect = document.getElementById('userSelect');
    var showAddUserBtn = document.getElementById('showAddUserBtn');
    var addUserPanel = document.getElementById('addUserPanel');
    var addUserForm = document.getElementById('addUserForm');
    var cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
    var addRoleSelect = document.getElementById('addRoleSelect');
    var userPanel = document.getElementById('userPanel');
    var userName = document.getElementById('userName');
    var userMeta = document.getElementById('userMeta');
    var userForm = document.getElementById('userForm');
    var editName = document.getElementById('editName');
    var editEmail = document.getElementById('editEmail');
    var editEmoji = document.getElementById('editEmoji');
    var roleSelect = document.getElementById('roleSelect');
    var roleHint = document.getElementById('roleHint');
    var permissionsList = document.getElementById('permissionsList');
    var resetRoleBtn = document.getElementById('resetRoleBtn');
    var deleteUserBtn = document.getElementById('deleteUserBtn');
    var saveStatus = document.getElementById('saveStatus');
    var rolesPresetList = document.getElementById('rolesPresetList');

    function fillRoleSelect(selectEl, selectedRole) {
        selectEl.innerHTML = '';
        Object.keys(DeadlineHelpers.ROLES).forEach(function (key) {
            var opt = document.createElement('option');
            opt.value = key;
            opt.textContent = DeadlineHelpers.ROLES[key].label;
            if (key === selectedRole) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    function renderUserSelect() {
        userSelect.innerHTML = '';
        if (!users.length) {
            var emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = 'Нет сотрудников';
            userSelect.appendChild(emptyOpt);
            return;
        }
        users.forEach(function (u) {
            var opt = document.createElement('option');
            opt.value = u.login;
            var name = u.name || u.login;
            var roleLabel = DeadlineHelpers.ROLES[u.role] ? DeadlineHelpers.ROLES[u.role].label : u.role;
            opt.textContent = name + ' — ' + roleLabel;
            if (u.login === selectedLogin) opt.selected = true;
            userSelect.appendChild(opt);
        });
    }

    function renderPermissions(user) {
        permissionsList.innerHTML = '';
        DeadlineHelpers.PERMISSIONS.forEach(function (p) {
            var label = document.createElement('label');
            label.className = 'permission';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.key = p.key;
            cb.checked = DeadlineHelpers.canDo(user, p.key);
            cb.addEventListener('change', function () {
                dirty = true;
                saveStatus.textContent = 'Изменения не сохранены. Нажмите «Сохранить права».';
            });
            var span = document.createElement('span');
            span.textContent = p.label;
            label.appendChild(cb);
            label.appendChild(span);
            permissionsList.appendChild(label);
        });
    }

    function renderUserPanel() {
        var user = users.find(function (u) { return u.login === selectedLogin; });
        if (!user) { userPanel.hidden = true; return; }
        userPanel.hidden = false;
        userName.textContent = user.name || user.login;
        var roleLabel = DeadlineHelpers.ROLES[user.role] ? DeadlineHelpers.ROLES[user.role].label : user.role;
        var createdStr = user.createdAt ? new Date(user.createdAt).toLocaleString('ru-RU') : '—';
        userMeta.textContent = 'Логин: ' + user.login +
            (user.email ? ' • Email: ' + user.email : '') +
            ' • Роль: ' + roleLabel +
            ' • Создан: ' + createdStr +
            (user.createdBy ? ' • Создал: ' + (users.find(function(u){return u.login===user.createdBy;}) || {}).name || user.createdBy : '');
        editName.value = user.name || '';
        editEmail.value = user.email || '';
        editEmoji.value = user.emoji || '';
        fillRoleSelect(roleSelect, user.role);
        roleHint.textContent = DeadlineHelpers.ROLES[user.role] ? DeadlineHelpers.ROLES[user.role].description : '';
        renderPermissions(user);
        saveStatus.textContent = '';
        dirty = false;
    }

    function renderRolePresets() {
        rolesPresetList.innerHTML = '';
        Object.keys(DeadlineHelpers.ROLES).forEach(function (roleKey) {
            var details = document.createElement('details');
            if (roleKey === 'manager') details.open = true;
            var summary = document.createElement('summary');
            summary.textContent = DeadlineHelpers.ROLES[roleKey].label;
            var desc = document.createElement('p');
            desc.className = 'preset-desc';
            desc.textContent = DeadlineHelpers.ROLES[roleKey].description;
            var list = document.createElement('ul');
            if (roleKey === 'manager') {
                DeadlineHelpers.PERMISSIONS.forEach(function (p) {
                    var li = document.createElement('li');
                    li.textContent = '✅ ' + p.label;
                    list.appendChild(li);
                });
            } else {
                var preset = DeadlineHelpers.ROLE_PRESETS[roleKey];
                var disabled = DeadlineHelpers.PERMISSIONS.filter(function (p) { return preset[p.key] === false; });
                if (disabled.length) {
                    disabled.forEach(function (p) {
                        var li = document.createElement('li');
                        li.textContent = '⛔ ' + p.label;
                        list.appendChild(li);
                    });
                } else {
                    var liAll = document.createElement('li');
                    liAll.textContent = 'Все функции включены';
                    list.appendChild(liAll);
                }
            }
            details.appendChild(summary);
            details.appendChild(desc);
            details.appendChild(list);
            rolesPresetList.appendChild(details);
        });
    }

    function renderAll() {
        renderUserSelect();
        renderUserPanel();
        renderRolePresets();
    }

    function init() {
        firebase.auth().onAuthStateChanged(function (fbUser) {
            if (!fbUser) {
                location.href = 'index.html';
                return;
            }
            var login = fbUser.email.replace('@tasktracker.local', '');
            getUsersRef().child(login).once('value').then(function (snap) {
                var me = snap.val();
                if (!me || !DeadlineHelpers.canDo(DeadlineHelpers.normalizeUser(me), 'manageRoles')) {
                    location.href = 'index.html';
                    return;
                }
                startApp();
            }).catch(function () {
                location.href = 'index.html';
            });
        });
    }

    function startApp() {
        fillRoleSelect(addRoleSelect, 'specialist');
        getUsersRef().on('value', function (snap) {
            var data = snap.val();
            users = data ? Object.values(data).map(DeadlineHelpers.normalizeUser) : [];
            if (!selectedLogin && users.length) selectedLogin = users[0].login;
            if (!users.some(function (u) { return u.login === selectedLogin; })) {
                selectedLogin = users.length ? users[0].login : null;
            }
            renderAll();
        });

        userSelect.addEventListener('change', function () {
            if (dirty && !confirm('Есть несохранённые изменения. Перейти к другому сотруднику без сохранения?')) {
                userSelect.value = selectedLogin;
                return;
            }
            selectedLogin = userSelect.value;
            renderUserPanel();
        });

        showAddUserBtn.addEventListener('click', function () {
            addUserPanel.hidden = false;
            document.getElementById('addLogin').focus();
        });
        cancelAddUserBtn.addEventListener('click', function () {
            addUserPanel.hidden = true;
            addUserForm.reset();
        });

        addUserForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var login = document.getElementById('addLogin').value.trim();
            var password = document.getElementById('addPassword').value;
            var email = document.getElementById('addEmail').value.trim();
            var role = addRoleSelect.value;
            var name = document.getElementById('addName').value.trim();
            if (!login || !password || !email || !role) return;
            if (users.some(function (u) { return u.login.toLowerCase() === login.toLowerCase(); })) {
                alert('Сотрудник с таким логином уже существует.');
                return;
            }
            var btnSubmit = addUserForm.querySelector('button[type="submit"]');
            if (btnSubmit) btnSubmit.disabled = true;
            firebase.auth().createUserWithEmailAndPassword(login + '@tasktracker.local', password)
                .then(function (cred) {
                    var rec = DeadlineHelpers.normalizeUser({
                        uid: cred.user.uid,
                        login: login,
                        name: name || login,
                        role: role,
                        email: email,
                        color: '#3b82f6',
                        emoji: '👤',
                        createdAt: new Date().toISOString()
                    });
                    rec.createdBy = selectedLogin || '';
                    return getUsersRef().child(login).set(rec);
                })
                .then(function () {
                    addUserForm.reset();
                    addUserPanel.hidden = true;
                    selectedLogin = login;
                    renderAll();
                    saveStatus.textContent = 'Сотрудник добавлен. При необходимости измените функции и сохраните.';
                })
                .catch(function (err) {
                    alert('Ошибка создания: ' + err.message);
                })
                .finally(function () {
                    if (btnSubmit) btnSubmit.disabled = false;
                });
        });

        userForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var user = users.find(function (u) { return u.login === selectedLogin; });
            if (!user) return;
            var perm = {};
            permissionsList.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
                perm[cb.dataset.key] = cb.checked;
            });
            var updated = Object.assign({}, user, {
                name: editName.value.trim(),
                email: editEmail.value.trim(),
                emoji: editEmoji.value.trim(),
                role: roleSelect.value,
                permissions: perm,
                updatedAt: new Date().toISOString()
            });
            getUsersRef().child(user.login).set(updated).then(function () {
                dirty = false;
                saveStatus.textContent = 'Права сохранены.';
            });
        });

        roleSelect.addEventListener('change', function () {
            var user = users.find(function (u) { return u.login === selectedLogin; });
            if (!user) return;
            var newRole = roleSelect.value;
            roleHint.textContent = DeadlineHelpers.ROLES[newRole] ? DeadlineHelpers.ROLES[newRole].description : '';
            if (confirm('Загрузить предустановленные функции для роли «' + DeadlineHelpers.ROLES[newRole].label + '»? Текущие отметки будут заменены.')) {
                user.permissions = copyPreset(newRole);
                renderPermissions(user);
            }
            dirty = true;
            saveStatus.textContent = 'Изменения не сохранены.';
        });

        resetRoleBtn.addEventListener('click', function () {
            var user = users.find(function (u) { return u.login === selectedLogin; });
            if (!user) return;
            user.permissions = copyPreset(roleSelect.value);
            renderPermissions(user);
            dirty = true;
            saveStatus.textContent = 'Права сброшены к пресету роли. Нажмите «Сохранить права».';
        });

        deleteUserBtn.addEventListener('click', function () {
            var user = users.find(function (u) { return u.login === selectedLogin; });
            if (!user) return;
            var managerCount = users.filter(function (u) { return u.role === 'manager'; }).length;
            if (user.role === 'manager' && managerCount <= 1) {
                alert('Нельзя удалить последнего пользователя с ролью «Менеджер».');
                return;
            }
            if (!confirm('Удалить пользователя «' + user.login + '»?')) return;
            getUsersRef().child(user.login).remove();
        });

        window.addEventListener('beforeunload', function (e) {
            if (dirty) { e.preventDefault(); e.returnValue = ''; }
        });
    }
})();