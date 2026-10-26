import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, forbidden, badRequest, isPrivileged } from '@/lib/auth'

/**
 * Backup completo da banca (patrão e técnico).
 *
 * GET  /api/backup  : descarrega TODOS os dados em JSON (produtos, vendas,
 *                     itens, stock, fechos, contas e definições).
 * POST /api/backup  : restaura a partir de um backup (substitui tudo).
 *
 * As sessões ativas não fazem parte do backup: quem estiver com a conta
 * mantida no ficheiro continua com sessão iniciada.
 */

type AnyRec = Record<string, unknown>

const asDate = (v: unknown): Date | undefined => {
  if (typeof v !== 'string' || !v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}
const asNum = (v: unknown, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const asInt = (v: unknown, fallback = 0): number => Math.trunc(asNum(v, fallback))
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const asStrOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
const asBool = (v: unknown, fallback = true): boolean => (typeof v === 'boolean' ? v : fallback)

/** GET: exportação completa */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const [settings, users, products, sales, stockMovements, closures] = await Promise.all([
    db.setting.findMany(),
    db.user.findMany({ orderBy: { id: 'asc' } }),
    db.product.findMany({ orderBy: { id: 'asc' } }),
    db.sale.findMany({ include: { items: true }, orderBy: { id: 'asc' } }),
    db.stockMovement.findMany({ orderBy: { id: 'asc' } }),
    db.closure.findMany({ orderBy: { id: 'asc' } }),
  ])

  const payload = {
    app: 'mac-banca',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: user.name,
    counts: {
      users: users.length,
      products: products.length,
      sales: sales.length,
      stockMovements: stockMovements.length,
      closures: closures.length,
    },
    data: { settings, users, products, sales, stockMovements, closures },
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="backup-mac-banca-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}

/** POST: restauração completa (substitui tudo o que existe) */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as {
    app?: string
    schemaVersion?: number
    data?: Record<string, unknown>
  } | null

  if (!body || body.app !== 'mac-banca' || !body.data) {
    return badRequest('Este ficheiro não parece um backup do Mac Banca.')
  }
  const d = body.data
  const rawUsers = d.users
  const rawProducts = d.products
  const rawSales = d.sales
  if (!Array.isArray(rawUsers) || !Array.isArray(rawProducts) || !Array.isArray(rawSales)) {
    return badRequest('Backup incompleto: faltam utilizadores, produtos ou vendas.')
  }

  // ---- Normalização ----
  const users = (rawUsers as AnyRec[]).map((u) => ({
    id: asInt(u.id),
    name: asStr(u.name, 'Utilizador'),
    username: asStr(u.username),
    pin: asStr(u.pin),
    role: asStr(u.role, 'FUNCIONARIO'),
    active: asBool(u.active),
    ...(asDate(u.createdAt) ? { createdAt: asDate(u.createdAt) } : {}),
  }))
  if (users.some((u) => !u.username || !u.pin || !u.id)) {
    return badRequest('Backup inválido: há utilizadores sem nome de acesso, PIN ou identificador.')
  }

  const products = (rawProducts as AnyRec[]).map((p) => ({
    id: asInt(p.id),
    name: asStr(p.name, 'Produto'),
    category: asStr(p.category, 'Geral'),
    unit: asStr(p.unit, 'un'),
    costPrice: asNum(p.costPrice),
    salePrice: asNum(p.salePrice),
    stock: asInt(p.stock),
    minStock: asInt(p.minStock, 5),
    active: asBool(p.active),
    ...(asDate(p.createdAt) ? { createdAt: asDate(p.createdAt) } : {}),
  }))

  const sales = (rawSales as AnyRec[]).map((s) => ({
    id: asInt(s.id),
    clientRef: asStrOrNull(s.clientRef),
    userId: asInt(s.userId),
    total: asNum(s.total),
    cost: asNum(s.cost),
    profit: asNum(s.profit),
    payment: asStr(s.payment, 'DINHEIRO'),
    received: s.received == null ? null : asNum(s.received),
    change: s.change == null ? null : asNum(s.change),
    status: asStr(s.status, 'CONCLUIDA'),
    ...(asDate(s.createdAt) ? { createdAt: asDate(s.createdAt) } : {}),
    items: (Array.isArray(s.items) ? s.items : []).map((it: AnyRec) => ({
      id: asInt(it.id),
      saleId: asInt(s.id),
      productId: asInt(it.productId),
      name: asStr(it.name, 'Item'),
      price: asNum(it.price),
      cost: asNum(it.cost),
      qty: asInt(it.qty),
      subtotal: asNum(it.subtotal),
    })),
  }))

  const stockMovements = (Array.isArray(d.stockMovements) ? d.stockMovements : []).map(
    (m: AnyRec) => ({
      id: asInt(m.id),
      clientRef: asStrOrNull(m.clientRef),
      productId: asInt(m.productId),
      userId: asInt(m.userId),
      type: asStr(m.type, 'AJUSTE'),
      delta: asInt(m.delta),
      stockAfter: asInt(m.stockAfter),
      reason: asStrOrNull(m.reason),
      ...(asDate(m.createdAt) ? { createdAt: asDate(m.createdAt) } : {}),
    }),
  )

  const closures = (Array.isArray(d.closures) ? d.closures : []).map((c: AnyRec) => ({
    id: asInt(c.id),
    day: asStr(c.day),
    userId: asInt(c.userId),
    expectedCash: asNum(c.expectedCash),
    countedCash: asNum(c.countedCash),
    difference: asNum(c.difference),
    totalSales: asNum(c.totalSales),
    totalProfit: asNum(c.totalProfit),
    numSales: asInt(c.numSales),
    byPayment: asStr(c.byPayment, '{}'),
    notes: asStrOrNull(c.notes),
    ...(asDate(c.createdAt) ? { createdAt: asDate(c.createdAt) } : {}),
  }))

  const settings = (Array.isArray(d.settings) ? d.settings : []).slice(0, 1).map((s: AnyRec) => ({
    id: asStr(s.id, 'main') || 'main',
    businessName: asStr(s.businessName, 'Minha Banca'),
    currency: asStr(s.currency, 'MT'),
    openingCash: asNum(s.openingCash),
    ownerPhone: asStrOrNull(s.ownerPhone),
    nuit: asStrOrNull(s.nuit),
    address: asStrOrNull(s.address),
    receiptFooter: asStrOrNull(s.receiptFooter),
    maintenanceMode: asBool(s.maintenanceMode, false),
    maintenanceMessage: asStrOrNull(s.maintenanceMessage),
  }))

  const saleItems = sales.flatMap((s) => s.items)

  try {
    const counts = await db.$transaction(async (tx) => {
      // preservar sessões válidas: quem está com a sessão aberta não é desligado
      const sessions = await tx.session.findMany()

      // limpar (ordem respeita as ligações)
      await tx.stockMovement.deleteMany()
      await tx.saleItem.deleteMany()
      await tx.sale.deleteMany()
      await tx.closure.deleteMany()
      await tx.product.deleteMany()
      await tx.user.deleteMany()
      await tx.setting.deleteMany()

      if (settings.length) await tx.setting.createMany({ data: settings })
      if (users.length) await tx.user.createMany({ data: users })
      if (products.length) await tx.product.createMany({ data: products })
      if (sales.length) {
        await tx.sale.createMany({ data: sales.map(({ items, ...s }) => s) })
        if (saleItems.length) await tx.saleItem.createMany({ data: saleItems })
      }
      if (closures.length) await tx.closure.createMany({ data: closures })
      if (stockMovements.length) await tx.stockMovement.createMany({ data: stockMovements })

      // repor sessões cuja conta continua a existir no backup
      const userIds = new Set(users.map((u) => u.id))
      const keep = sessions
        .filter((s) => userIds.has(s.userId))
        .map((s) => ({ token: s.token, userId: s.userId, expiresAt: s.expiresAt, createdAt: s.createdAt }))
      if (keep.length) await tx.session.createMany({ data: keep })

      return {
        users: users.length,
        products: products.length,
        sales: sales.length,
        items: saleItems.length,
        stockMovements: stockMovements.length,
        closures: closures.length,
      }
    })

    // Reposicionar as sequências de IDs (só PostgreSQL; no SQLite acompanham sozinhas)
    for (const t of ['User', 'Product', 'Sale', 'SaleItem', 'StockMovement', 'Closure']) {
      try {
        await db.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${t}"','id'), COALESCE((SELECT MAX(id) FROM "${t}"), 0) + 1, false)`,
        )
      } catch {
        /* SQLite: ignorar */
      }
    }

    return NextResponse.json({ ok: true, restored: counts })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro desconhecido'
    return badRequest(`Não foi possível restaurar o backup: ${msg}`)
  }
}
