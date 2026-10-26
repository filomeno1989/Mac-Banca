# Mac Banca 🏪

Sistema de gestão completo para banca pequena — vendas, stock, lucros e fechos, tudo gerível de casa pelo telemóvel ou computador.

## 🌐 Sistema online

**https://mac-banca.vercel.app**

Instala como aplicação: abre o link no Chrome do telemóvel → menu ⋮ → **"Adicionar ao ecrã principal"**.

## 📱 APK Android

Descarrega a versão mais recente em: **[Releases](https://github.com/filomeno1989/Mac-Banca/releases)**

1. Descarrega o ficheiro `Mac-Banca-x.x.x.apk`
2. Abre no telemóvel e permite "instalar de fontes desconhecidas"
3. Pronto — o app abre o sistema em ecrã cheio, com modo offline incluído

## 👤 Utilizadores

| Papel | Utilizador | PIN | Acesso |
|---|---|---|---|
| Patrão | `patrao` | `1234` | Tudo: lucros, relatórios, stock, fechos, definições |
| Funcionário | `funcionario` | `1111` | Vender e consultar produtos (sem lucros) |
| Técnico IT | `admin` | `1989` | Manutenção — oculto no login (acesso técnico) |

> Recomenda-se alterar os PINs em **Definições → Funcionários** após a primeira utilização.

## ✨ Funcionalidades

- **PDV (vendas)** — carrinho, múltiplos pagamentos (Dinheiro, M-Pesa, e-Mola, Cartão), troco automático
- **Stock em tempo real** — baixa automática na venda, entradas/perdas/ajustes com histórico
- **Lucros automáticos** — custo vs. venda de cada produto, lucro por venda/dia/período
- **Fecho de caixa diário** — fundo inicial, dinheiro contado, diferença, resumo por método de pagamento
- **Relatórios** — faturação, lucro, margem e gráficos por período
- **Modo offline com sincronização** — sem internet, as vendas ficam na fila do telemóvel e sincronizam sozinhas ao reconectar (com idempotência e proteção contra duplicados)
- **Modo manutenção** — o técnico IT ativa uma mensagem de aviso e bloqueia o acesso do funcionário durante reparações
- **PWA + APK** — funciona como app instalada no telemóvel e no computador

## 🔧 Tecnologia

- Next.js + TypeScript + Tailwind (App Router)
- Prisma + PostgreSQL (Supabase)
- PWA (service worker + manifest) e APK via Capacitor
- Deploy: Vercel (produção) · Supabase eu-central-1 (base de dados)
- Fuso horário dos fechos: Africa/Johannesburg (Moçambique)

## 💻 Desenvolvimento local

```bash
bun install          # gera o client Prisma (SQLite local)
bun run db:push
bun run seed         # seed limpo: só utilizadores
bun run dev
```

Para apontar ao Supabase: `USE_PG=1` + `DATABASE_URL`/`DIRECT_URL` (ver `.env.example`).

O APK é gerado automaticamente pelo GitHub Actions (workflow "Build APK") — Capacitor WebView apontando ao URL de produção, assinado com a keystore do repo.
