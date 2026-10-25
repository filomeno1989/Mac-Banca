import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, forbidden, badRequest, hashPin } from '@/lib/auth'

/** Editar utilizador (patrão): ativar/desativar, renomear, mudar PIN */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'PATRAO') return forbidden()

  const { id } = await params
  const targetId = Number(id)
  const target = await db.user.findUnique({ where: { id: targetId } })
  if (!target) return badRequest('Utilizador não encontrado.')

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    pin?: string
    active?: boolean
    role?: string
  }

  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return badRequest('O nome é obrigatório.')
    data.name = name
  }

  if (body.pin !== undefined) {
    const pin = String(body.pin).trim()
    if (!/^\d{4,6}$/.test(pin)) return badRequest('O PIN deve ter 4 a 6 dígitos.')
    data.pin = hashPin(pin)
  }

  if (body.active !== undefined) {
    const active = Boolean(body.active)
    if (!active) {
      if (target.id === user.id) return badRequest('Não pode desativar a sua própria conta.')
      if (target.role === 'PATRAO') {
        const otherPatroes = await db.user.count({
          where: { role: 'PATRAO', active: true, id: { not: target.id } },
        })
        if (otherPatroes === 0) return badRequest('Deve existir pelo menos um patrão ativo.')
      }
      await db.session.deleteMany({ where: { userId: target.id } })
    }
    data.active = active
  }

  const updated = await db.user.update({ where: { id: targetId }, data })
  return NextResponse.json({
    user: {
      id: updated.id,
      name: updated.name,
      username: updated.username,
      role: updated.role,
      active: updated.active,
    },
  })
}
