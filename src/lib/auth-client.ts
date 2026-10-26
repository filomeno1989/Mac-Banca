/**
 * Versão client dos helpers de papel - isola a lógica de permissões
 * sem importar o módulo server-side (auth.ts usa next/headers).
 */
export function isPrivileged(role: string): boolean {
  return role === 'PATRAO' || role === 'IT'
}
