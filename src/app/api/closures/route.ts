import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, forbidden, badRequest, round2, isPrivileged, maintenanceBlock } from '@/lib/auth'
import { getDaySummary } from '@/lib/closures'
import { today } from '@/lib/tz'

/** Histórico de fechos (patrão) */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const closures = await db.closure.findMany({
    include: { user: { select: { id: true, name: true } } },
    orderBy: { day: 'desc' },
    take: 60,
  })
  return NextResponse.json({ closures })
}

/** Fazer o fecho do dia (patrão) */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const maintenance = await maintenanceBlock(user.role)
  if (maintenance) return maintenance

  const body = (await req.json().catch(() => ({}))) as { countedCash?: number; notes?: string }
  const counted = round2(Number(body.countedCash))
  if (Number.isNaN(counted) || counted < 0) return badRequest('Indique o valor contado na gaveta.')

  const day = today()
  const existing = await db.closure.findUnique({ where: { day } })
  if (existing) return badRequest('O fecho de hoje já foi feito.')

  const summary = await getDaySummary(day)
  const difference = round2(counted - summary.expectedCash)

  const closure = await db.closure.create({
    data: {
      day,
      userId: user.id,
      expectedCash: summary.expectedCash,
      countedCash: counted,
      difference,
      totalSales: summary.totalSales,
      totalProfit: summary.totalProfit,
      numSales: summary.numSales,
      byPayment: JSON.stringify(summary.byPayment),
      notes: String(body.notes ?? '').trim() || null,
    },
  })

  return NextResponse.json({ closure }, { status: 201 })
}
