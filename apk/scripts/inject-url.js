#!/usr/bin/env node
/** Injeta a URL da PWA e a versão no capacitor.config.json */
const fs = require('fs');
const path = require('path');

const url = process.argv[2] || 'https://mac-banca.vercel.app';
const version = process.argv[3] || '1.0.0';

const cfgPath = path.join(__dirname, '..', 'capacitor.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
if (!/^https:\/\/.+/.test(url)) {
  console.error('URL inválida (tem de ser https):', url);
  process.exit(1);
}
cfg.server = cfg.server || {};
cfg.server.url = url.replace(/\/+$/, '');
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
fs.writeFileSync(path.join(__dirname, 'version.txt'), version);
console.log('capacitor.config.json → server.url =', cfg.server.url, '| versão', version);
