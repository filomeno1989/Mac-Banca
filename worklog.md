# Worklog

---
Task ID: 1
Agent: Z.ai (main)
Task: Sistema completo de gestão para banca pequena (vendas, stock, lucros, fechos) — Next.js 16 fullstack

Work Log:
- Carregado skill fullstack-dev e inicializado ambiente (init-fullstack.sh)
- Desenhado schema Prisma: User, Session, Product, Sale, SaleItem, StockMovement, Closure, Setting (SQLite, ids Int autoincrement)
- db:push aplicado com sucesso
- Criado seed (scripts/seed.ts): utilizadores padrão (patrao/1234, funcionario/1111), 19 produtos típicos de banca MZN, 64 vendas de demonstração nos últimos 7 dias, movimentos de stock
- Criadas libs: auth.ts (PIN scrypt + sessões cookie httpOnly), tz.ts (fuso Africa/Johannesburg), format.ts (MT, pt), api-client.ts, types.ts, closures.ts
- APIs: auth/login+logout+me, products (CRUD + arquivo), sales (criar com transação + baixa de stock, anular repõe stock), stock/movements (ENTRADA/PERDA/AJUSTE), closures (+today summary), users, settings, stats/dashboard, stats/reports
- Frontend SPA (única rota /): banca-app (providers + auth), login-screen (escolha de utilizador + teclado PIN), app-shell (sidebar desktop + bottom nav mobile com botão Vender centrado), dashboard, venda (PDV com carrinho), produtos, stock, fechos, relatórios, funcionários, definições, sale-details-dialog (anular venda)
- Tema verde (emerald) claro/escuro com next-themes; sonner para notificações; recharts para gráficos; framer-motion nas transições
- Corrigido durante testes: ícone Money→Banknote (não existe no lucide 0.525), AlertDialogTrigger por importar, setState-in-effect em definicoes, lowStock da API sem id/name (avisos de key duplicada), legenda do gráfico vazia, posição do botão Vender na nav móvel
- Verificação com agent-browser: login PIN, venda completa desktop (#65, lucro 33 MT), entrada de stock (+10 arroz), fecho do dia com diferença -6 MT, relatórios (faturação 11.279 MT / lucro 2.309 MT / margem 20.5%), vista móvel do funcionário (sem lucros, venda #66 por M-Pesa), modo escuro, console limpo, lint limpo

Stage Summary:
- Sistema entregue e verificado no navegador (desktop + mobile, patrão + funcionário)
- Credenciais: patrão = patrao/PIN 1234 · funcionário = funcionario/PIN 1111
- Funcionalidades: PDV com stock em tempo real, lucros automáticos, fecho de caixa com fundo + dinheiro, relatórios por período, gestão de produtos/stock, contas com PIN, M-Pesa/e-Mola
- Ficheiros-chave: prisma/schema.prisma, scripts/seed.ts, src/lib/*, src/app/api/**, src/components/banca/**

---
Task ID: 2
Agent: Z.ai (main)
Task: Preparar o projeto para deploy na nuvem (Vercel + Supabase + GitHub) e base do APK

Work Log:
- Criado prisma/schema.postgres.prisma (PostgreSQL + directUrl + binaryTargets rhel-openssl-3.0.x) e prisma/schema.sqlite.prisma (backup do modo local)
- Criado scripts/pick-schema.js: escolhe sqlite/postgres conforme VERCEL=1 ou USE_PG=1; ligado ao postinstall do package.json (prisma generate automático)
- package.json: postinstall, engines node>=20.9.0, scripts db:push:prod e seed
- Schema postgres validado com prisma validate
- PWA criada: public/manifest.webmanifest, public/sw.js (network-first, API nunca cacheada, página offline), ícones gerados via scripts/gen_icons.py (icon-192/512, maskable-512, apple-touch-icon, favicon.ico)
- layout.tsx: metadata PWA (manifest, appleWebApp, icons) + registo do service worker
- .gitignore: /db excluído do repositório
- .env.example com formato das connection strings do Supabase (pooled 6543 + direct 5432)
- Build completo validado (bun run build) sem erros
- Criado DEPLOY-HOJE.md: instruções dos 3 tokens (GitHub/Supabase/Vercel), pipeline de deploy, APK via PWA/PWABuilder, regiões (af-south-1 / cds1), checklist pós-deploy

Stage Summary:
- Projeto 100% pronto para deploy: no Vercel o postinstall troca automaticamente para PostgreSQL
- Falta apenas: tokens do utilizador (GitHub ghp_, Supabase sbp_, Vercel) + nome da banca + escolha seed limpo/demo
- Depois dos tokens: push GitHub → criar Supabase (Cidade do Cabo) → db push + seed → deploy Vercel → testes → entregar URL
