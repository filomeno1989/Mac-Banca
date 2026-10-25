import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, badRequest, isPrivileged, maintenanceBlock } from '@/lib/auth'
import { saleResponse } from '@/lib/sales'

/** Detalhe de uma venda */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { id } = await params
  const sale = await db.sale.findUnique({
    where: { id: Number(id) },
    include: {
      user: { select: { id: true, name: true } },
      items: true,
    },
  })
  if (!sale) return badRequest('Venda não encontrada.')

  const isPatrao = isPrivileged(user.role)
  return NextResponse.json({
    sale: {
      id: sale.id,
      total: sale.total,
      payment: sale.payment,
      received: sale.received,
      change: sale.change,
      status: sale.status,
      createdAt: sale.createdAt,
      user: sale.user,
      ...(isPatrao ? { profit: sale.profit, cost: sale.cost } : {}),
      items: sale.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        qty: i.qty,
        subtotal: i.subtotal,
        ...(isPatrao ? { cost: i.cost } : {}),
      })),
    },
  })
}

/** Anular venda (patrão) — repõe o stock */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return badRequest('Apenas o patrão pode anular vendas.')

  const maintenance = await maintenanceBlock(user.role)
  if (maintenance) return maintenance

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { action?: string }
  if (body.action !== 'anular') return badRequest('Ação inválida.')

  const result = await db.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: Number(id) }, include: { items: true } })
    if (!sale) throw new Error('Venda não encontrada.')
    if (sale.status !== 'CONCLUIDA') throw new Error('Esta venda já foi anulada.')

    for (const it of sale.items) {
      const updated = await tx.product.update({
        where: { id: it.productId },
        data: { stock: { increment: it.qty } },
      })
      await tx.stockMovement.create({
        data: {
          productId: it.productId,
          userId: user.id,
          type: 'ANULACAO',
          delta: it.qty,
          stockAfter: updated.stock,
          reason: `Anulação da venda #${sale.id}`,
        },
      })
    }

    return tx.sale.update({
      where: { id: sale.id },
      data: { status: 'ANULADA' },
    })
  })

  return NextResponse.json({ ok: true, sale: { id: result.id, status: result.status } })
}
