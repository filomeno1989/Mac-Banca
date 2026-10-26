'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Boxes,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  Scale,
  History,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, NetworkError } from '@/lib/api-client'
import * as offline from '@/lib/offline'
import type { Product, Settings, StockMovement, User } from '@/lib/types'
import { formatMoney, formatDateTime, moveLabel } from '@/lib/format'
import { isPrivileged } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

type MoveKind = 'ENTRADA' | 'PERDA' | 'AJUSTE'

function moveBadge(type: string) {
  const map: Record<string, string> = {
    ENTRADA: 'bg-primary/10 text-primary border-transparent',
    VENDA: 'bg-secondary text-secondary-foreground border-transparent',
    PERDA: 'bg-destructive/10 text-destructive border-transparent',
    AJUSTE: 'bg-amber-100 text-amber-700 border-transparent dark:bg-amber-950 dark:text-amber-400',
    ANULACAO: 'bg-amber-100 text-amber-700 border-transparent dark:bg-amber-950 dark:text-amber-400',
    INICIAL: 'bg-muted text-muted-foreground border-transparent',
  }
  return (
    <Badge className={cn('shrink-0 text-[11px]', map[type] ?? '')}>{moveLabel(type)}</Badge>
  )
}

export default function StockView({ user }: { user: User }) {
  const qc = useQueryClient()
  const isPatrao = isPrivileged(user.role)

  const [search, setSearch] = useState('')
  const [moveType, setMoveType] = useState<MoveKind | null>(null)
  const [moveProduct, setMoveProduct] = useState<Product | null>(null)
  const [qty, setQty] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newCost, setNewCost] = useState('')
  const [reason, setReason] = useState('')
  const [filterType, setFilterType] = useState('TODOS')

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })
  const currency = settingsQuery.data?.settings.currency ?? 'MT'

  const productsQuery = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => api<{ products: Product[]; categories: string[] }>('/api/products'),
    refetchInterval: 30_000,
  })
  const products = useMemo(
    () => (productsQuery.data?.products ?? []).filter((p) => p.active),
    [productsQuery.data],
  )

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products
  }, [products, search])

  const movementsQuery = useQuery({
    queryKey: ['movements', filterType],
    queryFn: () =>
      api<{ movements: StockMovement[] }>(
        `/api/stock/movements?limit=80${filterType !== 'TODOS' ? `&type=${filterType}` : ''}`,
      ),
    refetchInterval: 60_000,
  })
  const movements = movementsQuery.data?.movements ?? []

  const stockValue = products.reduce((a, p) => a + (p.costPrice ?? 0) * p.stock, 0)
  const lowCount = products.filter((p) => p.stock <= p.minStock).length

  const openMove = (kind: MoveKind, p: Product) => {
    setMoveType(kind)
    setMoveProduct(p)
    setQty('')
    setNewQty(String(p.stock))
    setNewCost(String(p.costPrice ?? ''))
    setReason('')
  }

  const moveMutation = useMutation({
    mutationFn: () => {
      if (!moveType || !moveProduct) throw new Error('Nada a fazer')
      const payload: Record<string, unknown> = { productId: moveProduct.id, type: moveType, reason }
      if (moveType === 'AJUSTE') payload.newQty = Number(newQty)
      else payload.qty = Number(qty)
      if (moveType === 'ENTRADA' && newCost) payload.newCost = Number(newCost.replace(',', '.'))
      return api('/api/stock/movements', { method: 'POST', json: payload })
    },
    onSuccess: (_r, _v) => {
      const labels: Record<MoveKind, string> = {
        ENTRADA: 'Entrada registada!',
        PERDA: 'Perda registada!',
        AJUSTE: 'Stock ajustado!',
      }
      toast.success(labels[moveType as MoveKind])
      setMoveType(null)
      setMoveProduct(null)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => {
      // Sem internet: ENTRADA/PERDA vão para a fila offline e sincronizam depois
      if (
        e instanceof NetworkError &&
        (moveType === 'ENTRADA' || moveType === 'PERDA') &&
        moveProduct
      ) {
        offline.enqueue({
          kind: 'movement',
          clientRef: offline.genRef(),
          clientDate: new Date().toISOString(),
          productId: moveProduct.id,
          productName: moveProduct.name,
          type: moveType,
          qty: Number(qty),
          reason: reason || undefined,
          newCost:
            moveType === 'ENTRADA' && newCost ? Number(newCost.replace(',', '.')) : undefined,
        })
        toast.warning(
          `Sem internet: ${moveType === 'ENTRADA' ? 'entrada' : 'perda'} de "${moveProduct.name}" guardada e será sincronizada.`,
          { duration: 6000 },
        )
        setMoveType(null)
        setMoveProduct(null)
        return
      }
      toast.error(e instanceof Error ? e.message : 'Erro')
    },
  })

  const moveValid =
    moveType === 'AJUSTE'
      ? Number(newQty) >= 0 && newQty !== ''
      : Number(qty) > 0 && (moveType !== 'PERDA' || Number(qty) <= (moveProduct?.stock ?? 0))

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Stock</h1>
        <p className="text-sm text-muted-foreground">
          {isPatrao
            ? 'Registe compras, perdas e contagens. O histórico fica tudo guardado.'
            : 'Consulta o stock disponível e o histórico de movimentos.'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {isPatrao ? (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Valor do stock</p>
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1.5 text-lg md:text-xl font-bold truncate">
                  {formatMoney(stockValue, currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">a preço de custo</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Stock baixo</p>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <p
                  className={cn(
                    'mt-1.5 text-lg md:text-xl font-bold',
                    lowCount > 0 && 'text-amber-600 dark:text-amber-400',
                  )}
                >
                  {lowCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">produtos a repor</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Produtos ativos</p>
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1.5 text-lg md:text-xl font-bold">{products.length}</p>
                <p className="text-xs text-muted-foreground mt-1">à venda</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Produtos</p>
                <p className="mt-1.5 text-lg font-bold">{products.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Stock baixo</p>
                <p className={cn('mt-1.5 text-lg font-bold', lowCount > 0 && 'text-amber-600')}>
                  {lowCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Sem stock</p>
                <p className="mt-1.5 text-lg font-bold">
                  {products.filter((p) => p.stock <= 0).length}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Lista de produtos com stock */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Níveis de stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
          {productsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border divide-y max-h-96 overflow-y-auto">
              {filteredProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      mín. {p.minStock} · {p.unit}
                    </p>
                  </div>
                  <Badge
                    variant={p.stock <= 0 ? 'destructive' : p.stock <= p.minStock ? 'outline' : 'secondary'}
                    className={cn(
                      'shrink-0',
                      p.stock > 0 && p.stock <= p.minStock && 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700',
                    )}
                  >
                    {p.stock} {p.unit}
                  </Badge>
                  {isPatrao && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => openMove('ENTRADA', p)}
                        aria-label={`Repor stock de ${p.name}`}
                      >
                        <PlusCircle className="h-3.5 w-3.5 text-primary" />
                        Repor
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => openMove('PERDA', p)}
                        aria-label={`Registar perda de ${p.name}`}
                      >
                        <MinusCircle className="h-3.5 w-3.5 text-destructive" />
                        Perda
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => openMove('AJUSTE', p)}
                        aria-label={`Ajustar stock de ${p.name}`}
                      >
                        <Scale className="h-3.5 w-3.5" />
                        Ajustar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de movimentos
          </CardTitle>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 h-8 text-xs" aria-label="Filtrar por tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="ENTRADA">Entradas</SelectItem>
              <SelectItem value="VENDA">Vendas</SelectItem>
              <SelectItem value="PERDA">Perdas</SelectItem>
              <SelectItem value="AJUSTE">Ajustes</SelectItem>
              <SelectItem value="ANULACAO">Anulações</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {movementsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem movimentos.</p>
          ) : (
            <div className="space-y-1 max-h-[420px] overflow-y-auto -mx-1 px-1">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent/50">
                  {moveBadge(m.type)}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{m.product.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {formatDateTime(m.createdAt)} · {m.user.name.split(' ')[0]}
                      {m.reason ? ` · ${m.reason}` : ''}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span
                      className={cn(
                        'block text-sm font-bold',
                        m.delta > 0 ? 'text-primary' : 'text-destructive',
                      )}
                    >
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </span>
                    <span className="block text-xs text-muted-foreground">fica: {m.stockAfter}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog movimento */}
      <Dialog
        open={moveType !== null}
        onOpenChange={(v) => {
          if (!v) {
            setMoveType(null)
            setMoveProduct(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {moveType === 'ENTRADA' && 'Repor stock (compra)'}
              {moveType === 'PERDA' && 'Registar perda'}
              {moveType === 'AJUSTE' && 'Ajustar por contagem'}
            </DialogTitle>
            <DialogDescription>
              {moveProduct?.name} · stock atual: {moveProduct?.stock} {moveProduct?.unit}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {moveType === 'AJUSTE' ? (
              <div className="grid gap-1.5">
                <Label htmlFor="m-newqty">Contagem física (quantidade real)</Label>
                <Input
                  id="m-newqty"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Diferença: {Number(newQty) - (moveProduct?.stock ?? 0)}{' '}
                  {Number(newQty) - (moveProduct?.stock ?? 0) >= 0 ? '+' : ''}
                </p>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="m-qty">
                  {moveType === 'ENTRADA' ? 'Quantidade comprada' : 'Quantidade perdida'}
                </Label>
                <Input
                  id="m-qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            {moveType === 'ENTRADA' && (
              <div className="grid gap-1.5">
                <Label htmlFor="m-cost">Novo preço de custo ({currency}), opcional</Label>
                <Input
                  id="m-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={newCost}
                  onChange={(e) => setNewCost(e.target.value)}
                  placeholder={String(moveProduct?.costPrice ?? '')}
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="m-reason">Motivo (opcional)</Label>
              <Input
                id="m-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  moveType === 'ENTRADA'
                    ? 'Ex.: compra ao grossista'
                    : moveType === 'PERDA'
                      ? 'Ex.: pacote rasgado'
                      : 'Ex.: contagem do fim de semana'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveType(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => moveMutation.mutate()}
              disabled={!moveValid || moveMutation.isPending}
            >
              Registar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
