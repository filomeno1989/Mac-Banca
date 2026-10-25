import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, forbidden, badRequest, isPrivileged, maintenanceBlock } from '@/lib/auth'

/** Histórico de movimentos de stock */
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const productId = Number(url.searchParams.get('productId'))
  const limit = Math.min(300, Math.max(1, Number(url.searchParams.get('limit')) || 80))

  const movements = await db.stockMovement.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(productId ? { productId } : {}),
    },
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ movements })
}

/** Registar movimento de stock (patrão): ENTRADA | PERDA | AJUSTE */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const body = (await req.json().catch(() => ({}))) as {
    productId?: number
    type?: string
    qty?: number
    newQty?: number
    reason?: string
    newCost?: number
    clientRef?: string
    clientDate?: string
  }

  // Movimentos sincronizados do modo offline entram mesmo em manutenção (conclusão de dados)
  if (!body.clientRef) {
    const maintenance = await maintenanceBlock(user.role)
    if (maintenance) return maintenance
  }

  // Idempotência: movimento offline já sincronizado antes
  if (body.clientRef) {
    const existing = await db.stockMovement.findUnique({ where: { clientRef: body.clientRef } })
    if (existing) {
      return NextResponse.json(
        { movement: existing, stock: await db.product.findUnique({ where: { id: Number(body.productId) } }).then((p) => p?.stock ?? 0), duplicate: true },
        { status: 201 },
      )
    }
  }

  const productId = Number(body.productId)
  const type = String(body.type ?? '')
  if (!['ENTRADA', 'PERDA', 'AJUSTE'].includes(type)) return badRequest('Tipo de movimento inválido.')

  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) return badRequest('Produto não encontrado.')

  let delta = 0
  let reason = String(body.reason ?? '').trim() || null

  if (type === 'ENTRADA') {
    delta = Math.floor(Number(body.qty))
    if (!(delta > 0)) return badRequest('A quantidade a adicionar deve ser maior que zero.')
    if (!reason) reason = 'Compra / reposição'
  } else if (type === 'PERDA') {
    delta = -Math.floor(Number(body.qty))
    if (!delta) return badRequest('A quantidade perdida deve ser maior que zero.')
    // No modo offline a perda já foi registada — permitir stock negativo
    if (product.stock + delta < 0 && !body.clientRef) {
      return badRequest(`Stock atual (${product.stock}) é menor que a perda indicada.`)
    }
    if (!reason) reason = 'Perda / avaria'
  } else {
    // AJUSTE: contagem física
    const newQty = Math.floor(Number(body.newQty))
    if (newQty < 0) return badRequest('A contagem não pode ser negativa.')
    delta = newQty - product.stock
    if (!reason) reason = 'Ajuste por contagem física'
  }

  const { movement, stock } = await db.$transaction(async (tx) => {
    // ClientDate do modo offline: manter o momento real do movimento
    let createdAt = new Date()
    if (body.clientDate) {
      const d = new Date(body.clientDate)
      const ok =
        !Number.isNaN(d.getTime()) &&
        Date.now() - d.getTime() < 45 * 24 * 3600 * 1000 &&
        d.getTime() < Date.now() + 24 * 3600 * 1000
      if (ok) createdAt = d
    }
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        stock: product.stock + delta,
        ...(type === 'ENTRADA' && body.newCost !== undefined && Number(body.newCost) > 0
          ? { costPrice: Math.round(Number(body.newCost) * 100) / 100 }
          : {}),
      },
    })
    const movement = await tx.stockMovement.create({
      data: {
        productId,
        clientRef: body.clientRef ?? null,
        userId: user.id,
        type,
        delta,
        stockAfter: updated.stock,
        reason: body.clientRef ? `${reason ?? ''} (offline)`.trim() : reason,
        createdAt,
      },
    })
    return { movement, stock: updated.stock }
  })

  return NextResponse.json({ movement, stock }, { status: 201 })
}
