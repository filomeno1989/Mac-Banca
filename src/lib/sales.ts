import { db } from '@/lib/db'
import { round2 } from '@/lib/auth'

const VALID_PAYMENTS = ['DINHEIRO', 'MPESA', 'EMOLA', 'CARTAO', 'OUTRO']

export class SaleError extends Error {}

export interface CreateSaleInput {
  userId: number
  items: { productId: number; qty: number }[]
  payment?: string
  received?: number
  /** idempotência: se já existir venda com este ref, devolve-a sem duplicar */
  clientRef?: string | null
  /** data da venda no telemóvel (modo offline) — mantém os relatórios corretos */
  clientDate?: string | null
  /** modo offline: permite stock negativo (a venda já aconteceu na banca) */
  allowNegativeStock?: boolean
}

/**
 * Cria uma venda com baixa de stock atómica.
 * Partilhada entre POST /api/sales (online) e /api/sales/sync (offline).
 */
export async function createSaleRecord(input: CreateSaleInput) {
  // Idempotência por clientRef
  if (input.clientRef) {
    const existing = await db.sale.findUnique({
      where: { clientRef: input.clientRef },
      include: { items: true },
    })
    if (existing) return { sale: existing, duplicate: true as const }
  }

  const rawItems = Array.isArray(input.items) ? input.items : []
  if (rawItems.length === 0) throw new SaleError('Adicione pelo menos um produto à venda.')

  const payment = String(input.payment ?? 'DINHEIRO')
  if (!VALID_PAYMENTS.includes(payment)) throw new SaleError('Forma de pagamento inválida.')

  // agrupar quantidades por produto
  const qtyByProduct = new Map<number, number>()
  for (const it of rawItems) {
    const productId = Number(it.productId)
    const qty = Math.floor(Number(it.qty))
    if (!productId || qty <= 0) continue
    qtyByProduct.set(productId, (qtyByProduct.get(productId) ?? 0) + qty)
  }
  if (qtyByProduct.size === 0) throw new SaleError('Quantidades inválidas.')

  // data da venda: usada pelo modo offline para respeitar o momento real
  let createdAt = new Date()
  if (input.clientDate) {
    const d = new Date(input.clientDate)
    if (!Number.isNaN(d.getTime())) {
      const notTooOld = Date.now() - d.getTime() < 45 * 24 * 3600 * 1000
      const notFuture = d.getTime() < Date.now() + 24 * 3600 * 1000
      if (notTooOld && notFuture) createdAt = d
    }
  }

  const sale = await db.$transaction(async (tx) => {
    const productIds = [...qtyByProduct.keys()]
    const products = await tx.product.findMany({ where: { id: { in: productIds } } })

    const itemsData: {
      productId: number
      name: string
      price: number
      cost: number
      qty: number
      subtotal: number
    }[] = []

    for (const [productId, qty] of qtyByProduct) {
      const p = products.find((x) => x.id === productId)
      if (!p) throw new SaleError('Produto não encontrado (atualize a página).')
      if (!p.active) throw new SaleError(`"${p.name}" já não está disponível.`)
      if (p.stock < qty && !input.allowNegativeStock) {
        throw new SaleError(`Stock insuficiente de "${p.name}" (disponível: ${p.stock}).`)
      }
      itemsData.push({
        productId: p.id,
        name: p.name,
        price: p.salePrice,
        cost: p.costPrice,
        qty,
        subtotal: round2(p.salePrice * qty),
      })
    }

    const total = round2(itemsData.reduce((a, i) => a + i.subtotal, 0))
    const cost = round2(itemsData.reduce((a, i) => a + i.cost * i.qty, 0))

    let received: number | null = null
    let change: number | null = null
    if (payment === 'DINHEIRO') {
      const r =
        input.received === undefined || input.received === null || Number.isNaN(Number(input.received))
          ? total
          : round2(Number(input.received))
      if (r < total && !input.allowNegativeStock) {
        throw new SaleError('O valor recebido é menor que o total da venda.')
      }
      received = r
      change = round2(r - total)
    }

    const created = await tx.sale.create({
      data: {
        userId: input.userId,
        clientRef: input.clientRef ?? null,
        total,
        cost,
        profit: round2(total - cost),
        payment,
        received,
        change,
        createdAt,
        items: { create: itemsData },
      },
      include: { items: true },
    })

    for (const it of itemsData) {
      const updated = await tx.product.update({
        where: { id: it.productId },
        data: { stock: { decrement: it.qty } },
      })
      await tx.stockMovement.create({
        data: {
          productId: it.productId,
          clientRef: input.clientRef ? `${input.clientRef}:${it.productId}` : null,
          userId: input.userId,
          type: 'VENDA',
          delta: -it.qty,
          stockAfter: updated.stock,
          reason: `Venda #${created.id}${input.allowNegativeStock ? ' (offline)' : ''}`,
        },
      })
    }

    return created
  })

  return { sale, duplicate: false as const }
}

/** Resposta padronizada da venda para o cliente */
export function saleResponse(sale: {
  id: number
  total: number
  profit: number
  payment: string
  received: number | null
  change: number | null
  status: string
  createdAt: Date
  clientRef: string | null
  items: { id: number; productId: number; name: string; price: number; qty: number; subtotal: number; cost: number }[]
}, isPatrao: boolean) {
  return {
    id: sale.id,
    clientRef: sale.clientRef,
    total: sale.total,
    payment: sale.payment,
    received: sale.received,
    change: sale.change,
    status: sale.status,
    createdAt: sale.createdAt,
    ...(isPatrao ? { profit: sale.profit } : {}),
    items: sale.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      price: i.price,
      qty: i.qty,
      subtotal: i.subtotal,
      ...(isPatrao ? { cost: i.cost } : {}),
    })),
  }
}
