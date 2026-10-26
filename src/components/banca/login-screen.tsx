'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Delete, LogIn, ShieldCheck, UserRound, Wrench, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { APP_VERSION, getInstalledVersion, fetchLatestRelease, compareVersions, openExternal } from '@/lib/version'
import type { User } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/format'
import type { Role } from '@/lib/types'

interface LoginUser {
  id: number
  name: string
  role: string
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** Rodapé de versão: mostra a versão instalada e avisa se há atualização do APK */
function VersionFooter() {
  const [installed, setInstalled] = useState<string | null>(null)
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { version } = await getInstalledVersion()
      if (!alive) return
      setInstalled(version)
      const latest = await fetchLatestRelease()
      if (alive && latest && compareVersions(latest.version, version) > 0 && latest.downloadUrl) {
        setUpdate({ version: latest.version, url: latest.downloadUrl })
      }
    })().catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-1">
      {update && (
        <button
          type="button"
          onClick={() => openExternal(update.url)}
          className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Download className="h-3 w-3" />
          Nova versão v{update.version} disponível. Descarregar
        </button>
      )}
      <p className="text-[10px] text-muted-foreground/40 select-none">
        v{installed ?? APP_VERSION}
      </p>
      <p className="text-[10px] italic text-muted-foreground/25 select-none">F. M. J. A.</p>
    </div>
  )
}

export default function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [selected, setSelected] = useState<LoginUser | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  // Acesso técnico oculto (IT)
  const [itOpen, setItOpen] = useState(false)
  const [itUsername, setItUsername] = useState('')
  const [itPin, setItPin] = useState('')
  const [itBusy, setItBusy] = useState(false)

  const usersQuery = useQuery({
    queryKey: ['login-users'],
    queryFn: () => api<{ users: LoginUser[] }>('/api/auth/login'),
  })

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () =>
      api<{
        settings: {
          businessName: string
          currency: string
          maintenanceMode?: boolean
          maintenanceMessage?: string | null
        }
      }>('/api/settings'),
    staleTime: Infinity,
    refetchInterval: 60_000,
  })

  const users = (usersQuery.data?.users ?? []).filter((u) => u.role !== 'IT')
  const businessName = settingsQuery.data?.settings.businessName ?? 'Minha Banca'
  const maintenance = settingsQuery.data?.settings.maintenanceMode
    ? settingsQuery.data.settings
    : null

  const submitIt = async () => {
    if (itBusy) return
    setItBusy(true)
    try {
      const r = await api<{ user: User }>('/api/auth/login', {
        method: 'POST',
        json: { username: itUsername.trim(), pin: itPin },
      })
      toast.success(`Bem-vindo, ${r.user.name}!`)
      setItOpen(false)
      setItPin('')
      onLogin(r.user)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao entrar')
    } finally {
      setItBusy(false)
    }
  }

  const submit = async (finalPin: string) => {
    if (!selected || busy) return
    setBusy(true)
    try {
      const r = await api<{ user: User }>('/api/auth/login', {
        method: 'POST',
        json: { userId: selected.id, pin: finalPin },
      })
      toast.success(`Bem-vindo, ${r.user.name}!`)
      onLogin(r.user)
    } catch (e) {
      setError(true)
      setPin('')
      toast.error(e instanceof Error ? e.message : 'Erro ao entrar')
      setTimeout(() => setError(false), 600)
    } finally {
      setBusy(false)
    }
  }

  const press = (digit: string) => {
    setError(false)
    setPin((p) => (p.length < 6 ? p + digit : p))
  }
  const back = () => setPin((p) => p.slice(0, -1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
      else if (e.key === 'Enter' && pin.length >= 4) submit(pin)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, pin, busy])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <img
            src="/icons/icon-192.png"
            alt="Mac Banca"
            className="h-20 w-20 rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl font-bold tracking-tight">{businessName}</h1>
        </div>

        {maintenance && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>Sistema em manutenção.</b>
              {maintenance.maintenanceMessage ? ` ${maintenance.maintenanceMessage}` : ''}
            </span>
          </div>
        )}

        {!selected ? (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium text-center text-muted-foreground pb-2">
                Quem está a usar o sistema?
              </p>
              {usersQuery.isLoading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6">
                  Nenhum utilizador criado ainda.
                </p>
              ) : (
                users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelected(u)
                      setPin('')
                      setError(false)
                    }}
                    className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent min-h-[44px]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {initials(u.name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{u.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABELS[u.role as Role] ?? u.role}
                      </span>
                    </span>
                    <LogIn className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3 pb-1">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {initials(selected.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selected.name}</p>
                  <Badge variant="secondary" className="mt-0.5">
                    {ROLE_LABELS[selected.role as Role] ?? selected.role}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  Trocar
                </Button>
              </div>

              <div
                className={cn(
                  'flex justify-center gap-2 py-3',
                  error && 'animate-pulse text-destructive',
                )}
                aria-label="PIN digitado"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-3.5 w-3.5 rounded-full border-2 transition-colors',
                      i < pin.length
                        ? error
                          ? 'border-destructive bg-destructive'
                          : 'border-primary bg-primary'
                        : 'border-muted-foreground/30',
                    )}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <Button
                    key={d}
                    variant="outline"
                    className="h-14 text-xl font-semibold"
                    onClick={() => press(d)}
                    disabled={busy}
                    aria-label={`Dígito ${d}`}
                  >
                    {d}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="h-14"
                  onClick={back}
                  disabled={busy || pin.length === 0}
                  aria-label="Apagar"
                >
                  <Delete className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  className="h-14 text-xl font-semibold"
                  onClick={() => press('0')}
                  disabled={busy}
                  aria-label="Dígito 0"
                >
                  0
                </Button>
                <Button
                  className="h-14"
                  onClick={() => submit(pin)}
                  disabled={busy || pin.length < 4}
                  aria-label="Entrar"
                >
                  <UserRound className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2 text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acesso protegido por PIN · Só entram utilizadores autorizados
          </p>
          <button
            type="button"
            onClick={() => setItOpen(true)}
            className="text-[11px] text-muted-foreground/40 transition-colors hover:text-muted-foreground"
            aria-label="Acesso técnico"
          >
            Acesso técnico
          </button>
          <VersionFooter />
        </div>
      </div>

      <Dialog open={itOpen} onOpenChange={setItOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Acesso técnico (IT)
            </DialogTitle>
            <DialogDescription>Área reservada ao técnico de manutenção.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="it-user">Utilizador</Label>
              <Input
                id="it-user"
                value={itUsername}
                onChange={(e) => setItUsername(e.target.value)}
                placeholder="ex.: admin"
                autoComplete="username"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="it-pin">Código de acesso</Label>
              <Input
                id="it-pin"
                type="password"
                inputMode="numeric"
                value={itPin}
                onChange={(e) => setItPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && itUsername && itPin && void submitIt()}
                placeholder="****"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => void submitIt()}
              disabled={itBusy || !itUsername.trim() || !itPin}
            >
              <LogIn className="h-4 w-4" />
              Entrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
