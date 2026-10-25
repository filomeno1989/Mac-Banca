import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized, forbidden, badRequest, round2, isPrivileged, maintenanceBlock } from '@/lib/auth'

/** Lista de produtos (funcionário não vê preço de custo) */
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const all = url.searchParams.get('all') === '1' && isPrivileged(user.role)
  const category = url.searchParams.get('category')?.trim() ?? ''

  const products = await db.product.findMany({
    where: {
      ...(all ? {} : { active: true }),
      ...(q ? { name: { contains: q } } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })

  const isPatrao = isPrivileged(user.role)
  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      salePrice: p.salePrice,
      ...(isPatrao ? { costPrice: p.costPrice } : {}),
      stock: p.stock,
      minStock: p.minStock,
      active: p.active,
    })),
    categories: [...new Set(products.map((p) => p.category))],
  })
}

/** Criar produto (patrão) */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const maintenance = await maintenanceBlock(user.role)
  if (maintenance) return maintenance

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    category?: string
    unit?: string
    costPrice?: number
    salePrice?: number
    stock?: number
    minStock?: number
  }

  const name = String(body.name ?? '').trim()
  const salePrice = round2(Number(body.salePrice))
  const costPrice = round2(Number(body.costPrice) || 0)
  const stock = Math.max(0, Math.floor(Number(body.stock) || 0))
  const minStock = Math.max(0, Math.floor(Number(body.minStock) || 0))

  if (!name) return badRequest('O nome do produto é obrigatório.')
  if (!(salePrice > 0)) return badRequest('O preço de venda deve ser maior que zero.')
  if (costPrice < 0) return badRequest('Preço de custo inválido.')

  const product = await db.product.create({
    data: {
      name,
      category: String(body.category ?? '').trim() || 'Geral',
      unit: String(body.unit ?? 'un').trim() || 'un',
      costPrice,
      salePrice,
      stock,
      minStock,
    },
  })

  if (stock > 0) {
    await db.stockMovement.create({
      data: {
        productId: product.id,
        userId: user.id,
        type: 'INICIAL',
        delta: stock,
        stockAfter: stock,
        reason: 'Stock inicial',
      },
    })
  }

  return NextResponse.json({ product }, { status: 201 })
}
