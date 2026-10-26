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
            storeFile file('../../keystore/macbanca.keystore')
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

// 2) release (dentro de buildTypes) → usar a assinatura de release
//    ⚠ âncora em buildTypes para NÃO tocar no release{} dentro de signingConfigs
if (gradle.includes('signingConfig signingConfigs.release')) {
  console.log('• release já usa signingConfigs.release');
} else if (gradle.includes('signingConfig signingConfigs.debug')) {
  gradle = gradle.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release');
  console.log('✓ release → signingConfigs.release');
} else if (/buildTypes\s*\{\s*release\s*\{/.test(gradle)) {
  gradle = gradle.replace(
    /buildTypes\s*\{\s*release\s*\{/,
    `buildTypes {
        release {
            signingConfig signingConfigs.release`,
  );
  console.log('✓ buildTypes.release com signingConfigs.release (âncora buildTypes)');
} else {
  console.error('✗ ERRO: não encontrei buildTypes { release { no build.gradle');
  process.exit(1);
}

// 3) versionName + versionCode (o code tem de crescer a cada release
//    para o Android aceitar instalar por cima da atual)
const version = fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim();
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
console.log('OK versionName =', version);

const parts = version.split('.').map((n) => parseInt(n, 10) || 0);
const code = (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
if (/versionCode\s+\d+/.test(gradle)) {
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${code}`);
  console.log('OK versionCode =', code);
} else {
  console.error('ERRO: versionCode nao encontrado no build.gradle');
  process.exit(1);
}

fs.writeFileSync(gradlePath, gradle);
console.log('build.gradle atualizado.');
