import { NextResponse } from 'next/server'

/**
 * Informa a versão mais recente do APK (GitHub Releases).
 * Feito server-side com cache de 5 minutos para não depender da quota/CORS
 * do GitHub no browser do utilizador.
 */
export async function GET() {
  try {
    const r = await fetch('https://api.github.com/repos/filomeno1989/Mac-Banca/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 300 },
    })
    if (!r.ok) return NextResponse.json({ release: null })
    const d = (await r.json()) as {
      tag_name?: string
      html_url?: string
      body?: string
      assets?: { name?: string; browser_download_url?: string }[]
    }
    if (!d.tag_name) return NextResponse.json({ release: null })
    const apk = (d.assets ?? []).find((a) => a.name?.endsWith('.apk'))
    return NextResponse.json({
      release: {
        tag: d.tag_name,
        version: d.tag_name.replace(/^v/, ''),
        downloadUrl: apk?.browser_download_url ?? d.html_url ?? '',
        notes: d.body ?? '',
      },
    })
  } catch {
    return NextResponse.json({ release: null })
  }
}
