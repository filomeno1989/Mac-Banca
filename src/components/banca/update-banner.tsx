'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getInstalledVersion,
  fetchLatestRelease,
  compareVersions,
  openExternal,
} from '@/lib/version'

const DISMISS_KEY = 'mb-update-dismissed'

/**
 * Banner global de atualização: aparece para TODAS as contas (patrão,
 * funcionário e IT) quando existe uma versão do APK mais recente que a
 * instalada. O funcionário pode assim atualizar sozinho, sem depender
 * das Definições.
 */
export default function UpdateBanner() {
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { version } = await getInstalledVersion()
      const latest = await fetchLatestRelease()
      if (
        alive &&
        latest &&
        latest.downloadUrl &&
        compareVersions(latest.version, version) > 0 &&
        localStorage.getItem(`${DISMISS_KEY}-v${latest.version}`) !== '1'
      ) {
        setUpdate({ version: latest.version, url: latest.downloadUrl })
        setHidden(false)
      }
    })().catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!update || hidden) return null

  const dismiss = () => {
    try {
      localStorage.setItem(`${DISMISS_KEY}-v${update.version}`, '1')
    } catch {
      /* sem localStorage: só esconder nesta sessão */
    }
    setHidden(true)
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Download className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium leading-tight text-primary">Nova versão v{update.version} disponível</p>
        <p className="text-xs text-muted-foreground leading-tight">
          Instala por cima da atual, sem perder dados.
        </p>
      </div>
      <Button size="sm" onClick={() => openExternal(update.url)}>
        Descarregar
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        aria-label="Dispensar aviso de atualização"
        className="shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
