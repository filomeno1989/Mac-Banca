/**
 * Modo offline com sincronização — Mac Banca
 *
 * Como funciona:
 *  1. Sem internet, as vendas e movimentos de stock são guardados numa fila
 *     no próprio dispositivo (localStorage) com um clientRef único.
 *  2. O stock é ajustado localmente para o funcionário continuar a vender
 *     com números coerentes.
 *  3. Quando a internet volta (evento 'online', por tempo, ou botão),
 *     a fila é enviada para /api/sales/sync e /api/stock/movements.
 *  4. O servidor é idempotente (clientRef único) — nunca duplica.
 */

const QUEUE_KEY = 'macbanca.offline.queue.v1'
const PRODUCTS_KEY = 'macbanca.offline.products.v1'
const LASTSYNC_KEY = 'macbanca.offline.lastSync.v1'

export interface QueuedSale {
  kind: 'sale'
  clientRef: string
  clientDate: string
  items: { productId: number; name: string; price: number; qty: number }[]
  payment: string
  received?: number
  total: number
}

export interface QueuedMovement {
  kind: 'movement'
  clientRef: string
  clientDate: string
  productId: number
  productName: string
  type: 'ENTRADA' | 'PERDA'
  qty: number
  reason?: string
  newCost?: number
}

export type QueuedItem = QueuedSale | QueuedMovement

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function getQueue(): QueuedItem[] {
  if (typeof window === 'undefined') return []
  return safeParse<QueuedItem[]>(window.localStorage.getItem(QUEUE_KEY), [])
}

function setQueue(q: QueuedItem[]) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  notify()
}

export function genRef(): string {
  return `OFF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function pendingCount(): number {
  return getQueue().length
}

export function lastSyncAt(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(LASTSYNC_KEY)
}

/** Deltas locais de stock calculados a partir da fila pendente */
export function localDeltas(): Record<number, number> {
  const deltas: Record<number, number> = {}
  const add = (id: number, d: number) => {
    deltas[id] = (deltas[id] ?? 0) + d
  }
  for (const item of getQueue()) {
    if (item.kind === 'sale') {
      for (const it of item.items) add(it.productId, -it.qty)
    } else if (item.type === 'ENTRADA') {
      add(item.productId, item.qty)
    } else if (item.type === 'PERDA') {
      add(item.productId, -item.qty)
    }
  }
  return deltas
}

/** Guarda a lista de produtos para o funcionário poder vender offline */
export function cacheProducts(products: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PRODUCTS_KEY, JSON.stringify({ at: Date.now(), products }))
  } catch {
    /* quota — ignorar */
  }
}

/** Produtos em cache com o stock ajustado pelas vendas/movimentos pendentes */
export function getCachedProducts<T extends { id: number; stock: number }>(): { products: T[] } | null {
  if (typeof window === 'undefined') return null
  const cached = safeParse<{ at: number; products: T[] } | null>(
    window.localStorage.getItem(PRODUCTS_KEY),
    null,
  )
  if (!cached?.products?.length) return null
  const deltas = localDeltas()
  return {
    products: cached.products.map((p) => ({
      ...p,
      stock: p.stock + (deltas[p.id] ?? 0),
    })),
  }
}

export function enqueue(item: QueuedItem) {
  if (typeof window === 'undefined') return
  const q = getQueue()
  q.push(item)
  setQueue(q)
}

/* ---------- sincronização ---------- */

export interface SyncResult {
  syncedSales: number
  syncedMovements: number
  failed: number
  errors: string[]
}

export async function syncAll(): Promise<SyncResult> {
  const { api } = await import('@/lib/api-client')
  const result: SyncResult = { syncedSales: 0, syncedMovements: 0, failed: 0, errors: [] }
  const queue = getQueue()
  if (queue.length === 0) return result

  const sales = queue.filter((i): i is QueuedSale => i.kind === 'sale')
  const movements = queue.filter((i): i is QueuedMovement => i.kind === 'movement')
  let remaining = [...queue]

  // 1) vendas em lote (blocos de 20)
  for (let i = 0; i < sales.length; i += 20) {
    const chunk = sales.slice(i, i + 20)
    try {
      const r = await api<{ results: { clientRef: string; ok: boolean; error?: string }[] }>(
        '/api/sales/sync',
        {
          method: 'POST',
          json: {
            sales: chunk.map((s) => ({
              clientRef: s.clientRef,
              clientDate: s.clientDate,
              items: s.items.map((it) => ({ productId: it.productId, qty: it.qty })),
              payment: s.payment,
              received: s.received,
            })),
          },
        },
      )
      const okRefs = new Set(r.results.filter((x) => x.ok).map((x) => x.clientRef))
      const failed = r.results.filter((x) => !x.ok)
      result.syncedSales += okRefs.size
      remaining = remaining.filter((item) => !(item.kind === 'sale' && okRefs.has(item.clientRef)))
      for (const f of failed) {
        result.failed += 1
        result.errors.push(f.error ?? 'Erro ao sincronizar venda')
        // erro permanente (produto apagado, etc.) — sai da fila para não bloquear as outras
        remaining = remaining.filter((item) => !(item.kind === 'sale' && item.clientRef === f.clientRef))
      }
    } catch (e) {
      // rede caiu a meio — manter chunk na fila
      if (e instanceof Error && e.name === 'NetworkError') break
      const failed = chunk
      result.failed += failed.length
      result.errors.push(e instanceof Error ? e.message : 'Erro ao sincronizar')
      const refs = new Set(failed.map((f) => f.clientRef))
      remaining = remaining.filter((item) => !(item.kind === 'sale' && refs.has(item.clientRef)))
    }
  }

  // 2) movimentos de stock (um a um)
  for (const m of movements) {
    try {
      await api('/api/stock/movements', {
        method: 'POST',
        json: {
          clientRef: m.clientRef,
          productId: m.productId,
          type: m.type,
          qty: m.qty,
          reason: m.reason,
          newCost: m.newCost,
          clientDate: m.clientDate,
        },
      })
      result.syncedMovements += 1
      remaining = remaining.filter((item) => !(item.kind === 'movement' && item.clientRef === m.clientRef))
    } catch (e) {
      if (e instanceof Error && e.name === 'NetworkError') break
      result.failed += 1
      result.errors.push(`${m.productName}: ${e instanceof Error ? e.message : 'erro'}`)
      remaining = remaining.filter((item) => !(item.kind === 'movement' && item.clientRef === m.clientRef))
    }
  }

  window.localStorage.setItem(LASTSYNC_KEY, new Date().toISOString())
  setQueue(remaining)
  return result
}

/* ---------- pub/sub simples para a UI reagir a mudanças na fila ---------- */

type Listener = () => void
const listeners = new Set<Listener>()

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  for (const l of listeners) l()
}
