'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store,
  Home,
  ShoppingCart,
  Package,
  Warehouse,
  LockKeyhole,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  Menu,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import type { Settings, User, Role } from '@/lib/types'
import { ROLE_LABELS, greeting } from '@/lib/format'
import { isPrivileged } from '@/lib/auth-client'
import type { ViewKey } from './banca-app'
import OfflineBanner from './offline-banner'
import DashboardView from './dashboard-view'
import VendaView from './venda-view'
import ProdutosView from './produtos-view'
import StockView from './stock-view'
import FechosView from './fechos-view'
import RelatoriosView from './relatorios-view'
import FuncionariosView from './funcionarios-view'
import DefinicoesView from './definicoes-view'

interface NavItem {
  key: ViewKey
  label: string
  icon: LucideIcon
  patraoOnly?: boolean
}

const NAV: NavItem[] = [
  { key: 'inicio', label: 'Início', icon: Home },
  { key: 'vender', label: 'Vender', icon: ShoppingCart },
  { key: 'produtos', label: 'Produtos', icon: Package },
  { key: 'stock', label: 'Stock', icon: Warehouse },
  { key: 'fechos', label: 'Fechos', icon: LockKeyhole, patraoOnly: true },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3, patraoOnly: true },
  { key: 'funcionarios', label: 'Funcionários', icon: Users, patraoOnly: true },
  { key: 'definicoes', label: 'Definições', icon: SettingsIcon, patraoOnly: true },
]

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Alternar tema claro/escuro"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}

function UserBadge({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
        {user.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground leading-tight">
          {ROLE_LABELS[user.role as Role] ?? user.role}
        </p>
      </div>
    </div>
  )
}

export default function AppShell({
  user,
  view,
  setView,
  onLogout,
}: {
  user: User
  view: ViewKey
  setView: (v: ViewKey) => void
  onLogout: () => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const isPatrao = isPrivileged(user.role)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })
  const businessName = settingsQuery.data?.settings.businessName ?? 'Minha Banca'

  const nav = NAV.filter((n) => !n.patraoOnly || isPatrao)
  const go = (v: ViewKey) => {
    setView(v)
    setMoreOpen(false)
    window.scrollTo({ top: 0 })
  }

  const renderView = () => {
    switch (view) {
      case 'inicio':
        return <DashboardView user={user} onNavigate={go} />
      case 'vender':
        return <VendaView user={user} />
      case 'produtos':
        return <ProdutosView user={user} />
      case 'stock':
        return <StockView user={user} />
      case 'fechos':
        return <FechosView />
      case 'relatorios':
        return <RelatoriosView />
      case 'funcionarios':
        return <FuncionariosView />
      case 'definicoes':
        return <DefinicoesView user={user} />
    }
  }

  const mobileMain = nav.filter((n) => ['inicio', 'produtos'].includes(n.key))
  const mobileAfterVender = nav.filter((n) => !['inicio', 'produtos', 'vender'].includes(n.key))
  const mobileMore = mobileAfterVender.slice(1)
  const stockItem = mobileAfterVender[0]

  return (
    <div className="min-h-screen bg-background">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r bg-card">
        <div className="flex items-center gap-3 px-5 h-16 border-b">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </span>
          <span className="font-bold truncate">{businessName}</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Navegação principal">
          {nav.map((item) => (
            <button
              key={item.key}
              onClick={() => go(item.key)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                view === item.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              aria-current={view === item.key ? 'page' : undefined}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t p-4 space-y-3">
          <UserBadge user={user} />
          <div className="flex gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" className="flex-1" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* ---------- Header (mobile) ---------- */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b bg-card/95 backdrop-blur h-14 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-4.5 w-4.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate leading-tight">{businessName}</p>
          <p className="text-xs text-muted-foreground leading-tight">
            {greeting()}, {user.name.split(' ')[0]}
          </p>
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Terminar sessão">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* ---------- Conteúdo ---------- */}
      <main className="md:pl-64 pb-24 md:pb-10">
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <OfflineBanner />
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ---------- Bottom nav (mobile) ---------- */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegação"
      >
        <div className="grid grid-cols-5 h-16">
          {mobileMain.map((item) => (
            <button
              key={item.key}
              onClick={() => go(item.key)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[11px] font-medium min-h-[44px]',
                view === item.key ? 'text-primary' : 'text-muted-foreground',
              )}
              aria-current={view === item.key ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}

          {/* Vender — botão central destacado */}
          <button
            onClick={() => go('vender')}
            className="flex flex-col items-center justify-center -mt-5"
            aria-label="Nova venda"
          >
            <span
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full shadow-lg text-primary-foreground transition-transform active:scale-95',
                view === 'vender' ? 'bg-primary/90 ring-2 ring-primary/30' : 'bg-primary',
              )}
            >
              <ShoppingCart className="h-6 w-6" />
            </span>
            <span
              className={cn(
                'text-[11px] font-medium mt-0.5',
                view === 'vender' ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              Vender
            </span>
          </button>

          {/* Stock (à direita do Vender) */}
          {stockItem && (
            <button
              key={stockItem.key}
              onClick={() => go(stockItem.key)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[11px] font-medium min-h-[44px]',
                view === stockItem.key ? 'text-primary' : 'text-muted-foreground',
              )}
              aria-current={view === stockItem.key ? 'page' : undefined}
            >
              <stockItem.icon className="h-5 w-5" />
              {stockItem.label}
            </button>
          )}

          {/* Mais */}
          {isPatrao && mobileMore.length > 0 ? (
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 text-[11px] font-medium min-h-[44px]',
                    mobileMore.some((m) => m.key === view) ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Menu className="h-5 w-5" />
                  Mais
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader className="sr-only">
                  <SheetTitle>Mais opções</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-3 pb-4">
                  {mobileMore.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => go(item.key)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium',
                        view === item.key && 'border-primary text-primary bg-primary/5',
                      )}
                    >
                      <item.icon className="h-6 w-6" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <span className="min-h-[44px]" />
          )}
        </div>
      </nav>

      {/* Aviso de modo (desktop apenas, discreto) */}
      {user.role === 'FUNCIONARIO' && (
        <Badge variant="outline" className="hidden md:inline-flex fixed bottom-4 right-4">
          Modo funcionário — sem acesso a lucros
        </Badge>
      )}
    </div>
  )
}
