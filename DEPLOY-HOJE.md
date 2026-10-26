# 🚀 Guia de Deploy - Gestão de Banca Online HOJE

Este guia explica, passo a passo, como colocar o sistema online (gratuito) e criar o APK.
Depois de gerares os 3 tokens, **quem executa tudo é o teu programador (Z.ai)** - tu só copias e colas os tokens no chat.

---

## 1. Visão geral da arquitetura

| Peça | Serviço | Plano | Papel |
|---|---|---|---|
| Aplicação (site + APIs) | **Vercel** | Gratuito (Hobby) | Hospeda o Next.js com HTTPS automático |
| Base de dados | **Supabase** | Gratuito | PostgreSQL na nuvem (região Cidade do Cabo) |
| Código (backup/versões) | **GitHub** | Gratuito | Guarda o código e permite atualizações futuras |

**Custo total: 0 MT/mês** dentro dos limites dos planos gratuitos (folga larga para uma banca com 1 funcionário).

> Precisas mesmo dos 3? O GitHub é o único opcional - a Vercel aceita deploy direto do código sem repositório. Mas recomendo fortemente: é o teu backup permanente e permite redesploy em 1 clique.

### Alternativas (caso não queiras o trio)
- **Railway / Render** - tudo-em-um (app + BD numa só plataforma), mas o plano gratuito é mais limitado (pausa a app / BD expira).
- **Servidor próprio em casa** - sem custo mensal, mas exige um computador sempre ligado e configuração de rede. Não recomendado para produção.
- **Conclusão:** o trio GitHub + Supabase + Vercel continua a ser o caminho mais fiável e 100% gratuito.

---

## 2. Os 3 tokens (gera nesta ordem)

> ⚠️ **Segurança:** usa validade curta, dá só as permissões indicadas e **revoga os tokens no final** (mostra-te como em baixo). Nunca partilhes a tua password de conta - só tokens.

### 2.1 GitHub (conta + token)
1. Cria conta em **github.com** (se ainda não tens) - pode ser com o teu email.
2. Vai a **https://github.com/settings/tokens/new**
3. Preenche:
   - **Note:** `deploy-banca`
   - **Expiration:** `7 days`
   - **Select scopes:** marca ✅ **repo** (só este)
4. Clica **Generate token** e copia (começa por `ghp_...`)

### 2.2 Supabase (conta + token)
1. Cria conta em **supabase.com** (podes entrar com a conta GitHub).
2. Vai a **https://supabase.com/dashboard/account/tokens**
3. **Generate new token** → nome `deploy-banca` → copia (começa por `sbp_...`)

> Com este token eu crio o projeto, escolho a região **Cidade do Cabo (af-south-1)** - a mais próxima de Moçambique - e gero a password da base de dados (envio-te depois para guardares).

### 2.3 Vercel (conta + token)
1. Cria conta em **vercel.com** (podes entrar com a conta GitHub).
2. Vai a **https://vercel.com/account/settings/tokens**
3. **Create Token**:
   - **Token Name:** `deploy-banca`
   - **Scope:** a tua conta (personal)
   - **Expiration:** `1 Day`
4. Copia o token.

### ✅ Checklist - o que me enviar no chat
```
1. GitHub:    o teu username  +  token ghp_...
2. Supabase:  token sbp_...
3. Vercel:    token ...
4. Nome da banca (ex.: "Banca do Zito") - aparece na app
5. (Opcional) Queres o seed LIMPO (sem vendas de demonstração) ou com dados demo?
```

---

## 3. O que eu executo (pipeline de ~20–30 min)

