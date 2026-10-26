import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  verifyPin,
  createSession,
  setSessionCookie,
  unauthorized,
  badRequest,
} from '@/lib/auth'

/** Lista de utilizadores ativos (para escolher no ecrã de login) - o IT fica oculto */
export async function GET() {
  const users = await db.user.findMany({
    where: { active: true, role: { not: 'IT' } },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: 'desc' }, { name: 'asc' }],
  })
  return NextResponse.json({ users })
}

/** Login com PIN. O técnico (IT) entra pelo acesso oculto com username + PIN. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    userId?: number
    username?: string
    pin?: string
  }
  const pin = String(body.pin ?? '')
  if (!pin) return badRequest('Digite o PIN.')

  let user: { id: number; name: string; username: string; role: string; active: boolean; pin: string } | null = null
  if (body.username) {
    const username = String(body.username).trim().toLowerCase()
    user = await db.user.findUnique({ where: { username } })
  } else {
    const userId = Number(body.userId)
    if (!userId) return badRequest('Escolha o utilizador e digite o PIN.')
    user = await db.user.findUnique({ where: { id: userId } })
  }

  if (!user || !user.active) return unauthorized()

  if (!verifyPin(pin, user.pin)) return badRequest('PIN incorreto. Tente novamente.')

  // Modo manutenção: só o técnico (IT) consegue entrar
  const setting = await db.setting.findUnique({ where: { id: 'main' } })
  if (setting?.maintenanceMode && user.role !== 'IT') {
    return NextResponse.json(
      {
        error:
          setting.maintenanceMessage?.trim() ||
          'Sistema em manutenção. Tente novamente mais tarde.',
      },
      { status: 503 },
    )
  }

  // Higiene: apagar sessões expiradas antes de criar a nova
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })

  const token = await createSession(user.id)
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
  })
  return setSessionCookie(res, token)
}
