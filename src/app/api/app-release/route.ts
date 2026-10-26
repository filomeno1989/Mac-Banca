import { NextResponse } from 'next/server'

/**
 * Informa a versão mais recente do APK (GitHub Releases).
 * Cache em memória de 5 minutos por instância: nunca fica preso a um valor
 * antigo e evita depender da quota/CORS do GitHub no browser do utilizador.
 */

interface ReleaseInfo {
  tag: string
  version: string
  downloadUrl: string
  notes: string
}

export const dynamic = 'force-dynamic'

let cache: { at: number; payload: { release: ReleaseInfo | null } } | null = null
const TTL = 300_000

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < TTL) {
      return NextResponse.json(cache.payload)
    }

    const r = await fetch('https://api.github.com/repos/filomeno1989/Mac-Banca/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    })
    if (!r.ok) {
      // sem resposta do GitHub: serve o último valor conhecido, se houver
      if (cache) return NextResponse.json(cache.payload)
      return NextResponse.json({ release: null })
    }
    const d = (await r.json()) as {
      tag_name?: string
      html_url?: string
      body?: string
      assets?: { name?: string; browser_download_url?: string }[]
    }
    if (!d.tag_name) {
      if (cache) return NextResponse.json(cache.payload)
      return NextResponse.json({ release: null })
    }
    const apk = (d.assets ?? []).find((a) => a.name?.endsWith('.apk'))
    const payload = {
      release: {
        tag: d.tag_name,
        version: d.tag_name.replace(/^v/, ''),
        downloadUrl: apk?.browser_download_url ?? d.html_url ?? '',
        notes: d.body ?? '',
      } as ReleaseInfo,
    }
    cache = { at: Date.now(), payload }
    return NextResponse.json(payload)
  } catch {
    if (cache) return NextResponse.json(cache.payload)
    return NextResponse.json({ release: null })
  }
}
