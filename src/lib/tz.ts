// Fuso horário de Moçambique / África Austral (UTC+2, sem horário de verão)
export const TZ = 'Africa/Johannesburg'
export const TZ_OFFSET = '+02:00'

/** Converte um instante para o dia local "YYYY-MM-DD" no fuso da banca */
export function dayString(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Início do dia local (00:00) convertido para instante UTC */
export function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00${TZ_OFFSET}`)
}

/** Fim do dia local (23:59:59.999) convertido para instante UTC */
export function dayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999${TZ_OFFSET}`)
}

/** Soma n dias a um dia "YYYY-MM-DD" e devolve outro "YYYY-MM-DD" */
export function addDays(day: string, n: number): string {
  const d = dayStart(day)
  d.setUTCDate(d.getUTCDate() + n)
  return dayString(d)
}

/** Hoje no fuso da banca */
export function today(): string {
  return dayString(new Date())
}
