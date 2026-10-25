import { NextResponse } from 'next/server'
import { getSessionUser, unauthorized } from '@/lib/auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return unauthorized()
  return NextResponse.json({ user })
}
