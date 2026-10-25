import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { SESSION_COOKIE, clearSessionCookie } from '@/lib/auth'

export async function POST(_req: NextRequest) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { token } })
  }
  return clearSessionCookie(NextResponse.json({ ok: true }))
}
