/**
 * Versão da aplicação e verificação de atualizações.
 *
 * No APK (Capacitor) a versão instalada vem do próprio pacote Android
 * (@capacitor/app). No navegador (PWA) usamos a constante abaixo.
 * A versão mais recente é consultada nas Releases do GitHub.
 */

export const APP_VERSION = '1.1.1'

export const RELEASES_URL =
  'https://api.github.com/repos/filomeno1989/Mac-Banca/releases/latest'

export interface ReleaseInfo {
  tag: string
  version: string
  downloadUrl: string
  notes: string
}

/** Versão instalada no aparelho (APK) ou versão web */
export async function getInstalledVersion(): Promise<{ version: string; source: 'apk' | 'web' }> {
  try {
    const cap = (
      window as unknown as {
        Capacitor?: {
          isNativePlatform?: () => boolean
          Plugins?: {
            App?: { getInfo: () => Promise<{ version?: string }> }
          }
        }
      }
    ).Capacitor
    if (cap?.isNativePlatform?.()) {
      const info = await cap.Plugins?.App?.getInfo()
      if (info?.version) return { version: info.version, source: 'apk' }
    }
  } catch {
    /* sem bridge nativa: seguir com a versão web */
  }
  return { version: APP_VERSION, source: 'web' }
}

/** Consulta a release mais recente (via API própria, com cache server-side) */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const r = await fetch('/api/app-release', { cache: 'no-store' })
    if (!r.ok) return null
    const d = (await r.json()) as { release: ReleaseInfo | null }
    return d.release ?? null
  } catch {
    return null
  }
}

/** Compara versões "1.2.3" - devolve >0 se a > b, 0 iguais, <0 se a < b */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x - y
  }
  return 0
}

/** Abre um link externo: no APK manda para o navegador do sistema */
export function openExternal(url: string) {
  try {
    const cap = (
      window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean }
      }
    ).Capacitor
    if (cap?.isNativePlatform?.()) {
      window.location.href = url
      return
    }
  } catch {
    /* fallback abaixo */
  }
  window.open(url, '_blank', 'noopener')
}
