/**
 * Categorias de produtos.
 *
 * Existem categorias padrão de banca para evitar erros de escrita
 * (ex.: "Alimento" em vez de "Alimentação"). Quando o utilizador escreve
 * uma categoria nova, ela é normalizada e, ao guardar, passa a fazer
 * parte da lista (o sistema "aprende").
 */

export const BASE_CATEGORIES = [
  'Alimentos',
  'Bebidas',
  'Padaria',
  'Higiene',
  'Limpeza',
  'Outros',
]

/** Normaliza: trim, espaços únicos e primeira letra maiúscula */
export function normalizeCategory(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ')
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Junta as categorias padrão com as que já existem na banca (sem duplicados) */
export function mergeCategories(fromDb: string[]): string[] {
  const set = new Set<string>(BASE_CATEGORIES)
  for (const c of fromDb ?? []) {
    const n = normalizeCategory(c)
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt'))
}
