'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LockKeyhole, CheckCircle2, AlertTriangle, Wallet, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { api } from '@/lib/api-client'
import type { Closure, Settings } from '@/lib/types'
import { formatMoney, formatDateTime, paymentLabel } from '@/lib/format'
import { dayString } from '@/lib/tz'
import { cn } from '@/lib/utils'

interface DaySummary {
  day: string
  numSales: number
  totalSales: number
  totalProfit: number
  byPayment: Record<string, { total: number; num: number }>
  expectedCash: number
  openingCash: number
  closed: boolean
}

export default function FechosView() {
  const qc = useQueryClient()
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })
  const currency = settingsQuery.data?.settings.currency ?? 'MT'

  const todayQuery = useQuery({
    queryKey: ['closures-today'],
    queryFn: () => api<{ summary: DaySummary }>('/api/closures/today'),
    refetchInterval: 60_000,
  })
  const summary = todayQuery.data?.summary

  const historyQuery = useQuery({
    queryKey: ['closures'],
    queryFn: () => api<{ closures: Closure[] }>('/api/closures'),
  })
  const history = historyQuery.data?.closures ?? []

  const todayClosure = useMemo(
    () => history.find((c) => c.day === summary?.day) ?? null,
    [history, summary],
  )

  const countedNum = counted.trim() === '' ? null : Number(counted.replace(',', '.'))
  const diff = countedNum !== null && summary ? countedNum - summary.expectedCash : null

  const closeMutation = useMutation({
    mutationFn: () =>
      api('/api/closures', {
        method: 'POST',
        json: { countedCash: countedNum, notes },
      }),
    onSuccess: () => {
      toast.success('Fecho do dia guardado com sucesso! 🔒')
      setConfirmOpen(false)
      setCounted('')
      setNotes('')
      qc.invalidateQueries({ queryKey: ['closures'] })
      qc.invalidateQueries({ queryKey: ['closures-today'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao fechar o dia'),
  })

  const payments = summary ? Object.entries(summary.byPayment) : []

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Fecho de caixa</h1>
        <p className="text-sm text-muted-foreground">
          Confirme que o dinheiro da gaveta bate com as vendas em dinheiro do dia.
        </p>
      </div>

      {todayQuery.isLoading || !summary ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Resumo de hoje ({dayString(new Date())})</CardTitle>
            {summary.closed && (
              <Badge className="bg-primary/10 text-primary border-transparent">
                <CheckCircle2 className="h-3.5 w-3.5" /> Fecho feito
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Totais do dia */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Vendas do dia</p>
                <p className="mt-1 font-bold text-sm md:text-base truncate">
                  {formatMoney(summary.totalSales, currency)}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Nº vendas</p>
                <p className="mt-1 font-bold text-sm md:text-base">{summary.numSales}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Lucro</p>
                <p className="mt-1 font-bold text-sm md:text-base text-primary truncate">
                  {formatMoney(summary.totalProfit, currency)}
                </p>
              </div>
            </div>

            {/* Pagamentos */}
            <div className="rounded-lg border divide-y">
              {payments.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Ainda não há vendas hoje.
                </p>
              ) : (
                payments
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([pay, v]) => (
                    <div key={pay} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        {pay === 'DINHEIRO' ? (
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                        )}
                        {paymentLabel(pay)}
                        <span className="text-xs text-muted-foreground">({v.num})</span>
                      </span>
                      <span className="font-medium">{formatMoney(v.total, currency)}</span>
                    </div>
                  ))
              )}
            </div>

            {/* Esperado na gaveta */}
            <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">
                Esperado na gaveta = fundo de caixa ({formatMoney(summary.openingCash, currency)}) +
                vendas a dinheiro
              </p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {formatMoney(summary.expectedCash, currency)}
              </p>
            </div>

            {!summary.closed ? (
              <>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="counted">Valor contado na gaveta ({currency}) *</Label>
                    <Input
                      id="counted"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={counted}
                      onChange={(e) => setCounted(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  {diff !== null && (
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
                        diff === 0
                          ? 'bg-primary/10 text-primary'
                          : diff > 0
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-destructive/10 text-destructive',
                      )}
                    >
                      {diff === 0 ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Bate certinho, sem diferenças! 🎯
                        </>
                      ) : diff > 0 ? (
                        <>
                          <AlertTriangle className="h-4 w-4" /> Sobram{' '}
                          {formatMoney(diff, currency)} na gaveta.
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4" /> Faltam{' '}
                          {formatMoney(Math.abs(diff), currency)} na gaveta.
                        </>
                      )}
                    </div>
                  )}
                  <div className="grid gap-1.5">
                    <Label htmlFor="notes">Observações (opcional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex.: cliente ficou a dever 150 MT; troco errado à tarde..."
                      rows={2}
                    />
                  </div>
                </div>
                <Button
                  className="w-full h-12 text-base"
                  disabled={countedNum === null || Number.isNaN(countedNum)}
                  onClick={() => setConfirmOpen(true)}
                >
                  <LockKeyhole className="h-5 w-5" />
                  Fechar o dia
                </Button>
              </>
            ) : todayClosure ? (
              <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                <p className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  O fecho de hoje já foi feito por {todayClosure.user.name}
                </p>
                <div className="text-muted-foreground space-y-0.5">
                  <p>
                    Contado: <b className="text-foreground">{formatMoney(todayClosure.countedCash, currency)}</b> ·
                    Esperado: {formatMoney(todayClosure.expectedCash, currency)}
                  </p>
                  <p
                    className={cn(
                      todayClosure.difference === 0
                        ? 'text-primary'
                        : todayClosure.difference > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-destructive',
                    )}
                  >
                    Diferença: {formatMoney(todayClosure.difference, currency)}
                  </p>
                  {todayClosure.notes && <p className="italic">“{todayClosure.notes}”</p>}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico de fechos</CardTitle>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ainda não há fechos registados. Faça o primeiro no fim do dia!
            </p>
          ) : (
            <div className="space-y-1 max-h-[420px] overflow-y-auto -mx-1 px-1">
              {history.map((c) => (
                <div key={c.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                      {c.day}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        c.difference === 0
                          ? 'text-primary border-primary/40'
                          : c.difference > 0
                            ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                            : 'text-destructive border-destructive/40',
                      )}
                    >
                      {c.difference > 0 ? '+' : ''}
                      {formatMoney(c.difference, currency)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      Contado: <b className="text-foreground">{formatMoney(c.countedCash, currency)}</b>
                    </span>
                    <span>Vendas: {formatMoney(c.totalSales, currency)}</span>
                    <span>Lucro: {formatMoney(c.totalProfit, currency)}</span>
                    <span>{c.numSales} vendas</span>
                  </div>
                  {c.notes && <p className="text-xs italic text-muted-foreground">“{c.notes}”</p>}
                  <p className="text-[11px] text-muted-foreground">
                    Feito em {formatDateTime(c.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmar fecho */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar o dia de hoje?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai registar {formatMoney(countedNum ?? 0, currency)} contados vs{' '}
              {formatMoney(summary?.expectedCash ?? 0, currency)} esperados. Depois de fechar, o
              resumo de hoje fica guardado no histórico e não pode ser alterado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              Sim, fechar o dia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