1. **GitHub** - `git init`, commit do projeto, criação do repositório e push.
2. **Supabase** - CLI login com o token → criação do projeto (região Cidade do Cabo) → `prisma db push` cria as 8 tabelas → seed (utilizadores + produtos, com ou sem vendas demo).
3. **Vercel** - CLI login com o token → criação do projeto → configuração das variáveis `DATABASE_URL` (pooled, porta 6543) e `DIRECT_URL` (direta, porta 5432) → deploy de produção.
4. **Testes finais** - login do patrão e do funcionário, venda de teste, consulta de lucros e fecho - feitos por mim no URL online.
5. **Entrega** - recebes: URL da app, URL do repositório, credenciais da Supabase e instruções de uso.
6. **Tu revogas os 3 tokens** (2 min):
   - GitHub: https://github.com/settings/tokens → Delete
   - Supabase: https://supabase.com/dashboard/account/tokens → Revoke
   - Vercel: https://vercel.com/account/settings/tokens → Delete

### Regiões (latência baixa para Moçambique)
- **Supabase:** `af-south-1` (Cidade do Cabo) - eu escolho na criação.
- **Vercel:** Function Region `cds1` (Cidade do Cabo) - configuro no projeto (Settings → Functions), ou removo o `regions` do `vercel.json` se der conflito com o plano Hobby.

---

## 4. O APK do teu funcionário

A app já vai preparada como **PWA** (manifest + ícones + service worker + ecrã de "sem ligação"). Duas formas de instalar no telemóvel do funcionário:

### Forma A - Instalar direto (0 custo, 1 minuto)
1. No telemóvel do funcionário, abrir o URL da app no **Chrome**.
2. Menu ⋮ → **"Adicionar ao ecrã principal" / "Instalar aplicação"**.
3. Fica com ícone próprio, ecrã cheio (sem barra do navegador) - como uma app normal.

### Forma B - APK verdadeiro (via PWABuilder, ~10 min)
1. Com a app online, entrar em **https://www.pwabuilder.com**
2. Colar o URL da app → **Start** → **Package for stores → Android**.
3. Download do pacote → contém o **APK assinado** (`app-release-signed.apk`).
4. Enviar o APK ao funcionário (WhatsApp/email) → abrir no telemóvel → permitir "instalar de fontes desconhecidas" → instalar.

> Nota: publicar na **Play Store** é possível mais tarde (conta Google Play: $25 único) usando o mesmo pacote ou Capacitor. Para 1 funcionário, as formas A/B chegam perfeitamente.

---

## 5. Depois de ficar online (primeiro dia)

- [ ] Entrar como **patrao** (PIN 1234) → **Definições** → mudar nome da banca e **trocar os PINs** (nunca deixar 1234/1111).
- [ ] Ajustar os produtos e preços reais da banca (ou apagar os de demonstração).
- [ ] Definir o **fundo de caixa** inicial.
- [ ] Instalar a app no telemóvel do funcionário (Forma A ou B).
- [ ] Primeira venda real + primeiro **fecho de caixa** com o funcionário.
- [ ] Guardar num lugar seguro: password da Supabase, URLs e credenciais.
- [ ] Revogar os 3 tokens temporários.

## 6. Rotina de gestão a partir de casa
- **Dashboard** - vendas do dia, lucro, produtos com stock baixo.
- **Relatórios** - faturação, lucro e margem por período.
- **Stock** - ver entradas/saídas e registar compras de reposição.
- **Fechos** - conferir o fecho que o funcionário submeteu (dinheiro esperado vs contado).

## 7. Problemas comuns
| Problema | Solução |
|---|---|
| Funcionário sem internet na banca | As vendas precisam de internet (dados móveis). O modo offline com sincronização pode ser adicionado depois. |
| "Invalid API key / DATABASE_URL" | Confirmar as duas variáveis na Vercel (pooled 6543 + direct 5432) e fazer redeploy. |
| Timeout no Supabase | Confirmar que o projeto Supabase não está pausado (plano gratuito pausa após ~7 dias de inatividade - basta um uso por semana). |
| Quero restaurar dados | Supabase → Database → Backups (planos gratuitos têm backup diário com retenção de 7 dias). |
