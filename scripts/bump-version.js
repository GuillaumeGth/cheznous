#!/usr/bin/env node
// Bumps the app version before a release: patch of expo.version,
// expo.android.versionCode and expo.ios.buildNumber (+1 each).
const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const { expo } = appJson;

const [major, minor, patch] = expo.version.split('.').map(Number);
expo.version = `${major}.${minor}.${patch + 1}`;
expo.android = { ...expo.android, versionCode: (expo.android?.versionCode ?? 1) + 1 };
expo.ios = { ...expo.ios, buildNumber: String(Number(expo.ios?.buildNumber ?? 1) + 1) };

fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
console.log(
  `version ${expo.version} (android ${expo.android.versionCode}, ios ${expo.ios.buildNumber})`,
);
