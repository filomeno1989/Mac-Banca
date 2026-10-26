import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, forbidden, badRequest, hashPin, isPrivileged, maintenanceBlock } from '@/lib/auth'

/** Lista de utilizadores (patrão) - o utilizador IT só aparece para o próprio IT */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const users = await db.user.findMany({
    where: user.role === 'IT' ? {} : { role: { not: 'IT' } },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      active: true,
      createdAt: true,
      _count: { select: { sales: true } },
    },
    orderBy: [{ role: 'desc' }, { name: 'asc' }],
  })
  return NextResponse.json({ users })
}

/** Criar utilizador (patrão) */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const maintenance = await maintenanceBlock(user.role)
  if (maintenance) return maintenance

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    username?: string
    pin?: string
    role?: string
  }

  const name = String(body.name ?? '').trim()
  const username = String(body.username ?? '').trim().toLowerCase()
  const pin = String(body.pin ?? '').trim()
  const role = body.role === 'PATRAO' ? 'PATRAO' : 'FUNCIONARIO'

  if (!name) return badRequest('O nome é obrigatório.')
  if (!username || !/^[a-z0-9._-]{3,20}$/.test(username))
    return badRequest('Utilizador inválido (3-20 letras/números, sem espaços).')
  if (!/^\d{4,6}$/.test(pin)) return badRequest('O PIN deve ter 4 a 6 dígitos.')

  const exists = await db.user.findUnique({ where: { username } })
  if (exists) return badRequest('Esse nome de utilizador já existe.')

  const created = await db.user.create({
    data: { name, username, pin: hashPin(pin), role },
  })
  return NextResponse.json(
    { user: { id: created.id, name: created.name, username: created.username, role: created.role } },
    { status: 201 },
  )
}
