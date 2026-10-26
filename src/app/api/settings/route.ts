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
  const logged = Boolean(user)
  return NextResponse.json({
    settings: {
      businessName: setting.businessName,
      currency: setting.currency,
      openingCash: user && isPrivileged(user.role) ? setting.openingCash : undefined,
      // dados da banca usados em recibos e exportações (só com sessão iniciada)
      ownerPhone: logged ? setting.ownerPhone : undefined,
      nuit: logged ? setting.nuit : undefined,
      address: logged ? setting.address : undefined,
      receiptFooter: logged ? setting.receiptFooter : undefined,
      printerWidth: logged ? setting.printerWidth : undefined,
      autoPrintReceipt: logged ? setting.autoPrintReceipt : undefined,
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
    ownerPhone?: string
    nuit?: string
    address?: string
    receiptFooter?: string
    printerWidth?: string
    autoPrintReceipt?: boolean
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
  if (body.ownerPhone !== undefined) {
    const v = String(body.ownerPhone).trim().slice(0, 24)
    data.ownerPhone = v || null
  }
  if (body.nuit !== undefined) {
    const v = String(body.nuit).trim().slice(0, 20)
    data.nuit = v || null
  }
  if (body.address !== undefined) {
    const v = String(body.address).trim().slice(0, 160)
    data.address = v || null
  }
  if (body.receiptFooter !== undefined) {
    const v = String(body.receiptFooter).trim().slice(0, 200)
    data.receiptFooter = v || null
  }
  if (body.printerWidth !== undefined) {
    const v = String(body.printerWidth).trim() === '58' ? '58' : '80'
    data.printerWidth = v
  }
  if (body.autoPrintReceipt !== undefined) data.autoPrintReceipt = Boolean(body.autoPrintReceipt)
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
      ownerPhone: updated.ownerPhone,
      nuit: updated.nuit,
      address: updated.address,
      receiptFooter: updated.receiptFooter,
      printerWidth: updated.printerWidth,
      autoPrintReceipt: updated.autoPrintReceipt,
      maintenanceMode: updated.maintenanceMode,
      maintenanceMessage: updated.maintenanceMessage,
    },
  })
}
