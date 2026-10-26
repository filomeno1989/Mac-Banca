'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search,
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  Banknote,
  Smartphone,
  CreditCard,
  MoreHorizontal,
  CheckCircle2,
  ShoppingBasket,
  CloudOff,
  MessageCircle,
  Printer,
  FileDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { api, NetworkError } from '@/lib/api-client'
import * as offline from '@/lib/offline'
import { receiptBank, shareReceipt, printReceipt, downloadReceiptPdf } from '@/lib/receipt'
import type { Product, Sale, Settings, User } from '@/lib/types'
import { formatMoney, paymentLabel, PAYMENTS } from '@/lib/format'
import { isPrivileged } from '@/lib/auth-client'
import { useOffline } from './offline-provider'

const PAYMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DINHEIRO: Banknote,
  MPESA: Smartphone,
  EMOLA: Smartphone,
  CARTAO: CreditCard,
  OUTRO: MoreHorizontal,
}

interface CartLine {
  productId: number
  name: string
  price: number
  qty: number
  maxStock: number
}

type ReceiptData = Sale & { offlineRef?: string }

export default function VendaView({ user }: { user: User }) {
  const qc = useQueryClient()
  const isPatrao = isPrivileged(user.role)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [cart, setCart] = useState<CartLine[]>([])
  const [payment, setPayment] = useState('DINHEIRO')
  const [received, setReceived] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const offlineCtx = useOffline()

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })
  const currency = settingsQuery.data?.settings.currency ?? 'MT'
  const bank = receiptBank(settingsQuery.data?.settings, currency)

  const productsQuery = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => api<{ products: Product[]; categories: string[] }>('/api/products'),
    refetchInterval: 30_000,
  })

  // Guardar snapshot para uso offline
  useEffect(() => {
    if (productsQuery.data?.products?.length) {
      offline.cacheProducts(productsQuery.data.products)
    }
  }, [productsQuery.data])

  // Produtos em uso: do servidor (ou cache offline) com stock ajustado pela fila pendente
  const products = useMemo(() => {
    const server = productsQuery.data?.products
    const base =
      server ??
      (productsQuery.isError ? (offline.getCachedProducts<Product>()?.products ?? []) : [])
    const deltas = offline.localDeltas()
    return base.map((p) => ({ ...p, stock: p.stock + (deltas[p.id] ?? 0) }))
    // recomputa quando a fila offline muda (pending muda)
     
  }, [productsQuery.data, productsQuery.isError, offlineCtx.pending])
  const offlineMode = productsQuery.isError && products.length > 0
  const categories = useMemo(
    () => ['Todos', ...new Set(products.map((p) => p.category))],
    [products],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(
      (p) =>
        (category === 'Todos' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q)),
    )
  }, [products, search, category])

  const total = useMemo(() => cart.reduce((a, l) => a + l.price * l.qty, 0), [cart])
  const receivedNum = received.trim() === '' ? null : Number(received.replace(',', '.'))
  const troco =
    payment === 'DINHEIRO' && receivedNum !== null && !Number.isNaN(receivedNum)
      ? receivedNum - total
      : null

  const tapProduct = (p: Product) => {
    setCart((cur) => {
      const line = cur.find((l) => l.productId === p.id)
      if (line) {
        if (line.qty >= p.stock) {
          toast.warning(`Só há ${p.stock} un de "${p.name}" em stock.`)
          return cur
        }
        return cur.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
      }
      if (p.stock <= 0) {
        toast.warning(`"${p.name}" está sem stock.`)
        return cur
      }
      return [
        ...cur,
        { productId: p.id, name: p.name, price: p.salePrice, qty: 1, maxStock: p.stock },
      ]
    })
  }

  const changeQty = (productId: number, delta: number) => {
    setCart((cur) =>
      cur
        .map((l) => {
          if (l.productId !== productId) return l
          const q = l.qty + delta
          if (q > l.maxStock) {
            toast.warning(`Só há ${l.maxStock} un de "${l.name}" em stock.`)
            return l
          }
          return { ...l, qty: q }
        })
        .filter((l) => l.qty > 0),
    )
  }

  const saleMutation = useMutation({
    mutationFn: async () => {
      const clientRef = offline.genRef()
      const payload = {
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty })),
        payment,
        received: payment === 'DINHEIRO' ? (receivedNum ?? total) : undefined,
      }
      try {
        const r = await api<{ sale: Sale }>('/api/sales', {
          method: 'POST',
          json: { ...payload, clientRef },
        })
        return { mode: 'online' as const, sale: r.sale }
      } catch (e) {
        if (e instanceof NetworkError) {
          // Sem internet: guardar na fila local e continuar a vender
          const queued: offline.QueuedSale = {
            kind: 'sale',
            clientRef,
            clientDate: new Date().toISOString(),
            items: cart.map((l) => ({
              productId: l.productId,
              name: l.name,
              price: l.price,
              qty: l.qty,
            })),
            payment,
            received: payment === 'DINHEIRO' ? receivedNum ?? total : undefined,
            total,
          }
          offline.enqueue(queued)
          return { mode: 'offline' as const, ref: clientRef }
        }
        throw e
      }
    },
    onSuccess: (r) => {
      if (r.mode === 'online') {
        setReceipt({ ...r.sale, items: r.sale.items ?? [] })
        // impressão automática (Definições > Impressora): abre o diálogo de impressão
        if (settingsQuery.data?.settings.autoPrintReceipt) {
          const done = { ...r.sale, items: r.sale.items ?? [] }
          setTimeout(() => printReceipt(done, bank), 600)
        }
      } else {
        setReceipt({
          id: 0,
          total,
          payment,
          received: payment === 'DINHEIRO' ? receivedNum ?? total : null,
          change:
            payment === 'DINHEIRO' ? Math.round(((receivedNum ?? total) - total) * 100) / 100 : null,
          status: 'PENDENTE',
          createdAt: new Date().toISOString(),
          user: { id: user.id, name: user.name },
          items: cart.map((l, idx) => ({
            id: idx,
            productId: l.productId,
            name: l.name,
            price: l.price,
            qty: l.qty,
            subtotal: Math.round(l.price * l.qty * 100) / 100,
          })),
          offlineRef: r.ref,
        })
        toast.warning(
          'Sem internet: venda guardada no aparelho. Sincroniza sozinha quando a rede voltar.',
          { duration: 6000 },
        )
      }
      setCart([])
      setReceived('')
      setPayment('DINHEIRO')
      setCartOpen(false)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao registar venda'),
  })

  const cartContent = (
    <div className="flex flex-col gap-3 h-full">
      <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
        <div className="space-y-2 pb-2">
          {cart.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Toque nos produtos para adicionar à venda.
            </p>
          )}
          {cart.map((l) => (
            <div key={l.productId} className="flex items-center gap-2 rounded-lg border p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(l.price, currency)} × {l.qty} ={' '}
                  <span className="font-medium text-foreground">
                    {formatMoney(l.price * l.qty, currency)}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => changeQty(l.productId, -1)}
                  aria-label={`Menos uma unidade de ${l.name}`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => changeQty(l.productId, 1)}
                  aria-label={`Mais uma unidade de ${l.name}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setCart((c) => c.filter((x) => x.productId !== l.productId))}
                  aria-label={`Remover ${l.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="space-y-3 border-t pt-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Pagamento</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENTS.map((pm) => {
              const Icon = PAYMENT_ICONS[pm.value]
              return (
                <button
                  key={pm.value}
                  onClick={() => setPayment(pm.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium transition-colors min-h-[52px] justify-center',
                    payment === pm.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {pm.label}
                </button>
              )
            })}
          </div>
        </div>

        {payment === 'DINHEIRO' && (
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder={`Recebido (${currency}), opcional`}
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </div>
            {troco !== null && (
              <p
                className={cn(
                  'text-sm font-medium',
                  troco < 0 ? 'text-destructive' : 'text-primary',
                )}
              >
                {troco < 0
                  ? `Faltam ${formatMoney(Math.abs(troco), currency)}`
                  : `Troco: ${formatMoney(troco, currency)}`}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatMoney(total, currency)}</span>
        </div>

        <Button
          className="w-full h-12 text-base"
          disabled={cart.length === 0 || saleMutation.isPending}
          onClick={() => saleMutation.mutate()}
        >
          <CheckCircle2 className="h-5 w-5" />
          Finalizar venda
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Nova venda</h1>
          <p className="text-sm text-muted-foreground">
            Toque nos produtos para os adicionar ao carrinho.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
        {/* Produtos */}
        <div className="space-y-3">
          {offlineMode && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              <CloudOff className="h-3.5 w-3.5" />
              Modo offline: preços e stock em cache neste aparelho
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Procurar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Procurar produto"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]',
                  category === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {productsQuery.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {productsQuery.isError && products.length === 0
                  ? 'Sem produtos em cache. Ligue a internet uma vez para carregar a lista.'
                  : 'Nenhum produto encontrado.'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filtered.map((p) => {
                const out = p.stock <= 0
                const inCart = cart.find((l) => l.productId === p.id)?.qty ?? 0
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      tapProduct(p)
                    }}
                    disabled={out}
                    className={cn(
                      'relative flex flex-col gap-1 rounded-xl border p-3 text-left transition-all min-h-[96px]',
                      out
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-primary hover:shadow-sm active:scale-[0.98]',
                      inCart > 0 && 'border-primary bg-primary/5',
                    )}
                  >
                    {inCart > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 min-w-5 rounded-full px-1">
                        {inCart}
                      </Badge>
                    )}
                    {p.hasImage && (
                       
                      <img
                        src={`/api/products/${p.id}/image`}
                        alt={`Foto de ${p.name}`}
                        loading="lazy"
                        className="h-14 w-full rounded-md border object-cover"
                      />
                    )}
                    <span className="text-sm font-medium leading-tight line-clamp-2">{p.name}</span>
                    <span className="mt-auto text-sm font-bold text-primary">
                      {formatMoney(p.salePrice, currency)}
                    </span>
                    <span
                      className={cn(
                        'text-[11px]',
                        p.stock <= p.minStock ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                      )}
                    >
                      {out ? 'Sem stock' : `${p.stock} em stock`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Carrinho (desktop) */}
        <Card className="hidden lg:flex lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Carrinho ({cart.reduce((a, l) => a + l.qty, 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">{cartContent}</CardContent>
        </Card>
      </div>

      {/* Barra inferior (mobile) */}
      <div className="lg:hidden fixed bottom-16 inset-x-0 z-30 px-4 pb-safe">
        <div className="mx-auto max-w-md flex items-center gap-2 rounded-full border bg-card/95 backdrop-blur p-2 pl-4 shadow-lg">
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold truncate">
              {formatMoney(total, currency)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {cart.reduce((a, l) => a + l.qty, 0)} artigo(s)
            </span>
          </span>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button disabled={cart.length === 0} className="rounded-full">
                <ShoppingBasket className="h-4 w-4" />
                Ver venda
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl flex flex-col">
              <SheetHeader className="pb-0">
                <SheetTitle>Venda atual</SheetTitle>
              </SheetHeader>
              <div className="flex-1 min-h-0 px-4 pb-4">{cartContent}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Recibo de sucesso */}
      <Dialog open={receipt !== null} onOpenChange={(v) => !v && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle
              className={cn(
                'flex items-center gap-2',
                receipt?.offlineRef ? 'text-amber-600 dark:text-amber-400' : 'text-primary',
              )}
            >
              {receipt?.offlineRef ? <CloudOff className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
              {receipt?.offlineRef
                ? 'Venda guardada offline!'
                : `Venda #${receipt?.id} registada!`}
            </DialogTitle>
            <DialogDescription>
              {receipt?.offlineRef
                ? `Sem internet. Fica na fila deste aparelho (ref ${receipt.offlineRef}) e sincroniza sozinha. Stock ajustado localmente.`
                : 'Stock atualizado automaticamente.'}
            </DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3">
              <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                {receipt.items?.map((it) => (
                  <div key={it.id} className="flex justify-between px-3 py-1.5 text-sm">
                    <span className="truncate">
                      {it.name} × {it.qty}
                    </span>
                    <span>{formatMoney(it.subtotal, currency)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagamento</span>
                  <span>{paymentLabel(receipt.payment)}</span>
                </div>
                {receipt.change != null && receipt.change > 0 && (
                  <div className="flex justify-between font-medium">
                    <span>Troco a dar</span>
                    <span className="text-primary">{formatMoney(receipt.change, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatMoney(receipt.total, currency)}</span>
                </div>
                {isPatrao && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lucro</span>
                    <span className="text-primary font-semibold">
                      {formatMoney(receipt.profit ?? 0, currency)}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2"
                  onClick={() =>
                    void shareReceipt(receipt, bank, bank.ownerPhone || undefined)
                  }
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2"
                  onClick={() => printReceipt(receipt, bank)}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2"
                  onClick={() => void downloadReceiptPdf(receipt, bank)}
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </Button>
              </div>
              <Button className="w-full" onClick={() => setReceipt(null)}>
                Nova venda
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
