#!/usr/bin/env node

// Reads .env and generates firebase-config.js
// Usage: node scripts/generate-config.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const outputPath = path.join(__dirname, '..', 'firebase-config.js');

if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found');
    console.error('Create .env with your Firebase config values');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length) {
        env[key.trim()] = valueParts.join('=').trim();
    }
});

const config = {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    databaseURL: env.VITE_FIREBASE_DATABASE_URL || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || ''
};

const teamId = env.VITE_TEAM_ID || 'team_main';

const output = `// ============================================================
//  Firebase Configuration
//  Generated from .env — DO NOT EDIT MANUALLY
//  Run: npm run generate-config
// ============================================================

const FIREBASE_CONFIG = {
    apiKey: "${config.apiKey}",
    authDomain: "${config.authDomain}",
    databaseURL: "${config.databaseURL}",
    projectId: "${config.projectId}",
    storageBucket: "${config.storageBucket}",
    messagingSenderId: "${config.messagingSenderId}",
    appId: "${config.appId}"
};

// ID команды — все пользователи с одинаковым ID видят одни задачи
const TEAM_ID = "${teamId}";
`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log('firebase-config.js generated successfully');
