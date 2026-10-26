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

---
Task ID: 6
Agent: Z.ai (main)
Task: Varredura clínica Fase 1 + editar nome do utilizador (v1.1.2)

Work Log:
- Funcionários: dialog Editar (nome + PIN opcional) substitui o botão PIN; invalida users/login-users/me (nome atualiza no login e na sessão)
- Permissões IT corrigidas: /api/stats/reports e /api/closures/today e PATCH /api/users/[id] agora usam isPrivileged (IT estava bloqueado em todos); conta IT só editável pelo próprio IT (patrão recebia 403 ao tocar nela)
- Exportar CSV: /api/stats/reports?format=csv (BOM UTF-8, separador ;, decimais vírgula, uma linha por item, pagamento e atendente); botão nos Relatórios com download blob
- Partilhar recibo: sale-details-dialog com navigator.share e fallback wa.me (openExternal); texto com nome da banca, itens, total, pagamento e atendente; sem lucros no recibo
- Login apaga sessões expiradas (deleteMany) antes de criar nova
- E2E produção (de54218): CSV 200 patrão/403 funcionário; closures/today 200 IT; patrão->IT PATCH 403; IT self-PATCH 200; renomear funcionário 200
- APK v1.1.2: run 40373632410 SUCCESS; versionCode 10102, versionName 1.1.2, assinado; Release publicada; /api/app-release a devolver 1.1.2 (banner aparece na app instalada)

Stage Summary:
- Produção: https://mac-banca.vercel.app (commit de54218), SW cache v4
- APK: https://github.com/filomeno1989/Mac-Banca/releases/download/v1.1.2/Mac-Banca-1.1.2.apk (3,03 MB)
- Fase 2 proposta (a confirmar): filtro por categoria no PDV/produtos, exportar produtos/stock, recibo com nome da banca configurável, lucro por categoria
- Nomes reais dos utilizadores ficam para o usuário definir via Funcionários > Editar (não inventar)



---
Task ID: 7
Agent: Z.ai (main)
Task: v1.2.0: backup completo, recibos (WhatsApp/impressão/PDF), relatórios PDF, dados da banca, tutorial

Work Log:
- Schema Setting: ownerPhone, nuit, address, receiptFooter (sqlite + postgres); db push local e Supabase (5432 direct)
- /api/settings: GET devolve dados da banca com sessão; PATCH guarda os 4 campos novos (privileged)
- /api/backup NOVO: GET exportação JSON completa (settings, users, products, sales+items, stockMovements, closures; sessões fora) e POST restauração em transação com normalização; sequências PG repostas com setval; sessões válidas preservadas (bug apanhado no teste E2E: apagar users em cascata matava as sessões, toda a gente era desligada após restaurar)
- /api/stats/reports: agregação byCategory (items → product.category) + CSV com cabeçalho da banca (Banca/NUIT/Contacto/Endereço/Período)
- lib/receipt.ts NOVO: buildReceiptText (WhatsApp), shareReceipt (nativo → wa.me direto com contacto do patrão ou escolha), printReceipt (iframe 80mm), downloadReceiptPdf (jsPDF formato [80, altura dinâmica]), waNumber (258 automático)
- sale-details-dialog: 4 botões (Partilhar, WhatsApp do patrão, Imprimir, Guardar PDF); venda-view: recibo de sucesso com WhatsApp/Imprimir/PDF
- relatorios-view: Exportar PDF (A4, jspdf+autotable com cabeçalho da banca, resumo, por dia, pagamentos, categorias, top produtos, rodapé) + cartão Lucro por categoria; PDFs com import dinâmico (bundle inicial leve)
- produtos-view: Exportar CSV produtos/stock (custos, preços, stock, estado) com dados da banca
- definicoes-view: campos contacto/NUIT/endereço/rodapé + BackupCard (descarregar/restaurar com AlertDialog) + cartão Ajuda (onNavigate)
- tutorial-view.tsx NOVO: novidades por versão (v1.2.0, v1.1.2) + 10 secções em accordion; ViewKey 'ajuda' (todas as contas), nav sidebar + bottom (Mais para funcionário) com bolinha vermelha "novo" por versão (localStorage mb-ajuda-visto)
- jspdf 4.2.1 + jspdf-autotable 5.0.9
- ESLint: ignores apk/scripts/mini-services; set-state-in-effect corrigido (UpdatesCard com setTimeout, banca-app com exceção comentada); eslint --fix em avisos
- E2E local (agent-browser): login, definições guardadas (verificado na BD), backup roundtrip, produto, venda #1, recibo com 3 botões, detalhe com 4 botões, PDFs gerados e validados (relatório 1 pág com banca+NUIT+categoria; recibo exatamente 80,0 mm de largura), tutorial, funcionário vê Ajuda via Mais, CSV com cabeçalho da banca
- Produção (022b650 + e56c84f): backup GET com dados reais (10 produtos), CSV OK, workflow APK SUCCESS (versionName 1.2.0, versionCode 10200, assinado v2, 3,03 MB), Release v1.2.0 publicada
- Fix: /api/app-release deixou de usar ISR next:{revalidate:300} (ficava preso ao valor antigo) → rota force-dynamic com cache em memória de 5 min; agora devolve 1.2.0

