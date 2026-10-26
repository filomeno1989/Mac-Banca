'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Save,
  Store,
  Wrench,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Phone,
  Hash,
  MapPin,
  MessageSquareText,
  Database,
  Upload,
  BookOpen,
  TriangleAlert,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api-client'
import { getInstalledVersion, fetchLatestRelease, compareVersions, openExternal } from '@/lib/version'
import { downloadAndInstallApk, isNativeApp } from '@/lib/updater'
import type { Settings, User } from '@/lib/types'
import type { ViewKey } from './banca-app'

export default function DefinicoesView({
  user,
  onNavigate,
}: {
  user: User
  onNavigate?: (v: ViewKey) => void
}) {
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
          ownerPhone: form?.ownerPhone ?? '',
          nuit: form?.nuit ?? '',
          address: form?.address ?? '',
          receiptFooter: form?.receiptFooter ?? '',
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

      <PrinterCard />

      <BackupCard />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Ajuda e tutorial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Guia completo da banca, sempre atualizado a cada nova versão: vender, recibos,
            backup, exportações e mais.
          </p>
          <Button variant="outline" className="w-fit" onClick={() => onNavigate?.('ajuda')}>
            <BookOpen className="h-4 w-4" />
            Abrir tutorial
          </Button>
        </CardContent>
      </Card>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="s-phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Contacto / WhatsApp do patrão
                  </Label>
                  <Input
                    id="s-phone"
                    type="tel"
                    inputMode="tel"
                    value={form.ownerPhone ?? ''}
                    onChange={(e) => setEdits({ ...edits, ownerPhone: e.target.value })}
                    placeholder="Ex.: 84 123 4567"
                    maxLength={24}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="s-nuit" className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" />
                    NUIT da banca
                  </Label>
                  <Input
                    id="s-nuit"
                    inputMode="numeric"
                    value={form.nuit ?? ''}
                    onChange={(e) => setEdits({ ...edits, nuit: e.target.value })}
                    placeholder="Ex.: 123456789"
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-address" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Endereço / local da banca
                </Label>
                <Input
                  id="s-address"
                  value={form.address ?? ''}
                  onChange={(e) => setEdits({ ...edits, address: e.target.value })}
                  placeholder="Ex.: Av. 25 de Setembro, Mercado Central, Maputo"
                  maxLength={160}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-footer" className="flex items-center gap-1.5">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Mensagem no rodapé dos recibos
                </Label>
                <Input
                  id="s-footer"
                  value={form.receiptFooter ?? ''}
                  onChange={(e) => setEdits({ ...edits, receiptFooter: e.target.value })}
                  placeholder="Ex.: Obrigado pela preferência! Volte sempre."
                  maxLength={200}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Estes dados aparecem nos recibos (WhatsApp, impresso e PDF) e nas exportações
                de CSV e PDF. O contacto é também o destino rápido do botão WhatsApp.
              </p>
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

        </>
      )}
    </div>
  )
}

/** Cartão de atualizações: instala a nova versão direto na app (APK nativo) */
function UpdatesCard() {
  const [installed, setInstalled] = useState<{ version: string; source: 'apk' | 'web' } | null>(null)
  const [latest, setLatest] = useState<{ version: string; url: string } | null>(null)
  const [state, setState] = useState<
    'checking' | 'ok' | 'update' | 'error' | 'installing' | 'opened'
  >('checking')
  const [progress, setProgress] = useState(0)
  const native = isNativeApp()

  const check = useCallback(async () => {
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
    // fora do corpo direto do efeito para não causar render em cascata
    const t = setTimeout(() => void check(), 0)
    return () => clearTimeout(t)
  }, [check])

  const install = async () => {
    if (!latest) return
    // navegador (PWA): mantém o fluxo de descarregar no browser
    if (!native) {
      openExternal(latest.url)
      return
    }
    setState('installing')
    setProgress(0)
    try {
      await downloadAndInstallApk(latest.url, (p) => setProgress(p.percent))
      setState('opened')
      toast.success('Instalador aberto. Siga as instruções do aparelho.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na atualização', { duration: 8000 })
      setState('update')
    }
  }

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

        {(state === 'update' || state === 'installing') && latest && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
            <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4" />
              Nova versão v{latest.version} disponível
            </p>
            {state === 'installing' ? (
              <div className="space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900/60">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  {progress > 0
                    ? `A descarregar... ${progress}%`
                    : 'A ligar ao servidor de atualizações...'}
                </p>
              </div>
            ) : (
              <Button size="sm" onClick={() => void install()}>
                <Download className="h-4 w-4" />
                Atualizar agora
              </Button>
            )}
            {!native && state === 'update' && (
              <p className="text-xs text-muted-foreground">
                O ficheiro .apk abre no navegador. Depois de descarregar, abra-o no telemóvel para
                instalar por cima (os dados ficam intactos).
              </p>
            )}
          </div>
        )}

        {state === 'opened' && (
          <p className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Instalador aberto: siga as instruções do aparelho e abra a app de novo ao terminar.
          </p>
        )}

        {state === 'error' && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Não foi possível verificar atualizações agora (sem internet?).
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setState('checking')
            void check()
          }}
          disabled={state === 'checking' || state === 'installing'}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Verificar novamente
        </Button>
      </CardContent>
    </Card>
  )
}

