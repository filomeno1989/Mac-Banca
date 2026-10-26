import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, unauthorized } from '@/lib/auth'
import { createSaleRecord, SaleError } from '@/lib/sales'

/**
 * Sincronização do modo offline.
 * Recebe um lote de vendas feitas sem internet e grava-as com:
 *  - idempotência (clientRef único - nunca duplica)
 *  - data original da venda (clientDate - relatórios corretos)
 *  - stock pode ficar negativo (a venda já aconteceu na banca)
 * A sincronização é permitida mesmo em manutenção (é conclusão de dados).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const body = (await req.json().catch(() => ({}))) as {
    sales?: {
      clientRef?: string
      clientDate?: string
      items?: { productId: number; qty: number }[]
      payment?: string
      received?: number
    }[]
  }

  const sales = Array.isArray(body.sales) ? body.sales.slice(0, 60) : []
  if (sales.length === 0) return NextResponse.json({ results: [] })

  const isPatrao = user.role === 'PATRAO' || user.role === 'IT'
  const results: { clientRef: string; ok: boolean; saleId?: number; duplicate?: boolean; error?: string }[] = []

  for (const s of sales) {
    const clientRef = String(s.clientRef ?? '')
    if (!clientRef) {
      results.push({ clientRef, ok: false, error: 'clientRef em falta' })
      continue
    }
    try {
      const { sale, duplicate } = await createSaleRecord({
        userId: user.id,
        items: s.items ?? [],
        payment: s.payment,
        received: s.received,
        clientRef,
        clientDate: s.clientDate,
        allowNegativeStock: true,
      })
      results.push({ clientRef, ok: true, saleId: sale.id, duplicate })
    } catch (e) {
      results.push({
        clientRef,
        ok: false,
        error: e instanceof SaleError ? e.message : 'Erro ao gravar a venda',
      })
    }
  }

  return NextResponse.json({ results })
}
