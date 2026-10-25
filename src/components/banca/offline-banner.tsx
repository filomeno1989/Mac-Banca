'use client'

import { CloudOff, CloudUpload, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOffline } from './offline-provider'

/** Faixa de estado do modo offline — mostrada no topo do conteúdo */
export default function OfflineBanner() {
  const { online, pending, syncing, syncNow } = useOffline()

  if (online && pending === 0) return null

  if (!online) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900',
          'dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
        )}
        role="status"
      >
        <CloudOff className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">
          {pending > 0 ? (
            <>
              <b>Sem internet</b> — {pending} registo(s) guardado(s) neste aparelho. Continue a
              vender; sincroniza automaticamente quando a rede voltar.
            </>
          ) : (
            <>
              <b>Sem internet</b> — pode continuar a vender; tudo fica guardado e sincroniza
              sozinho depois.
            </>
          )}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm text-sky-900',
        'dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200',
      )}
      role="status"
    >
      <CloudUpload className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        Internet voltou — <b>{pending}</b> registo(s) à espera de sincronização.
      </span>
      <Button size="sm" className="h-8" onClick={() => void syncNow()} disabled={syncing}>
        {syncing ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <CloudUpload className="h-4 w-4" />
        )}
        {syncing ? 'A sincronizar...' : 'Sincronizar agora'}
      </Button>
    </div>
  )
}
