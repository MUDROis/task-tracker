// ============================================================
//  Firebase Configuration
//  Зарегистрируйтесь на https://console.firebase.google.com
//  1. Создайте проект
//  2. Добавьте Web-приложение (</> иконка)
//  3. Скопируйте значения ниже
//  4. В Database → Realtime Database → создайте БД
//  5. В Authentication → Sign-in method → включить Email/Password
//  6. Импортируйте правила из database.rules.json (БЕЗОПАСНЫЕ ПРАВИЛА)
// ============================================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyArHn7Q6IHuok6pCUTzliyHQYpwzXBO9N0",
    authDomain: "task-trecker-62696.firebaseapp.com",
    databaseURL: "https://task-trecker-62696-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "task-trecker-62696",
    storageBucket: "task-trecker-62696.firebasestorage.app",
    messagingSenderId: "848125495940",
    appId: "1:848125495940:web:c06188458411fb8ed890d1"
};

// ID команды — все пользователи с одинаковым ID видят одни задачи
const TEAM_ID = "team_main";
