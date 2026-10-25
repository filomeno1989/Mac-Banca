import { cookies } from 'next/headers'
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'banca_session'
const SESSION_DAYS = 30

export function hashPin(pin: string, salt = crypto.randomBytes(8).toString('hex')): string {
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPin(pin: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const test = crypto.scryptSync(pin, salt, 32).toString('hex')
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'))
  } catch {
    return false
  }
}

export interface AuthUser {
  id: number
  name: string
  username: string
  role: string
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({ where: { token }, include: { user: true } })
  if (!session || session.expiresAt < new Date() || !session.user.active) return null
  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username,
    role: session.user.role,
  }
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000)
  await db.session.create({ data: { token, userId, expiresAt } })
  return token
}

export function setSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 3600,
  })
  return res
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: 'Apenas o patrão pode fazer esta ação.' }, { status: 403 })
}

/** PATRAO e IT têm acesso administrativo; IT é invisível no ecrã de login normal */
export function isPrivileged(role: string): boolean {
  return role === 'PATRAO' || role === 'IT'
}

/**
 * Modo manutenção: se ativo, apenas o utilizador IT pode escrever no sistema.
 * Devolve uma resposta 503 para bloquear, ou null para permitir.
 */
export async function maintenanceBlock(role: string): Promise<NextResponse | null> {
  if (role === 'IT') return null
  const setting = await db.setting.findUnique({ where: { id: 'main' } })
  if (!setting?.maintenanceMode) return null
  return NextResponse.json(
    {
      error:
        setting.maintenanceMessage?.trim() ||
        'Sistema em manutenção. Tente novamente mais tarde.',
    },
    { status: 503 },
  )
}

export function badRequest(msg: string): NextResponse {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}
