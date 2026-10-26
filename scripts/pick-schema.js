/**
 * Escolhe o schema Prisma consoante o ambiente e escreve prisma/schema.prisma:
 *  - Vercel (VERCEL=1) ou USE_PG=1  → PostgreSQL (Supabase)
 *  - caso contrário                 → SQLite (desenvolvimento local)
 * Depois disto, o postinstall corre `prisma generate`.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = path.join(root, 'prisma', 'schema.prisma');

const usePostgres = process.env.VERCEL === '1' || process.env.USE_PG === '1';

const src = path.join(root, 'prisma', usePostgres ? 'schema.postgres.prisma' : 'schema.sqlite.prisma');

fs.copyFileSync(src, target);

console.log(
  `[pick-schema] Prisma configurado para: ${usePostgres ? 'PostgreSQL (Supabase)' : 'SQLite (local)'}`
);
