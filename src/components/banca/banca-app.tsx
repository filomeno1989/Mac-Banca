'use client'

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { Loader2, Wrench, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'
import { isPrivileged } from '@/lib/auth-client'
import type { Settings, User } from '@/lib/types'
import LoginScreen from './login-screen'
import AppShell from './app-shell'
import OfflineProvider from './offline-provider'

export type ViewKey =
  | 'inicio'
  | 'vender'
  | 'produtos'
  | 'stock'
  | 'fechos'
  | 'relatorios'
  | 'funcionarios'
  | 'definicoes'
  | 'ajuda'

const VIEW_KEYS: ViewKey[] = [
  'inicio',
  'vender',
  'produtos',
  'stock',
  'fechos',
  'relatorios',
  'funcionarios',
  'definicoes',
  'ajuda',
]
const PATRAO_ONLY_VIEWS: ViewKey[] = ['fechos', 'relatorios', 'funcionarios', 'definicoes']

/** Lê a vista do hash (#/vender). Ignora vistas sem permissão. */
function viewFromHash(user: User | null): ViewKey | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash.replace(/^#\/?/, '')
  if (!(VIEW_KEYS as string[]).includes(h)) return null
  const v = h as ViewKey
  if (PATRAO_ONLY_VIEWS.includes(v) && !(user && isPrivileged(user.role))) return null
  return v
}

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground">A carregar a banca...</p>
    </div>
  )
}

/** Ecrã cheio de manutenção para quem não é IT */
function MaintenanceOverlay({ message, onLogout }: { message?: string | null; onLogout: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Wrench className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Sistema em manutenção</h1>
        <p className="text-sm text-muted-foreground">
          {message?.trim() ||
            'Estamos a fazer melhorias. Volte a tentar dentro de alguns minutos.'}
        </p>
        <Button variant="outline" onClick={onLogout} className="w-fit">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  )
}

function BancaInner() {
  const qc = useQueryClient()
  const [view, setView] = useState<ViewKey>('inicio')

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<User | null> => {
      try {
        const r = await api<{ user: User }>('/api/auth/me')
        return r.user
      } catch {
        return null
      }
    },
    retry: false,
    staleTime: Infinity,
  })

  const user = meQuery.data ?? null

  // Histórico do navegador: a vista atual entra no histórico, para o botão
  // voltar (Android/ APK e browser) navegar dentro da app em vez de sair.
  useEffect(() => {
    if (!user) return
    const v = viewFromHash(user)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza a vista com o hash (sistema externo) no arranque da sessão
    if (v) setView(v)
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    const target = `#/${view}`
    if (window.location.hash !== target) {
      window.history.pushState({ view }, '', target)
    }
  }, [view, user])

  useEffect(() => {
    const onPop = () => {
      if (!user) return
      setView(viewFromHash(user) ?? 'inicio')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [user])

  // Estado de manutenção (poll para o patrão ver quando o técnico ativa)
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
    enabled: !!meQuery.data,
    refetchInterval: 30_000,
  })

  if (meQuery.isLoading) return <Splash />

  if (!user) {
    return (
      <LoginScreen
        onLogin={(u) => {
          qc.setQueryData(['me'], u)
          setView('inicio')
        }}
      />
    )
  }

  const maintenanceOn =
    settingsQuery.data?.settings.maintenanceMode && user.role !== 'IT'

  if (maintenanceOn) {
    return (
      <MaintenanceOverlay
        message={settingsQuery.data?.settings.maintenanceMessage}
        onLogout={async () => {
          await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
          qc.setQueryData(['me'], null)
          qc.clear()
        }}
      />
    )
  }

  return (
    <OfflineProvider>
      <AppShell
        user={user}
        view={view}
        setView={setView}
        onLogout={async () => {
          await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
          qc.setQueryData(['me'], null)
          qc.clear()
        }}
      />
    </OfflineProvider>
  )
}

export default function BancaApp() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, staleTime: 10_000, retry: 1 },
        },
      }),
  )

  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <BancaInner />
        <Toaster richColors position="top-center" closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
