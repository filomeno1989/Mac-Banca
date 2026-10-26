'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import * as offline from '@/lib/offline'

interface OfflineCtx {
  online: boolean
  pending: number
  syncing: boolean
  lastSync: string | null
  syncNow: () => Promise<void>
  refreshPending: () => void
}

const Ctx = createContext<OfflineCtx>({
  online: true,
  pending: 0,
  syncing: false,
  lastSync: null,
  syncNow: async () => {},
  refreshPending: () => {},
})

export function useOffline() {
  return useContext(Ctx)
}

export default function OfflineProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const syncingRef = useRef(false)

  const refreshPending = useCallback(() => {
    setPending(offline.pendingCount())
    setLastSync(offline.lastSyncAt())
  }, [])

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return
    if (offline.pendingCount() === 0) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const r = await offline.syncAll()
      if (r.syncedSales > 0 || r.syncedMovements > 0) {
        const parts: string[] = []
        if (r.syncedSales > 0) parts.push(`${r.syncedSales} venda(s)`)
        if (r.syncedMovements > 0) parts.push(`${r.syncedMovements} movimento(s) de stock`)
        toast.success(`Sincronizado: ${parts.join(' e ')}`)
      }
      if (r.failed > 0) {
        toast.error(
          `${r.failed} registo(s) com problema: ${r.errors[0] ?? 'verifique com o patrão'}`,
          { duration: 8000 },
        )
      }
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
    } finally {
      syncingRef.current = false
      setSyncing(false)
      refreshPending()
    }
  }, [qc, refreshPending])

  useEffect(() => {
    setOnline(navigator.onLine)
    refreshPending()

    const onOnline = () => {
      setOnline(true)
      // pequena pausa para a rede estabilizar (Wi-Fi/celular)
      setTimeout(() => void syncNow(), 1500)
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const unsub = offline.subscribe(refreshPending)

    // tenta sincronizar periodicamente quando há pendentes
    const interval = setInterval(() => {
      if (navigator.onLine && offline.pendingCount() > 0) void syncNow()
    }, 60_000)

    // sincroniza ao abrir se houver pendentes
    if (navigator.onLine && offline.pendingCount() > 0) {
      setTimeout(() => void syncNow(), 2000)
    }

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      unsub()
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Ctx.Provider value={{ online, pending, syncing, lastSync, syncNow, refreshPending }}>{children}</Ctx.Provider>
}
