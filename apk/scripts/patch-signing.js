#!/usr/bin/env node
/** Pós `cap add android`: aplica assinatura de release + versão + ícones de splash. */
const fs = require('fs');
const path = require('path');

const androidApp = path.join(__dirname, '..', 'android', 'app');
const gradlePath = path.join(androidApp, 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');

const STORE_PASS = 'MacBanca1989';
const KEY_ALIAS = 'macbanca';
const KEY_PASS = 'MacBanca1989';

// 1) signingConfigs.release
if (!gradle.includes('signingConfigs {')) {
  gradle = gradle.replace(
    /buildTypes\s*\{/,
    `signingConfigs {
        release {
            storeFile file('../../../keystore/macbanca.keystore')
            storePassword '${STORE_PASS}'
            keyAlias '${KEY_ALIAS}'
            keyPassword '${KEY_PASS}'
        }
    }

    buildTypes {`,
  );
  console.log('✓ signingConfigs.release adicionado');
} else {
  console.log('• signingConfigs já existe');
}

// 2) release → usar a assinatura de release
if (gradle.includes('signingConfig signingConfigs.release')) {
  console.log('• release já usa signingConfigs.release');
} else if (gradle.includes('signingConfig signingConfigs.debug')) {
  gradle = gradle.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release');
  console.log('✓ release → signingConfigs.release');
} else {
  gradle = gradle.replace(
    /release\s*\{/,
    `release {
            signingConfig signingConfigs.release`,
  );
  console.log('✓ release block com signingConfigs.release (inserido)');
}

// 3) versionName
const version = fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim();
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
console.log('✓ versionName =', version);

fs.writeFileSync(gradlePath, gradle);
console.log('build.gradle atualizado.');
