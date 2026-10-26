import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, forbidden, badRequest, round2, isPrivileged, maintenanceBlock } from '@/lib/auth'
import { validateImageDataUrl } from '@/lib/image'

/** Editar produto (patrão) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const maintenance = await maintenanceBlock(user.role)
  if (maintenance) return maintenance

  const { id } = await params
  const productId = Number(id)
  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) return badRequest('Produto não encontrado.')

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    category?: string
    unit?: string
    costPrice?: number
    salePrice?: number
    minStock?: number
    active?: boolean
    imageUrl?: string | null
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return badRequest('O nome do produto é obrigatório.')
    data.name = name
  }
  if (body.category !== undefined) data.category = String(body.category).trim() || 'Geral'
  if (body.unit !== undefined) data.unit = String(body.unit).trim() || 'un'
  if (body.costPrice !== undefined) data.costPrice = round2(Number(body.costPrice) || 0)
  if (body.salePrice !== undefined) {
    const salePrice = round2(Number(body.salePrice))
    if (!(salePrice > 0)) return badRequest('O preço de venda deve ser maior que zero.')
    data.salePrice = salePrice
  }
  if (body.minStock !== undefined) data.minStock = Math.max(0, Math.floor(Number(body.minStock) || 0))
  if (body.active !== undefined) data.active = Boolean(body.active)
  if (body.imageUrl !== undefined) {
    const image = validateImageDataUrl(String(body.imageUrl ?? ''))
    if (body.imageUrl !== null && String(body.imageUrl) !== '' && !image) {
      return badRequest('Foto demasiado grande ou inválida. Tente outra foto.')
    }
    data.imageUrl = image // null limpa a foto
  }

  const updated = await db.product.update({ where: { id: productId }, data })
  return NextResponse.json({ product: updated })
}

/** Arquivar / apagar produto (patrão) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const maintenance = await maintenanceBlock(user.role)
  if (maintenance) return maintenance

  const { id } = await params
  const productId = Number(id)
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { _count: { select: { saleItems: true } } },
  })
  if (!product) return badRequest('Produto não encontrado.')

  if (product._count.saleItems > 0) {
    // Tem histórico de vendas: arquivar para manter relatórios coerentes
    await db.product.update({ where: { id: productId }, data: { active: false } })
    return NextResponse.json({ archived: true })
  }
  await db.stockMovement.deleteMany({ where: { productId } })
  await db.product.delete({ where: { id: productId } })
  return NextResponse.json({ archived: false })
}
