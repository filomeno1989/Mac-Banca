/**
 * Recibos da banca: texto para WhatsApp/partilha, impressão em papel
 * pequeno (80 mm) e PDF do recibo.
 *
 * Todos levam os dados da banca configurados nas Definições (nome, NUIT,
 * contacto, endereço e mensagem de rodapé).
 */

import type { Sale, Settings, SaleItem } from './types'
import { formatMoney, formatDateTime, paymentLabel } from './format'
import { openExternal } from './version'

export interface ReceiptBank {
  businessName: string
  ownerPhone?: string | null
  nuit?: string | null
  address?: string | null
  receiptFooter?: string | null
  currency: string
}

/** Dados da banca a partir das Definições */
export function receiptBank(settings?: Settings | null, currency = 'MT'): ReceiptBank {
  return {
    businessName: settings?.businessName || 'Mac Banca',
    ownerPhone: settings?.ownerPhone ?? null,
    nuit: settings?.nuit ?? null,
    address: settings?.address ?? null,
    receiptFooter: settings?.receiptFooter ?? null,
    currency: settings?.currency || currency,
  }
}

/** Aceita a venda do servidor e também a venda offline em fila */
export type ReceiptSale = Pick<
  Sale,
  'id' | 'total' | 'payment' | 'received' | 'change' | 'createdAt' | 'user' | 'items'
> & { offlineRef?: string }

/** Número internacional para wa.me: aceita 84..., +258..., 00258... etc. */
export function waNumber(phone: string): string {
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00258')) d = d.slice(2)
  if (d.length === 9 && (d.startsWith('8') || d.startsWith('7'))) d = `258${d}`
  return d
}

const DIV = '--------------------------------'

/** Recibo em texto (WhatsApp, SMS, partilha nativa) */
export function buildReceiptText(sale: ReceiptSale, bank: ReceiptBank): string {
  const items: SaleItem[] = sale.items ?? []
  const ref = sale.offlineRef
    ? `Venda offline (ref ${sale.offlineRef})`
    : sale.id
      ? `Venda #${sale.id}`
      : 'Venda'
  const lines: string[] = []

  lines.push(`*${bank.businessName}*`)
  const meta = [
    bank.nuit ? `NUIT: ${bank.nuit}` : null,
    bank.ownerPhone ? `Tel: ${bank.ownerPhone}` : null,
    bank.address,
  ].filter(Boolean) as string[]
  lines.push(...meta)
  if (meta.length) lines.push(DIV)

  lines.push(`${ref} : ${formatDateTime(sale.createdAt)}`)
  lines.push('')
  for (const it of items) {
    lines.push(`${it.qty}x ${it.name} : ${formatMoney(it.subtotal, bank.currency)}`)
  }
  lines.push(DIV)
  lines.push(`TOTAL: ${formatMoney(sale.total, bank.currency)}`)
  lines.push(`Pagamento: ${paymentLabel(sale.payment)}`)
  if (sale.payment === 'DINHEIRO' && sale.received != null) {
    lines.push(`Recebido: ${formatMoney(sale.received, bank.currency)}`)
    if ((sale.change ?? 0) > 0) lines.push(`Troco: ${formatMoney(sale.change ?? 0, bank.currency)}`)
  }
  if (sale.user?.name) lines.push(`Atendeu: ${sale.user.name}`)
  if (bank.receiptFooter) {
    lines.push(DIV)
    lines.push(bank.receiptFooter)
  }
  return lines.join('\n')
}

/**
 * Partilha o recibo: se houver número configurado (WhatsApp do patrão),
 * abre o WhatsApp direto para esse número; senão usa a partilha nativa
 * (escolher contactos) e, em última instância, o WhatsApp sem destino.
 */
export async function shareReceipt(
  sale: ReceiptSale,
  bank: ReceiptBank,
  directPhone?: string | null,
): Promise<'shared' | 'wa' | 'cancel'> {
  const text = buildReceiptText(sale, bank)

  if (!directPhone && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancel'
      // partilha nativa falhou: seguir para o WhatsApp
    }
  }

  const base = directPhone
    ? `https://wa.me/${waNumber(directPhone)}?text=`
    : 'https://wa.me/?text='
  openExternal(base + encodeURIComponent(text))
  return 'wa'
}

