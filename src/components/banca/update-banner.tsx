'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  getInstalledVersion,
  fetchLatestRelease,
  compareVersions,
  openExternal,
} from '@/lib/version'
import { downloadAndInstallApk, isNativeApp } from '@/lib/updater'

const DISMISS_KEY = 'mb-update-dismissed'

/**
 * Banner global de atualização: aparece para TODAS as contas (patrão,
 * funcionário e IT) quando existe uma versão do APK mais recente que a
 * instalada. No APK descarrega e abre o instalador direto dentro da app;
 * no navegador mantém o fluxo do browser.
 */
export default function UpdateBanner() {
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null)
  const [hidden, setHidden] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

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

  const install = async () => {
    // navegador (PWA): descarrega pelo browser como antes
    if (!isNativeApp()) {
      openExternal(update.url)
      return
    }
    setBusy(true)
    setProgress(0)
    try {
      await downloadAndInstallApk(update.url, (p) => setProgress(p.percent))
      toast.success('Instalador aberto. Siga as instruções do aparelho.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha na atualização', { duration: 8000 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Download className="h-4 w-4 text-primary" />
        )}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium leading-tight text-primary">Nova versão v{update.version} disponível</p>
        {busy ? (
          <>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-tight">
              {progress > 0 ? `A descarregar... ${progress}%` : 'A ligar ao servidor...'}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground leading-tight">
            Instala por cima da atual, sem perder dados.
          </p>
        )}
      </div>
      {!busy && (
        <Button size="sm" onClick={() => void install()}>
          Atualizar
        </Button>
      )}
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
