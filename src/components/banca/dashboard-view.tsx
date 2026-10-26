'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  ShoppingBasket,
  Boxes,
  AlertTriangle,
  ArrowRight,
  Receipt,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isPrivileged } from '@/lib/auth-client'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
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
import type { DashboardData, Settings, User, Role } from '@/lib/types'
import { formatMoney, formatDateTime, paymentLabel, greeting } from '@/lib/format'
import type { ViewKey } from './banca-app'
import SaleDetailsDialog from './sale-details-dialog'

const chartColors = {
  total: 'var(--chart-1)',
  profit: 'var(--chart-2)',
}

function KpiCard({
  title,
  value,
  icon: Icon,
  hint,
  hintTone,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  hint?: string
  hintTone?: 'up' | 'down'
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1.5 text-xl md:text-2xl font-bold tracking-tight truncate">{value}</p>
        {hint && (
          <p
            className={`mt-1 flex items-center gap-1 text-xs ${
              hintTone === 'up'
                ? 'text-primary'
                : hintTone === 'down'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
            }`}
          >
            {hintTone === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : hintTone === 'down' ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardView({
  user,
  onNavigate,
}: {
  user: User
  onNavigate: (v: ViewKey) => void
}) {
  const [saleId, setSaleId] = useState<number | null>(null)
  const isPatrao = isPrivileged(user.role)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })
  const currency = settingsQuery.data?.settings.currency ?? 'MT'

  const dashQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/api/stats/dashboard'),
    refetchInterval: 60_000,
  })
  const data = dashQuery.data

  const pct =
    data?.yesterday && data.yesterday.totalSales > 0
      ? Math.round(((data.today.totalSales - data.yesterday.totalSales) / data.yesterday.totalSales) * 100)
      : null

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">
          {greeting()}, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {isPatrao
            ? 'Aqui está o resumo do seu negócio hoje.'
            : 'Resumo das vendas de hoje na banca.'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {dashQuery.isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <KpiCard
              title="Vendas de hoje"
              value={formatMoney(data.today.totalSales, currency)}
              icon={Banknote}
              hint={
                isPatrao
                  ? pct === null
                    ? 'Sem vendas ontem'
                    : `${pct >= 0 ? '+' : ''}${pct}% vs ontem`
                  : `Você: ${formatMoney(data.today.totalMine, currency)}`
              }
              hintTone={pct === null ? undefined : pct >= 0 ? 'up' : 'down'}
            />
            {isPatrao && (
              <KpiCard
                title="Lucro de hoje"
                value={formatMoney(data.today.totalProfit, currency)}
                icon={TrendingUp}
              />
            )}
            <KpiCard
              title="Nº de vendas"
              value={String(data.today.numSales)}
              icon={ShoppingBasket}
            />
            {isPatrao ? (
              <KpiCard
                title="Valor do stock (custo)"
                value={formatMoney(data.stockValue ?? 0, currency)}
                icon={Boxes}
                hint={`${data.activeProducts} produtos ativos`}
              />
            ) : (
              <KpiCard
                title="Stock baixo"
                value={String(data.lowStock.length)}
                icon={AlertTriangle}
                hint={data.lowStock.length > 0 ? 'Ver lista abaixo' : 'Tudo em ordem'}
              />
            )}
          </>
        )}
      </div>

      {/* Gráfico últimos 7 dias */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {dashQuery.isLoading || !data ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.last7} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
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
                  {isPatrao && (
                    <Legend
                      formatter={(v: string) => (v === 'total' ? 'Vendas' : 'Lucro')}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                  )}
                  <Bar dataKey="total" fill={chartColors.total} radius={[4, 4, 0, 0]} name="total" />
                  {isPatrao && (
                    <Bar dataKey="profit" fill={chartColors.profit} radius={[4, 4, 0, 0]} name="profit" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Stock baixo */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Stock baixo
            </CardTitle>
            {isPatrao && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate('stock')}>
                Repor <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {dashQuery.isLoading || !data ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : data.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">
                Nenhum produto abaixo do mínimo. Bom trabalho! ✅
              </p>
            ) : (
              data.lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{p.name}</span>
                  <Badge
                    variant={p.stock === 0 ? 'destructive' : 'outline'}
                    className="shrink-0 text-amber-600 dark:text-amber-400"
                  >
                    {p.stock} un · mín {p.minStock}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Últimas vendas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Últimas vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {dashQuery.isLoading || !data ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : data.recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">
                Ainda não há vendas registadas. Toque em “Vender” para começar.
              </p>
            ) : (
              data.recentSales.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSaleId(s.id)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent min-h-[44px]"
                >
                  <span className="min-w-0">
                    <span className="block font-medium truncate">
                      #{s.id} · {formatMoney(s.total, currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(s.createdAt)} · {s.user.name.split(' ')[0]} · {s.itemCount} it.
                    </span>
                  </span>
                  {isPatrao && s.profit !== undefined && (
                    <Badge variant="secondary" className="shrink-0">
                      +{formatMoney(s.profit, currency)}
                    </Badge>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pagamentos de hoje (patrão) */}
      {isPatrao && data && data.byPaymentToday.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pagamentos de hoje</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.byPaymentToday.map((p) => (
              <Badge key={p.payment} variant="outline" className="px-3 py-1.5 text-xs">
                {paymentLabel(p.payment)}: {formatMoney(p.total, currency)} ({p.num})
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <SaleDetailsDialog
        saleId={saleId}
        open={saleId !== null}
        onClose={() => setSaleId(null)}
        isPatrao={isPatrao}
        currency={currency}
      />
    </div>
  )
}
