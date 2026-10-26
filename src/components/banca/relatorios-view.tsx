'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, TrendingUp, Percent, ShoppingBasket, Ticket, Ban } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { api } from '@/lib/api-client'
import type { ReportData, Settings } from '@/lib/types'
import { formatMoney, paymentLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

type Range = 'hoje' | '7dias' | 'mes' | 'mesPassado' | 'custom'

function Kpi({
  title,
  value,
  icon: Icon,
  sub,
  accent,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  sub?: string
  accent?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p
          className={cn(
            'mt-1.5 text-lg md:text-xl font-bold tracking-tight truncate',
            accent && 'text-primary',
          )}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function RelatoriosView() {
  const [range, setRange] = useState<Range>('7dias')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })
  const currency = settingsQuery.data?.settings.currency ?? 'MT'

  const query = useQuery({
    queryKey: ['reports', range, applied],
    queryFn: () => {
      const params = new URLSearchParams({ range })
      if (range === 'custom' && applied) {
        params.set('from', applied.from)
        params.set('to', applied.to)
      }
      return api<ReportData>(`/api/stats/reports?${params.toString()}`)
    },
  })
  const data = query.data

  const maxPayment = data?.byPayment[0]?.total ?? 1

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe as vendas, lucros e os produtos mais vendidos.
        </p>
      </div>

      <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto flex-nowrap">
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="7dias">7 dias</TabsTrigger>
          <TabsTrigger value="mes">Este mês</TabsTrigger>
          <TabsTrigger value="mesPassado">Mês passado</TabsTrigger>
          <TabsTrigger value="custom">Personalizado</TabsTrigger>
        </TabsList>
      </Tabs>

      {range === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="r-from">De</Label>
            <Input
              id="r-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="r-to">Até</Label>
            <Input
              id="r-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
          <Button
            onClick={() => customFrom && customTo && setApplied({ from: customFrom, to: customTo })}
          >
            Aplicar
          </Button>
        </div>
      )}

      {query.isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          {range === 'custom' && applied && (
            <p className="text-xs text-muted-foreground">
              Período: {applied.from} a {applied.to}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi
              title="Faturação"
              value={formatMoney(data.totals.totalSales, currency)}
              icon={Banknote}
              sub={`${data.totals.numSales} vendas`}
            />
            <Kpi
              title="Lucro"
              value={formatMoney(data.totals.totalProfit, currency)}
              icon={TrendingUp}
              accent
            />
            <Kpi title="Margem" value={`${data.totals.margin}%`} icon={Percent} />
            <Kpi title="Nº de vendas" value={String(data.totals.numSales)} icon={ShoppingBasket} />
            <Kpi
              title="Ticket médio"
              value={formatMoney(data.totals.avgTicket, currency)}
              icon={Ticket}
            />
          </div>

          {(data.numAnnulled > 0 || data.totalAnnulled > 0) && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Ban className="h-3.5 w-3.5" />
              {data.numAnnulled} venda(s) anulada(s) no período ({formatMoney(data.totalAnnulled, currency)}): não entram nos totais.
            </p>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Vendas por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byDay} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value: number | string, name: string) => [
                        formatMoney(Number(value), currency),
                        name === 'total' ? 'Vendas' : 'Lucro',
                      ]}
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--popover-foreground)',
                      }}
                    />
                    <Legend
                      formatter={(v: string) => (v === 'total' ? 'Vendas' : 'Lucro')}
                    />
                    <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="total" />
                    <Bar
                      dataKey="profit"
                      fill="var(--chart-2)"
                      radius={[4, 4, 0, 0]}
                      name="profit"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Pagamentos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por forma de pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.byPayment.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Sem vendas neste período.
                  </p>
                ) : (
                  data.byPayment.map((p) => (
                    <div key={p.payment} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{paymentLabel(p.payment)}</span>
                        <span className="font-medium">
                          {formatMoney(p.total, currency)}{' '}
                          <span className="text-xs text-muted-foreground">({p.num})</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(4, (p.total / (maxPayment || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Top produtos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Produtos mais vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Sem vendas neste período.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Lucro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topProducts.map((p, i) => (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">
                            <span className="mr-1.5 text-xs text-muted-foreground">
                              {i + 1}.
                            </span>
                            {p.name}
                          </TableCell>
                          <TableCell className="text-right">{p.qty}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(p.revenue, currency)}
                          </TableCell>
                          <TableCell className="text-right text-primary font-medium">
                            {formatMoney(p.profit, currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