/** Cartão da impressora: largura do papel e impressão automática dos recibos */
function PrinterCard() {
  const qc = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })

  const current = settingsQuery.data?.settings
  const [width, setWidth] = useState<string | null>(null)
  const [auto, setAuto] = useState<boolean | null>(null)
  const w = width ?? current?.printerWidth ?? '80'
  const autoPrint = auto ?? current?.autoPrintReceipt ?? false

  const save = useMutation({
    mutationFn: () =>
      api<{ settings: Settings }>('/api/settings', {
        method: 'PATCH',
        json: { printerWidth: w, autoPrintReceipt: autoPrint },
      }),
    onSuccess: (r) => {
      toast.success('Impressora guardada!')
      setWidth(null)
      setAuto(null)
      qc.setQueryData(['settings'], r)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao guardar'),
  })

  const dirty = width !== null || auto !== null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Impressora de recibos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Largura do papel</Label>
            <Select value={w} onValueChange={setWidth}>
              <SelectTrigger aria-label="Largura do papel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58">Bobina 58 mm (pequena)</SelectItem>
                <SelectItem value="80">Bobina 80 mm (grande)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span>
            <span className="block text-sm font-medium">Imprimir recibo após cada venda</span>
            <span className="block text-xs text-muted-foreground">
              Abre a impressão sozinho quando a venda é finalizada.
            </span>
          </span>
          <Switch checked={autoPrint} onCheckedChange={setAuto} aria-label="Imprimir após cada venda" />
        </label>
        <p className="text-xs text-muted-foreground">
          A impressão usa o sistema do aparelho (qualquer impressora configurada). Impessoras
          térmicas Bluetooth ligadas direto na app chegam numa próxima versão.
        </p>
        <Button
          className="w-fit"
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
        >
          <Save className="h-4 w-4" />
          Guardar impressora
        </Button>
      </CardContent>
    </Card>
  )
}

/** Cartão de backup: descarrega TODOS os dados ou restaura de um ficheiro */
function BackupCard() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ json: string; counts: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const download = async () => {
    try {
      const r = await fetch('/api/backup')
      if (!r.ok) throw new Error()
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `backup-mac-banca-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
      toast.success('Backup descarregado. Guarde-o num lugar seguro (WhatsApp, e-mail ou pen).')
    } catch {
      toast.error('Não foi possível gerar o backup agora.')
    }
  }

  const onFile = async (f: File) => {
    try {
      const text = await f.text()
      const parsed = JSON.parse(text) as {
        app?: string
        counts?: Record<string, number>
      }
      if (parsed?.app !== 'mac-banca') {
        toast.error('Este ficheiro não parece um backup do Mac Banca.')
        return
      }
      const c = parsed.counts
      setPending({
        json: text,
        counts: c
          ? `${c.users ?? 0} contas, ${c.products ?? 0} produtos, ${c.sales ?? 0} vendas, ${c.closures ?? 0} fechos`
          : 'dados do ficheiro',
      })
    } catch {
      toast.error('Não foi possível ler o ficheiro.')
    }
  }

  const restore = async () => {
    if (!pending) return
    setBusy(true)
    try {
      const r = await api<{ restored: Record<string, number> }>('/api/backup', {
        method: 'POST',
        json: JSON.parse(pending.json),
      })
      const n = r.restored
      toast.success(
        `Backup restaurado: ${n.products} produtos, ${n.sales} vendas, ${n.users} contas.`,
        { duration: 6000 },
      )
      qc.invalidateQueries()
      setPending(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao restaurar o backup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" />
          Backup e restauro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Guarda tudo num ficheiro: produtos (com fotos), vendas, stock, fechos, contas e
definições. Faça um backup regularmente (por exemplo, uma vez por semana) e antes de atualizar o
sistema.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void download()}>
            <Download className="h-4 w-4" />
            Descarregar backup
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            Restaurar de ficheiro
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </div>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          Restaurar substitui TUDO pelo conteúdo do ficheiro. Use apenas um backup que inclua a
          sua conta de patrão: se a conta não existir no ficheiro, volta ao ecrã de entrada.
        </p>
      </CardContent>

      <AlertDialog open={pending !== null} onOpenChange={(v) => !v && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar este backup?</AlertDialogTitle>
            <AlertDialogDescription>
              O ficheiro contém {pending?.counts}. Todos os dados atuais serão substituídos pelo
              conteúdo do backup. Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void restore()
              }}
            >
              {busy ? 'A restaurar...' : 'Sim, restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
