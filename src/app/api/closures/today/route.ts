import { NextResponse } from 'next/server'
import { getSessionUser, unauthorized, forbidden } from '@/lib/auth'
import { getDaySummary } from '@/lib/closures'

/** Resumo do dia atual para o ecrã de fecho (patrão) */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  if (user.role !== 'PATRAO') return forbidden()

  const summary = await getDaySummary()
  return NextResponse.json({ summary })
}
