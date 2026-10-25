/**
 * Seed do Sistema de Gestão de Banca (Mac Banca)
 *
 * Modos:
 *   bun scripts/seed.ts             → LIMPO (produção): utilizadores + definições, sem dados
 *   bun scripts/seed.ts --produtos  → limpo + catálogo de produtos típicos (stock a zero)
 *   bun scripts/seed.ts --demo      → dados de demonstração (apenas ambiente de testes)
 */
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()

const args = process.argv.slice(2)
const WITH_PRODUTOS = args.includes('--produtos')
const DEMO = args.includes('--demo')

function hashPin(pin: string, salt = crypto.randomBytes(8).toString('hex')): string {
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

const r2 = (n: number) => Math.round(n * 100) / 100

const TZ = 'Africa/Johannesburg'
function dayString(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

async function main() {
  console.log('🧹 A limpar dados antigos...')
  await db.stockMovement.deleteMany()
  await db.saleItem.deleteMany()
  await db.sale.deleteMany()
  await db.closure.deleteMany()
  await db.session.deleteMany()
  await db.product.deleteMany()
  await db.user.deleteMany()
  await db.setting.deleteMany()

  console.log('👤 A criar utilizadores...')
  await db.user.createMany({
    data: [
      { name: 'Patrão', username: 'patrao', pin: hashPin('1234'), role: 'PATRAO' },
      { name: 'Funcionário', username: 'funcionario', pin: hashPin('1111'), role: 'FUNCIONARIO' },
      // Utilizador de manutenção — oculto no ecrã de login (entra por "Acesso técnico")
      { name: 'Admin IT', username: 'admin', pin: hashPin('1989'), role: 'IT' },
    ],
  })
  const patrao = (await db.user.findUnique({ where: { username: 'patrao' } }))!

  console.log('⚙️ A criar definições (Mac Banca)...')
  await db.setting.create({
    data: { businessName: 'Mac Banca', currency: 'MT', openingCash: 0 },
  })

  if (!WITH_PRODUTOS && !DEMO) {
    console.log('✅ Seed LIMPO concluído: 3 utilizadores + definições. Sem produtos nem vendas.')
    console.log('   Patrão:      patrao      · PIN 1234')
    console.log('   Funcionário: funcionario · PIN 1111')
    console.log('   Técnico IT:  admin       · PIN 1989  (oculto — "Acesso técnico" no login)')
    return
  }

  console.log('📦 A criar produtos...')
  const produtosDef: {
    name: string
    category: string
    unit: string
    costPrice: number
    salePrice: number
    stock: number
    minStock: number
  }[] = [
    { name: 'Arroz 1kg', category: 'Alimentos', unit: 'pct', costPrice: 72, salePrice: 85, stock: 30, minStock: 10 },
    { name: 'Açúcar 1kg', category: 'Alimentos', unit: 'pct', costPrice: 68, salePrice: 80, stock: 25, minStock: 10 },
    { name: 'Óleo de cozinha 1L', category: 'Alimentos', unit: 'lt', costPrice: 105, salePrice: 125, stock: 20, minStock: 8 },
    { name: 'Farinha de trigo 1kg', category: 'Alimentos', unit: 'pct', costPrice: 55, salePrice: 68, stock: 18, minStock: 8 },
    { name: 'Farinha de milho 1kg', category: 'Alimentos', unit: 'pct', costPrice: 42, salePrice: 52, stock: 22, minStock: 10 },
    { name: 'Feijão manteiga 1kg', category: 'Alimentos', unit: 'pct', costPrice: 130, salePrice: 155, stock: 12, minStock: 6 },
    { name: 'Esparguete 500g', category: 'Alimentos', unit: 'pct', costPrice: 40, salePrice: 50, stock: 24, minStock: 10 },
    { name: 'Sal 1kg', category: 'Alimentos', unit: 'pct', costPrice: 18, salePrice: 25, stock: 20, minStock: 8 },
    { name: 'Leite em pó sachê', category: 'Alimentos', unit: 'un', costPrice: 45, salePrice: 58, stock: 30, minStock: 12 },
    { name: 'Sabão em barra', category: 'Limpeza', unit: 'un', costPrice: 38, salePrice: 48, stock: 25, minStock: 10 },
    { name: 'Detergente 500ml', category: 'Limpeza', unit: 'un', costPrice: 42, salePrice: 55, stock: 15, minStock: 6 },
    { name: 'Sabonete', category: 'Higiene', unit: 'un', costPrice: 22, salePrice: 30, stock: 35, minStock: 12 },
    { name: 'Pasta de dentes', category: 'Higiene', unit: 'un', costPrice: 48, salePrice: 65, stock: 14, minStock: 6 },
    { name: 'Coca-Cola 350ml', category: 'Bebidas', unit: 'un', costPrice: 18, salePrice: 25, stock: 48, minStock: 24 },
    { name: 'Fanta 350ml', category: 'Bebidas', unit: 'un', costPrice: 18, salePrice: 25, stock: 36, minStock: 24 },
    { name: 'Água 500ml', category: 'Bebidas', unit: 'un', costPrice: 10, salePrice: 15, stock: 60, minStock: 24 },
    { name: 'Pão fresco', category: 'Padaria', unit: 'un', costPrice: 8, salePrice: 10, stock: 40, minStock: 20 },
    { name: 'Velas (caixa)', category: 'Outros', unit: 'cx', costPrice: 20, salePrice: 30, stock: 10, minStock: 5 },
    { name: 'Fósforos', category: 'Outros', unit: 'cx', costPrice: 5, salePrice: 8, stock: 30, minStock: 10 },
  ]

  const products: { id: number; costPrice: number; salePrice: number; stock: number; name: string }[] = []
  for (const p of produtosDef) {
    const stock = DEMO ? p.stock : 0
    const created = await db.product.create({
      data: { ...p, stock },
    })
    if (stock > 0) {
      await db.stockMovement.create({
        data: {
          productId: created.id,
          userId: patrao.id,
          type: 'INICIAL',
          delta: stock,
          stockAfter: stock,
          reason: 'Stock inicial',
          createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
        },
      })
    }
    products.push({ id: created.id, costPrice: p.costPrice, salePrice: p.salePrice, stock, name: p.name })
  }

  if (!DEMO) {
    console.log(`✅ Seed concluído: ${products.length} produtos (stock a zero — registe as entradas reais).`)
    console.log('   Patrão:      patrao      · PIN 1234')
    console.log('   Funcionário: funcionario · PIN 1111')
    console.log('   Técnico IT:  admin       · PIN 1989  (oculto)')
    return
  }

  console.log('💰 A gerar vendas de demonstração (últimos 7 dias)...')
  const payments = ['DINHEIRO', 'DINHEIRO', 'DINHEIRO', 'DINHEIRO', 'DINHEIRO', 'MPESA', 'MPESA', 'MPESA', 'EMOLA', 'CARTAO', 'OUTRO']
  const funcionario = (await db.user.findUnique({ where: { username: 'funcionario' } }))!
  const todayDay = dayString(new Date())
  const currentHour = Number(
    new Date().toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }),
  )

  let saleCount = 0
  for (let d = 7; d >= 0; d--) {
    const base = new Date(Date.now() - d * 24 * 3600 * 1000)
    const day = dayString(base)
    if (day === todayDay && currentHour < 8) continue
    const nSales = 5 + Math.floor(Math.random() * 6)
    for (let s = 0; s < nSales; s++) {
      const maxHour = day === todayDay ? Math.min(19, currentHour) : 19
      const hour = 7 + Math.floor(Math.random() * Math.max(1, maxHour - 7))
      const minute = Math.floor(Math.random() * 60)
      if (day === todayDay && hour > currentHour) continue
      const nItems = 1 + Math.floor(Math.random() * 3)
      const chosen = new Map<number, number>()
      for (let i = 0; i < nItems; i++) {
        const p = products[Math.floor(Math.random() * products.length)]
        const qty = 1 + Math.floor(Math.random() * 3)
        chosen.set(p.id, (chosen.get(p.id) ?? 0) + qty)
      }
      const items = [...chosen.entries()].map(([pid, qty]) => {
        const p = products.find((x) => x.id === pid)!
        return {
          productId: p.id,
          name: p.name,
          price: p.salePrice,
          cost: p.costPrice,
          qty,
          subtotal: r2(p.salePrice * qty),
        }
      })
      const total = r2(items.reduce((a, i) => a + i.subtotal, 0))
      const cost = r2(items.reduce((a, i) => a + i.cost * i.qty, 0))
      const seller = Math.random() < 0.85 ? funcionario : patrao
      const payment = payments[Math.floor(Math.random() * payments.length)]
      const received = payment === 'DINHEIRO' ? Math.ceil(total / 50) * 50 : null
      await db.sale.create({
        data: {
          userId: seller.id,
          total,
          cost,
          profit: r2(total - cost),
          payment,
          received,
          change: received ? r2(received - total) : null,
          status: 'CONCLUIDA',
          createdAt: new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`),
          items: { create: items },
        },
      })
      saleCount++
      for (const it of items) {
        const p = products.find((x) => x.id === it.productId)!
        p.stock = Math.max(0, p.stock - it.qty)
      }
    }
  }

  console.log('📥 A repor stock (entradas simuladas)...')
  for (const p of products) {
    if (p.stock < 10) {
      const add = 15 + Math.floor(Math.random() * 20)
      p.stock += add
      await db.stockMovement.create({
        data: {
          productId: p.id,
          userId: patrao.id,
          type: 'ENTRADA',
          delta: add,
          stockAfter: p.stock,
          reason: 'Compra ao grossista',
          createdAt: new Date(Date.now() - 0.5 * 24 * 3600 * 1000),
        },
      })
    }
  }
  for (const p of products) {
    await db.product.update({ where: { id: p.id }, data: { stock: p.stock } })
  }

  console.log(`✅ Seed DEMO concluído: ${products.length} produtos, ${saleCount} vendas geradas.`)
  console.log('   Patrão: patrao/1234 · Funcionário: funcionario/1111 · IT: admin/1989')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
