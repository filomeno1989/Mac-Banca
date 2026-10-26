/**
 * Atualização da aplicação DENTRO do APK (sem sair para o navegador).
 *
 * O plugin nativo HeliUpdate (injetado no build do APK) descarrega o ficheiro
 * .apk da nova versão e abre o instalador do Android, mostrando o progresso.
 * No navegador (PWA) o fluxo continua a ser: abrir o link no navegador.
 */

export interface NativeProgress {
  received: number
  total: number
  percent: number
}

interface HeliUpdatePlugin {
  downloadAndInstall(options: { url: string }): Promise<void>
  addListener(
    event: 'progress',
    cb: (data: NativeProgress) => void,
  ): Promise<{ remove: () => void }>
  addListener(
    event: string,
    cb: (data: unknown) => void,
  ): Promise<{ remove: () => void }>
}

function nativePlugin(): HeliUpdatePlugin | null {
  try {
    const cap = (
      window as unknown as {
        Capacitor?: {
          isNativePlatform?: () => boolean
          Plugins?: Record<string, unknown>
        }
      }
    ).Capacitor
    if (cap?.isNativePlatform?.()) {
      const p = cap.Plugins?.HeliUpdate
      if (p) return p as HeliUpdatePlugin
    }
  } catch {
    /* sem bridge nativa */
  }
  return null
}

/** Está a correr como aplicação Android (Capacitor)? */
export function isNativeApp(): boolean {
  return nativePlugin() !== null
}

/**
 * Descarrega o APK (com progresso) e abre o instalador do sistema.
 * Lança erro com mensagem pronta para mostrar ao utilizador.
 */
export async function downloadAndInstallApk(
  url: string,
  onProgress: (p: NativeProgress) => void,
): Promise<void> {
  const plugin = nativePlugin()
  if (!plugin) {
    throw new Error('Atualização direta só está disponível na aplicação Android.')
  }

  let removeListener: (() => void) | null = null
  try {
    const listener = await plugin.addListener('progress', (data) => {
      if (data && typeof data.percent === 'number') onProgress(data)
    })
    removeListener = () => listener?.remove?.()
  } catch {
    /* sem progresso: seguir sem barra */
  }

  try {
    await plugin.downloadAndInstall({ url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e ?? '')
    if (msg.includes('fontes desconhecidas')) {
      throw new Error(
        'Falta autorizar a instalação: volte à app e toque em "Atualizar agora" de novo após dar a permissão.',
      )
    }
    if (msg.includes('Falha ao descarregar')) throw new Error(msg)
    throw new Error('Não foi possível descarregar a atualização. Verifique a internet e tente de novo.')
  } finally {
    removeListener?.()
  }
}
