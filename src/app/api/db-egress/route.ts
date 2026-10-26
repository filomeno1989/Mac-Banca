import { NextResponse } from 'next/server'
import net from 'net'
import dns from 'dns'

/** Diagnóstico temporário de egress da Vercel para o Supabase (remover depois) */
export async function GET() {
  const host = 'db.kfhrlquvwpvzaffeghls.supabase.co'
  const port = 5432
  const result: Record<string, unknown> = { host, port, region: process.env.VERCEL_REGION }

  result.dns = await new Promise((res) =>
    dns.lookup(host, { all: true }, (err, addrs) => res(err ? `erro:${err.message}` : addrs)),
  )

  const tcp = (family: 4 | 6) =>
    new Promise((res) => {
      const s = net.connect({ host, port, family, timeout: 6000 })
      s.on('connect', () => {
        s.destroy()
        res('OK')
      })
      s.on('timeout', () => {
        s.destroy()
        res('timeout')
      })
      s.on('error', (e) => res(`erro:${e.message}`))
    })

  result.tcp6 = await tcp(6)
  result.tcp4 = await tcp(4)

  try {
    const { db } = await import('@/lib/db')
    const n = await db.setting.count()
    const s = await db.setting.findFirst()
    result.prisma = `OK settings=${n} nome=${s?.businessName ?? '-'}`
  } catch (e) {
    result.prisma = `erro: ${String(e).slice(0, 400)}`
  }

  return NextResponse.json(result)
}
