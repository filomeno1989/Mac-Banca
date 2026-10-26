export type Role = 'PATRAO' | 'FUNCIONARIO' | 'IT'

export interface User {
  id: number
  name: string
  username: string
  role: Role
}

export interface Product {
  id: number
  name: string
  category: string
  unit: string
  salePrice: number
  costPrice?: number
  stock: number
  minStock: number
  active: boolean
  hasImage?: boolean
  imageUrl?: string | null // só usado no formulário (envio dataURL)
}

export interface SaleItem {
  id: number
  productId: number
  name: string
  price: number
  qty: number
  subtotal: number
  cost?: number
}

export interface Sale {
  id: number
  total: number
  cost?: number
  profit?: number
  payment: string
  received?: number | null
  change?: number | null
  status: string
  createdAt: string
  user: { id: number; name: string }
  items?: SaleItem[]
  itemCount?: number
}

export interface StockMovement {
  id: number
  type: string
  delta: number
  stockAfter: number
  reason?: string | null
  createdAt: string
  product: { id: number; name: string }
  user: { id: number; name: string }
}

export interface Closure {
  id: number
  day: string
  expectedCash: number
  countedCash: number
  difference: number
  totalSales: number
  totalProfit: number
  numSales: number
  byPayment: string
  notes?: string | null
  createdAt: string
  user: { id: number; name: string }
}

export interface Settings {
  businessName: string
  currency: string
  openingCash: number
  ownerPhone?: string | null
  nuit?: string | null
  address?: string | null
  receiptFooter?: string | null
  printerWidth?: string | null
  autoPrintReceipt?: boolean
  maintenanceMode?: boolean
  maintenanceMessage?: string | null
}

export interface DayPoint {
  day: string
  label: string
  total: number
  profit: number
  num: number
}

export interface TopProduct {
  name: string
  qty: number
  revenue: number
  profit: number
}

export interface CategoryStat {
  category: string
  qty: number
  revenue: number
  profit: number
}

export interface DashboardData {
  role: Role
  today: { numSales: number; totalSales: number; totalProfit: number; totalMine: number }
  yesterday: { numSales: number; totalSales: number; totalProfit: number } | null
  last7: DayPoint[]
  lowStock: { id: number; name: string; stock: number; minStock: number }[]
  recentSales: Sale[]
  byPaymentToday: { payment: string; total: number; num: number }[]
  stockValue: number | null
  activeProducts: number
}

export interface ReportData {
  from: string
  to: string
  totals: { numSales: number; totalSales: number; totalCost: number; totalProfit: number; margin: number; avgTicket: number }
  byDay: DayPoint[]
  byPayment: { payment: string; total: number; num: number }[]
  byCategory: CategoryStat[]
  topProducts: TopProduct[]
  numAnnulled: number
  totalAnnulled: number
}