/** Corpo HTML do recibo (usado na impressão em papel de 80 mm) */
function receiptHtml(sale: ReceiptSale, bank: ReceiptBank): string {
  const items = sale.items ?? []
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const ref = sale.offlineRef
    ? `Venda offline (ref ${sale.offlineRef})`
    : sale.id
      ? `Venda #${sale.id}`
      : 'Venda'
  const row = (left: string, right: string, cls = '') =>
    `<div class="row ${cls}"><span>${esc(left)}</span><span>${esc(right)}</span></div>`
  const div = '<hr />'

  const meta = [
    bank.nuit ? `NUIT: ${esc(bank.nuit)}` : null,
    bank.ownerPhone ? `Tel: ${esc(bank.ownerPhone)}` : null,
    bank.address ? esc(bank.address) : null,
  ].filter(Boolean) as string[]

  return `
    <h1>${esc(bank.businessName)}</h1>
    ${meta.map((m) => `<div class="c small">${m}</div>`).join('')}
    ${meta.length ? div : ''}
    <div class="small">${esc(ref)} : ${formatDateTime(sale.createdAt)}</div>
    ${div}
    ${items.map((it) => row(`${it.qty}x ${it.name}`, formatMoney(it.subtotal, bank.currency))).join('')}
    ${div}
    ${row('TOTAL', formatMoney(sale.total, bank.currency), 'total')}
    ${row('Pagamento', paymentLabel(sale.payment))}
    ${sale.payment === 'DINHEIRO' && sale.received != null ? row('Recebido', formatMoney(sale.received, bank.currency)) : ''}
    ${(sale.change ?? 0) > 0 ? row('Troco', formatMoney(sale.change ?? 0, bank.currency)) : ''}
    ${sale.user?.name ? row('Atendeu', esc(sale.user.name)) : ''}
    ${bank.receiptFooter ? `${div}<div class="c small">${esc(bank.receiptFooter)}</div>` : ''}
  `
}

/** Imprimir recibo em papel pequeno (bobina de 80 mm) */
export function printReceipt(sale: ReceiptSale, bank: ReceiptBank): void {
  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Recibo</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      html, body { margin: 0; padding: 0; }
      body { font-family: 'Courier New', ui-monospace, monospace; font-size: 11px; color: #000; }
      h1 { font-size: 15px; margin: 0 0 2px; text-align: center; }
      .c { text-align: center; }
      .small { font-size: 10px; }
      .row { display: flex; justify-content: space-between; gap: 6px; }
      .row span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .total { font-weight: bold; font-size: 13px; }
      hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    </style></head><body>${receiptHtml(sale, bank)}</body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.srcdoc = html
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  if (win) {
    setTimeout(() => {
      try {
        win.focus()
        win.print()
      } catch {
        /* aparelho sem impressão disponível */
      }
    }, 250)
  }
  // limpar depois de dar tempo à impressão
  setTimeout(() => iframe.remove(), 60_000)
}

/** PDF do recibo em bobina de 80 mm (para guardar ou enviar) */
export async function downloadReceiptPdf(sale: ReceiptSale, bank: ReceiptBank): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const items = sale.items ?? []

  // altura dinâmica: cabeçalho + itens + totais + rodapé
  const metaCount = [bank.nuit, bank.ownerPhone, bank.address].filter(Boolean).length
  const height =
    10 + metaCount * 4 + (metaCount ? 3 : 0) + 10 + items.length * 5 + 26 + (bank.receiptFooter ? 10 : 0) + 6
  const doc = new jsPDF({ unit: 'mm', format: [80, Math.max(60, height)] })

  const W = 80
  const L = 5
  const R = W - 5
  let y = 9

  const dashed = () => {
    doc.setLineDashPattern([0.5, 0.7], 0)
    doc.setDrawColor(60)
    doc.line(L, y, R, y)
    doc.setLineDashPattern([], 0)
    y += 3
  }
  const center = (t: string, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.text(t, W / 2, y, { align: 'center' })
    y += size * 0.42
  }
  const money = (v: number) => formatMoney(v, bank.currency)

  const ref = sale.offlineRef
    ? `Venda offline (ref ${sale.offlineRef})`
    : sale.id
      ? `Venda #${sale.id}`
      : 'Venda'

  // Cabeçalho: banca
  center(bank.businessName, 13, true)
  doc.setFont('helvetica', 'normal')
  if (bank.nuit) center(`NUIT: ${bank.nuit}`, 7.5)
  if (bank.ownerPhone) center(`Tel: ${bank.ownerPhone}`, 7.5)
  if (bank.address) center(bank.address, 7.5)
  if (bank.nuit || bank.ownerPhone || bank.address) dashed()

  center(`${ref} : ${formatDateTime(sale.createdAt)}`, 8)
  y += 1.5

  // Itens
  doc.setFontSize(8.5)
  for (const it of items) {
    doc.setFont('helvetica', 'normal')
    doc.text(`${it.qty}x ${it.name}`.slice(0, 40), L, y)
    doc.text(money(it.subtotal), R, y, { align: 'right' })
    y += 5
  }
  y += 1
  dashed()

  // Totais
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL', L, y)
  doc.text(money(sale.total), R, y, { align: 'right' })
  y += 5.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Pagamento: ${paymentLabel(sale.payment)}`, L, y)
  y += 4.5
  if (sale.payment === 'DINHEIRO' && sale.received != null) {
    doc.text(`Recebido: ${money(sale.received)}`, L, y)
    y += 4.5
    if ((sale.change ?? 0) > 0) {
      doc.text(`Troco: ${money(sale.change ?? 0)}`, L, y)
      y += 4.5
    }
  }
  if (sale.user?.name) {
    doc.text(`Atendeu: ${sale.user.name}`, L, y)
    y += 4.5
  }

  if (bank.receiptFooter) {
    y += 1
    dashed()
    center(bank.receiptFooter, 8)
  }

  const name = sale.offlineRef ? `recibo-${sale.offlineRef}.pdf` : `recibo-venda-${sale.id}.pdf`
  doc.save(name)
}
