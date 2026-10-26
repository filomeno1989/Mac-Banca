'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Store, Info, Wrench, RefreshCw, Download, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api-client'
import { getInstalledVersion, fetchLatestRelease, compareVersions, openExternal } from '@/lib/version'
import type { Settings, User } from '@/lib/types'

export default function DefinicoesView({ user }: { user: User }) {
  const qc = useQueryClient()
  // Formulário local: enquanto não há edições, mostra os dados do servidor
  const [edits, setEdits] = useState<Partial<Settings> | null>(null)
  const isIt = user.role === 'IT'

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })

  const form: Settings | null = settingsQuery.data
    ? {
        ...settingsQuery.data.settings,
        ...(edits ?? {}),
      }
    : null

  const saveMutation = useMutation({
    mutationFn: () =>
      api<{ settings: Settings }>('/api/settings', {
        method: 'PATCH',
        json: {
          businessName: form?.businessName,
          currency: form?.currency,
          openingCash: Number(String(form?.openingCash ?? 0).replace(',', '.')),
        },
      }),
    onSuccess: (r) => {
      toast.success('Definições guardadas!')
      setEdits(null)
      qc.setQueryData(['settings'], r)
      qc.invalidateQueries({ queryKey: ['closures-today'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao guardar'),
  })

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Definições</h1>
        <p className="text-sm text-muted-foreground">
          Personalize o sistema para a sua banca.
        </p>
      </div>

      {isIt && <MaintenanceCard settings={settingsQuery.data?.settings} />}

      <UpdatesCard />

      {settingsQuery.isLoading || !form ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" />
                Dados da banca
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="s-name">Nome da banca</Label>
                <Input
                  id="s-name"
                  value={form.businessName}
                  onChange={(e) => setEdits({ ...edits, businessName: e.target.value })}
                  placeholder="Ex.: Banca do João"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="s-currency">Símbolo da moeda</Label>
                  <Input
                    id="s-currency"
                    value={form.currency}
                    onChange={(e) => setEdits({ ...edits, currency: e.target.value })}
                    placeholder="MT"
                    maxLength={6}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="s-fundo">Fundo de caixa inicial ({form.currency})</Label>
                  <Input
                    id="s-fundo"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={String(form.openingCash)}
                    onChange={(e) =>
                      setEdits({ ...edits, openingCash: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O fundo de caixa é o dinheiro que fica na gaveta no início do dia (para dar
                troco). É somado às vendas em dinheiro para saber quanto deveria haver na gaveta
                no fecho.
              </p>
              <Button
                className="w-fit"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4" />
                Guardar definições
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Como funciona o sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <b className="text-foreground">Patrão (você):</b> vê e controla tudo: produtos com
                preços de custo, lucros, stock, fechos de caixa, relatórios e contas de acesso.
                Faça o fecho do dia na aba “Fechos” e confirme se o dinheiro da gaveta bate.
              </p>
              <p>
                <b className="text-foreground">Funcionário:</b> entra com o próprio PIN e só vê o
                que precisa: registo de vendas, produtos (sem preços de custo) e níveis de stock.
                Não vê lucros nem relatórios.
              </p>
              <p>
                <b className="text-foreground">Vendas:</b> o stock baixa automaticamente a cada
                venda e o lucro é calculado pela diferença entre preço de venda e custo. Pode
                anular uma venda (pelo painel do patrão) e o stock volta.
              </p>
              <p>
                <b className="text-foreground">Stock:</b> quando um produto chega ao mínimo, o
                sistema avisa no painel: altura de comprar ao grossista e registar a entrada.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

/** Cartão de atualizações: versão instalada e nova versão do APK no GitHub */
function UpdatesCard() {
  const [installed, setInstalled] = useState<{ version: string; source: 'apk' | 'web' } | null>(null)
  const [latest, setLatest] = useState<{ version: string; url: string } | null>(null)
  const [state, setState] = useState<'checking' | 'ok' | 'update' | 'error'>('checking')

  const check = useCallback(async () => {
    setState('checking')
    try {
      const inst = await getInstalledVersion()
      setInstalled(inst)
      const rel = await fetchLatestRelease()
      if (rel && rel.downloadUrl) {
        setLatest({ version: rel.version, url: rel.downloadUrl })
        setState(compareVersions(rel.version, inst.version) > 0 ? 'update' : 'ok')
      } else {
        setLatest(null)
        setState('error')
      }
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Aplicação e atualizações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Versão instalada: <b className="text-foreground">v{installed?.version ?? '...'}</b>
          {installed && (
            <span className="text-xs">
              {' '}
              ({installed.source === 'apk' ? 'aplicação Android' : 'versão web'})
            </span>
          )}
        </p>

        {state === 'checking' && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            A procurar atualizações...
          </p>
        )}

        {state === 'ok' && (
          <p className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Está atualizado (última versão: v{latest?.version}).
          </p>
        )}

        {state === 'update' && latest && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
            <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4" />
              Nova versão v{latest.version} disponível
            </p>
            <Button size="sm" onClick={() => openExternal(latest.url)}>
              <Download className="h-4 w-4" />
              Descarregar atualização
            </Button>
            <p className="text-xs text-muted-foreground">
              O ficheiro .apk abre no navegador. Depois de descarregar, abra-o no telemóvel para
              instalar por cima (os dados ficam intactos).
            </p>
          </div>
        )}

        {state === 'error' && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Não foi possível verificar atualizações agora (sem internet?).
          </p>
        )}

        <Button variant="outline" size="sm" onClick={() => void check()} disabled={state === 'checking'}>
          <RefreshCw className="h-3.5 w-3.5" />
          Verificar novamente
        </Button>
      </CardContent>
    </Card>
  )
}

/** Painel de manutenção: exclusivo do técnico (IT) */
function MaintenanceCard({ settings }: { settings?: Settings }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')

  const current = settings
  const active = mode ?? current?.maintenanceMode ?? false
  const msg = message !== '' ? message : (current?.maintenanceMessage ?? '')

  const save = useMutation({
    mutationFn: () =>
      api<{ settings: Settings }>('/api/settings', {
        method: 'PATCH',
        json: { maintenanceMode: active, maintenanceMessage: msg },
      }),
    onSuccess: (r) => {
      toast.success(
        r.settings.maintenanceMode
          ? 'Manutenção ATIVADA: só o técnico pode entrar.'
          : 'Manutenção desativada: sistema aberto.',
      )
      setMode(null)
      setMessage('')
      qc.setQueryData(['settings'], r)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao guardar'),
  })

  return (
    <Card className={active ? 'border-amber-400 dark:border-amber-500/50' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Modo manutenção
          <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Técnico (IT)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Sistema em manutenção</p>
            <p className="text-xs text-muted-foreground">
              Bloqueia patrão e funcionários; só o técnico consegue entrar e operar.
            </p>
          </div>
          <Switch checked={active} onCheckedChange={(v) => setMode(v)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="maint-msg">Mensagem exibida durante a manutenção</Label>
          <Input
            id="maint-msg"
            value={msg}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex.: Estamos a atualizar o sistema. Volta às 14h."
            maxLength={300}
          />
        </div>
        <Button
          className="w-fit"
          onClick={() => save.mutate()}
          disabled={save.isPending || mode === null}
        >
          <Save className="h-4 w-4" />
          Guardar manutenção
        </Button>
      </CardContent>
    </Card>
  )
}
