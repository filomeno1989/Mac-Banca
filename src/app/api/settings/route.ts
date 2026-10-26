import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, forbidden, round2, badRequest, isPrivileged } from '@/lib/auth'

async function getOrCreateSetting() {
  let setting = await db.setting.findUnique({ where: { id: 'main' } })
  if (!setting) {
    setting = await db.setting.create({ data: { id: 'main' } })
  }
  return setting
}

/**
 * Definições - leitura para qualquer sessão (o ecrã de login precisa do nome
 * da banca e do aviso de manutenção). O fundo de caixa só o patrão/IT vê.
 */
export async function GET() {
  const user = await getSessionUser()

  const setting = await getOrCreateSetting()
  return NextResponse.json({
    settings: {
      businessName: setting.businessName,
      currency: setting.currency,
      openingCash: user && isPrivileged(user.role) ? setting.openingCash : undefined,
      maintenanceMode: setting.maintenanceMode,
      maintenanceMessage: setting.maintenanceMessage,
    },
  })
}

/** Atualizar definições (patrão). O modo manutenção é exclusivo do utilizador IT. */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const body = (await req.json().catch(() => ({}))) as {
    businessName?: string
    currency?: string
    openingCash?: number
    maintenanceMode?: boolean
    maintenanceMessage?: string
  }

  const data: Record<string, unknown> = {}
  if (body.businessName !== undefined) {
    const name = String(body.businessName).trim()
    if (!name) return badRequest('O nome da banca é obrigatório.')
    data.businessName = name
  }
  if (body.currency !== undefined) {
    const cur = String(body.currency).trim().slice(0, 6)
    if (!cur) return badRequest('A moeda é obrigatória.')
    data.currency = cur
  }
  if (body.openingCash !== undefined) {
    const v = round2(Number(body.openingCash))
    if (Number.isNaN(v) || v < 0) return badRequest('Fundo de caixa inválido.')
    data.openingCash = v
  }
  if (body.maintenanceMode !== undefined || body.maintenanceMessage !== undefined) {
    if (user.role !== 'IT') {
      return NextResponse.json(
        { error: 'O modo manutenção é gerido apenas pelo técnico (IT).' },
        { status: 403 },
      )
    }
    if (body.maintenanceMode !== undefined) data.maintenanceMode = Boolean(body.maintenanceMode)
    if (body.maintenanceMessage !== undefined) {
      data.maintenanceMessage = String(body.maintenanceMessage).trim().slice(0, 300) || null
    }
  }

  await getOrCreateSetting()
  const updated = await db.setting.update({ where: { id: 'main' }, data })
  return NextResponse.json({
    settings: {
      businessName: updated.businessName,
      currency: updated.currency,
      openingCash: updated.openingCash,
      maintenanceMode: updated.maintenanceMode,
      maintenanceMessage: updated.maintenanceMessage,
    },
  })
}
