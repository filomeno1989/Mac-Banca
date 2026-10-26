import { NextResponse } from 'next/server'
import { getSessionUser, unauthorized, forbidden, isPrivileged } from '@/lib/auth'
import { getDaySummary } from '@/lib/closures'

/** Resumo do dia atual para o ecrã de fecho (patrão e técnico) */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (!isPrivileged(user.role)) return forbidden()

  const summary = await getDaySummary()
  return NextResponse.json({ summary })
}