Stage Summary:
- Produção: https://mac-banca.vercel.app (commit e56c84f)
- APK: https://github.com/filomeno1989/Mac-Banca/releases/download/v1.2.0/Mac-Banca-1.2.0.apk (3,03 MB, versionCode 10200)
- Banner de atualização ativo: app instalada v1.1.2 recebe aviso da v1.2.0 e instala por cima sem perder dados
- Para o usuário: preencher nas Definições o contacto, NUIT e endereço (produção ainda sem esses dados) e fazer o primeiro backup

---
Task ID: 8
Agent: Z.ai (main)
Task: v1.3.0 - fotos de produtos, atualizacao direto na app, impressora de recibos, guia unico

Work Log:
- Descoberta importante: prisma/schema.prisma e REGENERADO por pick-schema.js a partir de schema.sqlite.prisma / schema.postgres.prisma; a fonte sqlite estava desatualizada desde a v1.2.0 (sem ownerPhone/nuit/etc). Alinhadas as tres fontes: Product.imageUrl + Setting.printerWidth/autoPrintReceipt (e campos v1.2.0 no sqlite)
- db push local (sqlite) + Supabase 5432 (postgres); client regenerado
- Fotos de produtos: POST/PATCH /api/products aceitam imageUrl dataURL (validado <=600KB); /api/products devolve hasImage (payload leve); NOVO /api/products/[id]/image serve os bytes com ETag/304 + Cache-Control; lib/image.ts comprime no cliente (max 512px, JPEG q0.78, fundo branco); produtos-view: bloco de foto no dialog (Escolher/Trocar/Remover, imageChanged evita limpar sem querer) + miniaturas na tabela e lista mobile; venda-view: foto no cartao do PDV; backup inclui fotos (GET e POST roundtrip testado)
- Atualizacao DIRETO na app: apk/scripts/patch-updater.js NOVO cria HeliUpdatePlugin.java (descarrega APK com HttpURLConnection + progresso notifyListeners, instala via FileProvider authority {pkg}.fileprovider, REQUEST_INSTALL_PACKAGES + ACTION_MANAGE_UNKNOWN_APP_SOURCES), regista no MainActivity.onCreate, injeta permissao e cache-path heliupdate no file_paths.xml; workflow apk.yml com step novo; lib/updater.ts (isNativeApp, downloadAndInstallApk com listener de progresso); banner global e UpdatesCard com barra de progresso e botao Atualizar agora (web mantem openExternal)
- Impressora: card nas Definicoes com largura 58/80 mm + switch de impressao automatica apos venda (PATCH /api/settings); receipt.ts respeita printerWidth em @page e jsPDF; venda-view chama printReceipt apos venda online se autoPrintReceipt
- Definicoes: card "Como funciona o sistema" removido (pedido do usuario; a pagina Ajuda e o guia unico); BackupCard menciona fotos
- Tutorial: NOVIDADES v1.3.0 (fotos, atualizacao direta, impressora, guia unico, backup com fotos); secoes produtos/recibos/definicoes/atualizar reescritas
- FIX a partir de screenshot do usuario: vista Stock em telemovel mostrava nomes cortados ("2...", "B...") - botoes Repor/Perda/Ajustar agora em linha propria (flex-1) e valor do stock sem truncate
- QA local: curl E2E (criar produto com foto, GET hasImage, imagem 200/304, PATCH trocar/limpar, settings impressora, funcionario 403, backup roundtrip com foto sobrevivendo, DELETE); agent-browser: login PIN, dialog de foto com compressao real 800x800 -> 512x512 (5 KB), thumb na lista e no PDV, card Impressora guardou (autoPrint=true na BD), card "Como funciona" ausente, novidades v1.3.0 no Ajuda; lint limpo
- Deploy: commit 262f903 + 306e944 -> Vercel READY; producao com hasImage/printerWidth; workflow APK run 40388355218 SUCCESS; Release v1.3.0 (3,03 MB); APK validado: assinatura v2, versionCode 10300, HeliUpdatePlugin no dex, REQUEST_INSTALL_PACKAGES no manifest, cache-path heliupdate (res/8K.xml); /api/app-release devolve 1.3.0 (banner ativo)
- upload/ adicionado ao .gitignore (imagem enviada via chat nao vai para o repo)

Stage Summary:
- Producao: https://mac-banca.vercel.app (commit 306e944)
- APK: https://github.com/filomeno1989/Mac-Banca/releases/download/v1.3.0/Mac-Banca-1.3.0.apk (versionCode 10300)
- Atualizacao v1.2.0 -> v1.3.0 agora acontece 100% dentro da app (baixa + instalador), sem navegador
- Fotos ficam na propria BD (entram no backup); compressao automatica; proximo passo natural: impressora termica Bluetooth (roadmap)
