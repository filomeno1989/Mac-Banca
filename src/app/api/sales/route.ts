import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, badRequest, isPrivileged, maintenanceBlock } from '@/lib/auth'
import { createSaleRecord, saleResponse, SaleError } from '@/lib/sales'
import { dayStart, dayEnd } from '@/lib/tz'

/** Lista de vendas */
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const mine = url.searchParams.get('mine') === '1'

  const sales = await db.sale.findMany({
    where: {
      ...(from ? { createdAt: { gte: dayStart(from) } } : {}),
      ...(to ? { createdAt: { ...(from ? { gte: dayStart(from) } : {}), lte: dayEnd(to) } } : {}),
      ...(mine ? { userId: user.id } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const isPatrao = isPrivileged(user.role)
  return NextResponse.json({
    sales: sales.map((s) => ({
      id: s.id,
      total: s.total,
      payment: s.payment,
      status: s.status,
      received: s.received,
      change: s.change,
      createdAt: s.createdAt,
      user: s.user,
      itemCount: s._count.items,
      ...(isPatrao ? { profit: s.profit, cost: s.cost } : {}),
    })),
  })
}

/** Registar nova venda (com baixa de stock atómica) */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const maintenance = await maintenanceBlock(user.role)
  if (maintenance) return maintenance

  const body = (await req.json().catch(() => ({}))) as {
    items?: { productId: number; qty: number }[]
    payment?: string
    received?: number
    clientRef?: string
  }

  try {
    const { sale } = await createSaleRecord({
      userId: user.id,
      items: body.items ?? [],
      payment: body.payment,
      received: body.received,
      clientRef: body.clientRef ?? null,
    })

    const isPatrao = isPrivileged(user.role)
    return NextResponse.json({ sale: saleResponse(sale, isPatrao) }, { status: 201 })
  } catch (e) {
    if (e instanceof SaleError) return badRequest(e.message)
    throw e
  }
}
