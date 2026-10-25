import { db } from '@/lib/db'
import { dayStart, dayEnd, today } from '@/lib/tz'
import { round2 } from '@/lib/auth'

export interface ClosureSummary {
  day: string
  numSales: number
  totalSales: number
  totalProfit: number
  byPayment: Record<string, { total: number; num: number }>
  expectedCash: number
  openingCash: number
  closed: boolean
  closureId?: number
}

/** Resumo do dia para fecho de caixa (vendas concluídas do dia) */
export async function getDaySummary(day = today()): Promise<ClosureSummary> {
  const sales = await db.sale.findMany({
    where: { createdAt: { gte: dayStart(day), lte: dayEnd(day) }, status: 'CONCLUIDA' },
    select: { total: true, profit: true, payment: true },
  })

  const byPayment: Record<string, { total: number; num: number }> = {}
  let totalSales = 0
  let totalProfit = 0
  for (const s of sales) {
    totalSales += s.total
    totalProfit += s.profit
    const cur = byPayment[s.payment] ?? { total: 0, num: 0 }
    cur.total += s.total
    cur.num += 1
    byPayment[s.payment] = cur
  }

  for (const k of Object.keys(byPayment)) {
    byPayment[k].total = round2(byPayment[k].total)
  }

  const setting = await db.setting.findUnique({ where: { id: 'main' } })
  const openingCash = setting?.openingCash ?? 0
  const cash = byPayment['DINHEIRO']?.total ?? 0

  const existing = await db.closure.findUnique({ where: { day } })

  return {
    day,
    numSales: sales.length,
    totalSales: round2(totalSales),
    totalProfit: round2(totalProfit),
    byPayment,
    expectedCash: round2(openingCash + cash),
    openingCash: round2(openingCash),
    closed: Boolean(existing),
    closureId: existing?.id,
  }
}
