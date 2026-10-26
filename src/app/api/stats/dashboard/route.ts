import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, round2, isPrivileged } from '@/lib/auth'
import { dayString, dayStart, dayEnd, addDays, today } from '@/lib/tz'
import type { DayPoint } from '@/lib/types'

/** Dados do painel principal */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  const isPatrao = isPrivileged(user.role)

  const day = today()
  const yesterday = addDays(day, -1)
  const weekAgo = addDays(day, -6)

  const [todaySales, yesterdaySales, weekSales, products] = await Promise.all([
    db.sale.findMany({
      where: { createdAt: { gte: dayStart(day), lte: dayEnd(day) }, status: 'CONCLUIDA' },
      select: { total: true, profit: true, payment: true, userId: true },
    }),
    db.sale.findMany({
      where: { createdAt: { gte: dayStart(yesterday), lte: dayEnd(yesterday) }, status: 'CONCLUIDA' },
      select: { total: true, profit: true },
    }),
    db.sale.findMany({
      where: { createdAt: { gte: dayStart(weekAgo), lte: dayEnd(day) }, status: 'CONCLUIDA' },
      select: { total: true, profit: true, createdAt: true },
    }),
    db.product.findMany({
      where: { active: true },
      select: { id: true, name: true, stock: true, minStock: true, costPrice: true },
    }),
  ])

  const todayTotal = round2(todaySales.reduce((a, s) => a + s.total, 0))
  const todayProfit = round2(todaySales.reduce((a, s) => a + s.profit, 0))
  const totalMine = round2(
    todaySales.filter((s) => s.userId === user.id).reduce((a, s) => a + s.total, 0),
  )

  const byPaymentMap = new Map<string, { total: number; num: number }>()
  for (const s of todaySales) {
    const cur = byPaymentMap.get(s.payment) ?? { total: 0, num: 0 }
    cur.total += s.total
    cur.num += 1
    byPaymentMap.set(s.payment, cur)
  }
  const byPaymentToday = [...byPaymentMap.entries()]
    .map(([payment, v]) => ({ payment, total: round2(v.total), num: v.num }))
    .sort((a, b) => b.total - a.total)

  // últimos 7 dias
  const daysMap = new Map<string, DayPoint>()
  for (let i = 6; i >= 0; i--) {
    const d = addDays(day, -i)
    daysMap.set(d, { day: d, label: dayString(dayStart(d)).slice(5).replace('-', '/'), total: 0, profit: 0, num: 0 })
  }
  for (const s of weekSales) {
    const key = dayString(s.createdAt)
    const point = daysMap.get(key)
    if (point) {
      point.total = round2(point.total + s.total)
      point.profit = round2(point.profit + s.profit)
      point.num += 1
    }
  }
  const last7 = [...daysMap.values()]

  const yTotal = round2(yesterdaySales.reduce((a, s) => a + s.total, 0))

  const lowStock = products
    .filter((p) => p.stock <= p.minStock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10)
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock, minStock: p.minStock }))

  const recent = await db.sale.findMany({
    where: { status: 'CONCLUIDA' },
    include: { user: { select: { id: true, name: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })

  return NextResponse.json({
    role: user.role,
    today: { numSales: todaySales.length, totalSales: todayTotal, totalProfit: isPatrao ? todayProfit : 0, totalMine },
    yesterday: isPatrao ? { numSales: yesterdaySales.length, totalSales: yTotal, totalProfit: round2(yesterdaySales.reduce((a, s) => a + s.profit, 0)) } : null,
    last7,
    lowStock,
    byPaymentToday: isPatrao ? byPaymentToday : [],
    stockValue: isPatrao ? round2(products.reduce((a, p) => a + p.stock * p.costPrice, 0)) : null,
    activeProducts: products.length,
    recentSales: recent.map((s) => ({
      id: s.id,
      total: s.total,
      payment: s.payment,
      status: s.status,
      createdAt: s.createdAt,
      user: s.user,
      itemCount: s._count.items,
      ...(isPatrao ? { profit: s.profit } : {}),
    })),
  })
}
