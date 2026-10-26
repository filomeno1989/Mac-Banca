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

---
Task ID: 3
Agent: Z.ai (main)
Task: Deploy completo online (GitHub + Supabase + Vercel) + APK assinado em Release + correções

Work Log:
- Credenciais guardadas em .deploy-credentials.json (chmod 600, fora do git, gitignored — NÃO apagar até confirmação do usuário)
- Verificado estado anterior: schema/seed/offline/IT já implementados; Supabase com tabelas + seed limpo (patrao, funcionario, admin IT)
- Diagnóstico Vercel 500: env vars apontavam ao pooler errado (aws-0) — correto é aws-1-eu-central-1; validado com prisma db execute (6543 pooled + 5432 session) e gravado via API (201)
- Commit pendente indesejado removido (examples/websocket, vercel-fix-db.py) — histórico limpo
- Fix APK #1: patch-signing.js inseria signingConfig dentro do próprio bloco signingConfigs (âncora em buildTypes resolve)
- Fix APK #2: caminho da keystore ../../keystore/ (estava ../../../ — apontava à raiz do repo)
- Branding: manifest/layout/sw → "Mac Banca" (cache SW v2)
- assetlinks.json criado com fingerprint SHA256 da keystore (B9:11:54:...:15:81)
- README.md do repo com instruções de instalação
- E2E produção: login 3 papéis OK, criação produto, sync offline com clientRef (venda criada), idempotência (duplicate:true sem duplicar), stock 5→3
- Limpeza pós-teste via Management API: 0 produtos/vendas/sessões, 3 utilizadores, sequências resetadas

Stage Summary:
- Produção: https://mac-banca.vercel.app (READY, commit 981624a)
- APK: Release v1.0.0 no repo com Mac-Banca-1.0.0.apk (2,81 MB, assinado, download público OK)
- Repo: github.com/filomeno1989/Mac-Banca (workflow APK verde, re-executável via Actions)
- Tokens mantidos no disco (.deploy-credentials.json) conforme pedido — apagar só após confirmação

---
Task ID: 4
Agent: Z.ai (main)
Task: Ajustes v1.1.0 (9 pedidos do usuário) + varredura de melhorias

Work Log:
- Travessões "—" eliminados de todo o projeto (UI, comentários, README, sw.js) e substituídos por ":", ",", "·" ou "-" conforme o contexto
- Botão voltar Android: hash-history na SPA (banca-app.tsx sincroniza #/vista com pushState/popstate, com guarda de permissões) + patch-mainactivity.js (WebView.goBack + 2 toques para sair com Toast)
- Atualizações in-app: src/lib/version.ts (APP_VERSION, getInstalledVersion via @capacitor/app, compareVersions, openExternal) + /api/app-release (fetch server-side do GitHub com revalidate 300, evita CORS/rate-limit) + card "Aplicação e atualizações" nas Definições + aviso discreto no login
- Assinatura "F. M. J. A." itálico/transparente + "v1.1.0" no rodapé do login
- Logo M.B profissional (scripts/gen_logo.py): gradiente esmeralda + toldo + monograma; regenerados icon-192/512, maskable, apple-touch-icon, favicon.ico e mipmaps Android (launcher + round)
- Subtítulo "Gestão de vendas, stock e lucros" removido do ecrã principal; logo aplicado também na sidebar e header
- Categorias: src/lib/categories.ts (6 padrões de banca + normalizeCategory + mergeCategories); datalist do produto mostra padrões + aprendidas; normalização ao guardar
- Varredura (#9): papel IT corrigido em produtos/stock/dashboard (isPrivileged) e na API stats/dashboard (IT agora vê lucros); rate-limit do GitHub resolvido com API própria
- APK v1.1.0: workflow verde, Release criada, download validado (PK, 2.99 MB); logs confirmam assinatura + MainActivity
- QA no browser: login (logo/sem subtítulo/versão/assinatura), Definições "Está atualizado", Produtos datalist com 6 categorias padrão, botão voltar do browser navega dentro da app

Stage Summary:
- Produção: https://mac-banca.vercel.app (commit 45efd47)
- APK: https://github.com/filomeno1989/Mac-Banca/releases/download/v1.1.0/Mac-Banca-1.1.0.apk
- Tokens/credenciais mantidos em .deploy-credentials.json (não apagar até confirmação)

---
Task ID: 5
Agent: Z.ai (main)
Task: Funcionário sem acesso a atualizações + logotipo antigo no APK + teste da atualização interna (v1.1.1)

Work Log:
- Diagnóstico logo antigo: install-icons.sh só substituía ic_launcher.png/round; no Android 8+ o launcher usa o ícone ADAPTATIVO (mipmap-anydpi-v26 -> ic_launcher_foreground), que ficava com o padrão do Capacitor
- gen_logo.py reescrito: gera camadas adaptativas (foreground/background 108dp: 108-432px), XMLs anydpi-v26 (@mipmap/ic_launcher_background), values/ic_launcher_background.xml e 11 splashes (drawable*/splash.png) com logo + wordmark
- install-icons.sh instala agora TODAS as camadas; patch-signing.js grava também versionCode (major*10000+minor*100+patch -> 10101) para aceitar instalar por cima
- update-banner.tsx novo: banner global de atualização montado no AppShell, visível para TODAS as contas (patrão, funcionário e IT), dispensável por versão (localStorage), botão Descarregar via openExternal
- Credenciais recriadas em .deploy-credentials.json (ficheiro gitignored não sobreviveu à renovação da sessão) + .gitignore com /apk/android/ e version.txt
- Deploy web (commit 37fa1dc) READY; SW cache v3; workflow APK v1.1.1 SUCCESS (run 40369042688)
- Validação do APK v1.1.1: assinatura v2 OK, versionName 1.1.1 no manifest, versionCode 10101 nos logs, camadas adaptativas confirmadas por análise de pixels (foreground 91% transparente + 9% branco; background 100% esmeralda; v1.1.0 tinha foreground do Capacitor)
- /api/app-release agora devolve 1.1.1 (após revalidate de 300s); banner aparece na app instalada

Stage Summary:
- Produção: https://mac-banca.vercel.app (commit 37fa1dc)
- APK: https://github.com/filomeno1989/Mac-Banca/releases/download/v1.1.1/Mac-Banca-1.1.1.apk (3,18 MB, assinado)
- Atualização interna testável de ponta a ponta: v1.1.0 instalada vê o banner e instala a v1.1.1 por cima (sem desinstalar, sem perder dados)
- Logo M.B no launcher garantido pelas camadas adaptativas; cache do launcher pode exigir reiniciar o aparelho

