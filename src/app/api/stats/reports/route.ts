import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, forbidden, round2 } from '@/lib/auth'
import { dayString, dayStart, dayEnd, addDays, today } from '@/lib/tz'
import type { DayPoint, TopProduct } from '@/lib/types'

/** Relatório de vendas por período (patrão) */
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'PATRAO') return forbidden()

  const url = new URL(req.url)
  const range = url.searchParams.get('range') ?? '7dias'

  const day = today()
  let from = addDays(day, -6)
  let to = day
  if (range === 'hoje') {
    from = day
  } else if (range === 'mes') {
    const ym = day.slice(0, 7)
    from = `${ym}-01`
    to = day
  } else if (range === 'mesPassado') {
    const [y, m] = day.split('-').map(Number)
    const pm = m === 1 ? 12 : m - 1
    const py = m === 1 ? y - 1 : y
    const lastDayPM = new Date(Date.UTC(py, pm, 0)).getUTCDate()
    from = `${py}-${String(pm).padStart(2, '0')}-01`
    to = `${py}-${String(pm).padStart(2, '0')}-${String(lastDayPM).padStart(2, '0')}`
  } else if (range === 'custom') {
    const f = url.searchParams.get('from')
    const t = url.searchParams.get('to')
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) from = f
    if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) to = t
    if (dayStart(from) > dayStart(to)) [from, to] = [to, from]
  }

  const sales = await db.sale.findMany({
    where: { createdAt: { gte: dayStart(from), lte: dayEnd(to) }, status: 'CONCLUIDA' },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  })

  const annulled = await db.sale.findMany({
    where: { createdAt: { gte: dayStart(from), lte: dayEnd(to) }, status: 'ANULADA' },
    select: { total: true },
  })

  let totalSales = 0
  let totalCost = 0
  const byDayMap = new Map<string, DayPoint>()
  const byPaymentMap = new Map<string, { total: number; num: number }>()
  const topMap = new Map<string, TopProduct>()

  // preparar todos os dias do intervalo
  let cursor = from
  const spanDays = Math.min(92, Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / 86400000) + 1)
  for (let i = 0; i < spanDays; i++) {
    byDayMap.set(cursor, {
      day: cursor,
      label: dayString(dayStart(cursor)).slice(5).replace('-', '/'),
      total: 0,
      profit: 0,
      num: 0,
    })
    cursor = addDays(cursor, 1)
  }

  for (const s of sales) {
    totalSales += s.total
    totalCost += s.cost

    const key = dayString(s.createdAt)
    const point = byDayMap.get(key) ?? {
      day: key,
      label: key.slice(5).replace('-', '/'),
      total: 0,
      profit: 0,
      num: 0,
    }
    point.total = round2(point.total + s.total)
    point.profit = round2(point.profit + s.profit)
    point.num += 1
    byDayMap.set(key, point)

    const pay = byPaymentMap.get(s.payment) ?? { total: 0, num: 0 }
    pay.total = round2(pay.total + s.total)
    pay.num += 1
    byPaymentMap.set(s.payment, pay)

    for (const it of s.items) {
      const top = topMap.get(it.name) ?? { name: it.name, qty: 0, revenue: 0, profit: 0 }
      top.qty += it.qty
      top.revenue = round2(top.revenue + it.subtotal)
      top.profit = round2(top.profit + (it.subtotal - it.cost * it.qty))
      topMap.set(it.name, top)
    }
  }

  const numSales = sales.length
  const totalProfit = round2(totalSales - totalCost)
  const byDay = [...byDayMap.values()].sort((a, b) => a.day.localeCompare(b.day))

  return NextResponse.json({
    from,
    to,
    totals: {
      numSales,
      totalSales: round2(totalSales),
      totalCost: round2(totalCost),
      totalProfit,
      margin: totalSales > 0 ? Math.round((totalProfit / totalSales) * 1000) / 10 : 0,
      avgTicket: numSales > 0 ? round2(totalSales / numSales) : 0,
    },
    byDay,
    byPayment: [...byPaymentMap.entries()]
      .map(([payment, v]) => ({ payment, ...v }))
      .sort((a, b) => b.total - a.total),
    topProducts: [...topMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    numAnnulled: annulled.length,
    totalAnnulled: round2(annulled.reduce((a, s) => a + s.total, 0)),
  })
}
