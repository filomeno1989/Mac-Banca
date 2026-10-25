import type { Role } from './types'

export function formatMoney(v: number | null | undefined, currency = 'MT'): string {
  const neg = (v ?? 0) < 0
  const abs = Math.abs(Number(v) || 0)
  const [int, dec] = abs.toFixed(2).split('.')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${neg ? '-' : ''}${intFmt},${dec} ${currency}`
}

export function formatDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const dd = date.toLocaleDateString('pt-PT', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: '2-digit', year: 'numeric' })
  const hh = date.toLocaleTimeString('pt-PT', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' })
  return `${dd} ${hh}`
}

export function formatDay(d: string): string {
  // d = "YYYY-MM-DD" → "DD/MM"
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

export function greeting(): string {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg', hour: '2-digit', hour12: false }))
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export const PAYMENTS: { value: string; label: string }[] = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'EMOLA', label: 'e-Mola' },
  { value: 'CARTAO', label: 'Cartão/POS' },
  { value: 'OUTRO', label: 'Outro' },
]

export function paymentLabel(p: string): string {
  return PAYMENTS.find((x) => x.value === p)?.label ?? p
}

export const MOVE_TYPES: { value: string; label: string }[] = [
  { value: 'ENTRADA', label: 'Entrada / Compra' },
  { value: 'VENDA', label: 'Venda' },
  { value: 'PERDA', label: 'Perda / Avaria' },
  { value: 'AJUSTE', label: 'Ajuste de contagem' },
  { value: 'ANULACAO', label: 'Venda anulada' },
  { value: 'INICIAL', label: 'Stock inicial' },
]

export function moveLabel(t: string): string {
  return MOVE_TYPES.find((x) => x.value === t)?.label ?? t
}

export const ROLE_LABELS: Record<Role, string> = {
  PATRAO: 'Patrão',
  FUNCIONARIO: 'Funcionário',
  IT: 'Técnico (IT)',
}
