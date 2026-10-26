'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Archive, Search, Package, RotateCcw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api-client'
import { isPrivileged } from '@/lib/auth-client'
import { mergeCategories, normalizeCategory } from '@/lib/categories'
import type { Product, Settings, User } from '@/lib/types'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const UNITS = ['un', 'pct', 'kg', 'lt', 'cx']

interface ProductForm {
  name: string
  category: string
  unit: string
  costPrice: string
  salePrice: string
  minStock: string
  stock: string
  active: boolean
}

const emptyForm: ProductForm = {
  name: '',
  category: '',
  unit: 'un',
  costPrice: '',
  salePrice: '',
  minStock: '5',
  stock: '0',
  active: true,
}

function stockBadge(p: Product) {
  if (p.stock <= 0) return <Badge variant="destructive">Sem stock</Badge>
  if (p.stock <= p.minStock)
    return (
      <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
        {p.stock} · baixo
      </Badge>
    )
  return <Badge variant="secondary">{p.stock} un</Badge>
}

export default function ProdutosView({ user }: { user: User }) {
  const qc = useQueryClient()
  const isPatrao = isPrivileged(user.role)

  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [toArchive, setToArchive] = useState<Product | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })
  const currency = settingsQuery.data?.settings.currency ?? 'MT'

  const productsQuery = useQuery({
    queryKey: ['products', 'list', showArchived],
    queryFn: () =>
      api<{ products: Product[]; categories: string[] }>(
        `/api/products${showArchived ? '?all=1' : ''}`,
      ),
  })
  const products = productsQuery.data?.products ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products
  }, [products, search])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name,
      category: p.category,
      unit: p.unit,
      costPrice: String(p.costPrice ?? ''),
      salePrice: String(p.salePrice),
      minStock: String(p.minStock),
      stock: String(p.stock),
      active: p.active,
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        category: normalizeCategory(form.category) || 'Geral',
        unit: form.unit,
        costPrice: Number(form.costPrice.replace(',', '.')) || 0,
        salePrice: Number(form.salePrice.replace(',', '.')) || 0,
        minStock: Number(form.minStock) || 0,
        stock: Number(form.stock) || 0,
        ...(editing ? { active: form.active } : {}),
      }
      if (editing) {
        return api(`/api/products/${editing.id}`, { method: 'PATCH', json: payload })
      }
      return api('/api/products', { method: 'POST', json: payload })
    },
    onSuccess: () => {
      toast.success(editing ? 'Produto atualizado!' : 'Produto criado com stock!')
      setDialogOpen(false)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao guardar'),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api<{ archived: boolean }>(`/api/products/${id}`, { method: 'DELETE' }),
    onSuccess: (r) => {
      toast.success(r.archived ? 'Produto arquivado (tem vendas no histórico).' : 'Produto eliminado.')
      setToArchive(null)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro'),
  })

  const margin =
    Number(form.salePrice.replace(',', '.')) > 0
      ? ((Number(form.salePrice.replace(',', '.')) -
          (Number(form.costPrice.replace(',', '.')) || 0)) /
          Number(form.salePrice.replace(',', '.'))) *
        100
      : null

  const canSubmit = form.name.trim().length > 0 && Number(form.salePrice.replace(',', '.')) > 0

  // Exportar produtos e stock em CSV (abre no Excel) com dados da banca
  const exportCsv = () => {
    try {
      const s = settingsQuery.data?.settings
      const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
      const num = (n: number) => String(n).replace('.', ',')
      const rows: string[] = [
        `Banca;${q(s?.businessName || 'Mac Banca')}`,
        s?.nuit ? `NUIT;${q(s.nuit)}` : '',
        s?.ownerPhone ? `Contacto;${q(s.ownerPhone)}` : '',
        `Exportado em;${q(new Date().toLocaleDateString('pt-PT'))}`,
        '',
        ['Produto', 'Categoria', 'Unidade', 'Preço custo', 'Preço venda', 'Stock', 'Stock mínimo', 'Estado']
          .map(q)
          .join(';'),
      ]
      for (const p of products) {
        rows.push(
          [
            q(p.name),
            q(p.category),
            q(p.unit),
            num(p.costPrice ?? 0),
            num(p.salePrice),
            String(p.stock),
            String(p.minStock),
            p.active ? 'Ativo' : 'Arquivado',
          ].join(';'),
        )
      }
      const blob = new Blob(['\ufeff' + rows.filter((r) => r !== undefined).join('\r\n')], {
        type: 'text/csv; charset=utf-8',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `mac-banca-produtos-stock-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
      toast.success('Lista de produtos e stock descarregada.')
    } catch {
      toast.error('Não foi possível gerar o ficheiro.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {products.filter((p) => p.active).length} produtos ativos na banca
          </p>
        </div>
        {isPatrao && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={products.length === 0}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" />
              Novo produto
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Procurar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Procurar produto"
          />
        </div>
        {isPatrao && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            Mostrar arquivados
          </label>
        )}
      </div>

      {productsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Nenhum produto encontrado.' : 'Ainda não há produtos. Crie o primeiro!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabela desktop */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    {isPatrao && <TableHead className="text-right">Custo</TableHead>}
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    {isPatrao && <TableHead className="w-24 text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className={cn(!p.active && 'opacity-50')}>
                      <TableCell className="font-medium">
                        {p.name}
                        {!p.active && (
                          <Badge variant="outline" className="ml-2">
                            arquivado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.category}</TableCell>
                      {isPatrao && (
                        <TableCell className="text-right text-muted-foreground">
                          {formatMoney(p.costPrice ?? 0, currency)}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-semibold">
                        {formatMoney(p.salePrice, currency)}
                      </TableCell>
                      <TableCell className="text-center">{stockBadge(p)}</TableCell>
                      {isPatrao && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(p)}
                              aria-label={`Editar ${p.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setToArchive(p)}
                              aria-label={`Arquivar ${p.name}`}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Lista mobile */}
          <div className="md:hidden space-y-2">
            {filtered.map((p) => (
              <Card key={p.id} className={cn(!p.active && 'opacity-50')}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      {!p.active && (
                        <Badge variant="outline" className="shrink-0">
                          arquivado
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.category} · {p.unit}
                      {isPatrao && ` · custo ${formatMoney(p.costPrice ?? 0, currency)}`}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">
                        {formatMoney(p.salePrice, currency)}
                      </span>
                      {stockBadge(p)}
                    </div>
                  </div>
                  {isPatrao && (
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => openEdit(p)}
                        aria-label={`Editar ${p.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        onClick={() => setToArchive(p)}
                        aria-label={`Arquivar ${p.name}`}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Altere os dados do produto. O stock é gerido no separador Stock.'
                : 'O stock inicial fica registado como movimento de entrada.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-name">Nome do produto *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Arroz 1kg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-cat">Categoria</Label>
                <Input
                  id="p-cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Ex.: Alimentos"
                  list="cat-list"
                />
                <datalist id="cat-list">
                  {mergeCategories(productsQuery.data?.categories ?? []).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1.5">
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger aria-label="Unidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {isPatrao && (
                <div className="grid gap-1.5">
                  <Label htmlFor="p-cost">Preço de custo ({currency})</Label>
                  <Input
                    id="p-cost"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    placeholder="0"
                  />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="p-sale">Preço de venda ({currency}) *</Label>
                <Input
                  id="p-sale"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            {isPatrao && margin !== null && (
              <p className={cn('text-xs font-medium', margin >= 0 ? 'text-primary' : 'text-destructive')}>
                Margem por unidade:{' '}
                {formatMoney(
                  Number(form.salePrice.replace(',', '.')) -
                    (Number(form.costPrice.replace(',', '.')) || 0),
                  currency,
                )}{' '}
                ({margin.toFixed(0)}%)
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {!editing && (
                <div className="grid gap-1.5">
                  <Label htmlFor="p-stock">Stock inicial</Label>
                  <Input
                    id="p-stock"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="p-min">Alerta de stock mínimo</Label>
                <Input
                  id="p-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                />
              </div>
            </div>
            {editing && (
              <label className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">Produto ativo</span>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                  aria-label="Produto ativo"
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canSubmit || saveMutation.isPending}
            >
              {editing ? 'Guardar alterações' : 'Criar produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar arquivo */}
      <AlertDialog open={toArchive !== null} onOpenChange={(v) => !v && setToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar “{toArchive?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto deixa de aparecer nas vendas. O histórico de vendas é mantido. Se nunca
              tiver vendido nada, será eliminado a definitivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => toArchive && archiveMutation.mutate(toArchive.id)}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dica para reativar arquivados */}
      {isPatrao && showArchived && filtered.some((p) => !p.active) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
          Para reativar um produto arquivado, edite-o e ligue “Ativo”.
        </p>
      )}
    </div>
  )
}
