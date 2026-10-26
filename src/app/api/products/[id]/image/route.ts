import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, unauthorized } from '@/lib/auth'

/**
 * Foto do produto: serve os bytes da imagem guardada na base de dados.
 *
 * A lista de produtos devolve apenas hasImage (payload leve); a foto é
 * carregada aqui, a preguiça, com ETag para revalidação barata (304).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { id } = await params
  const product = await db.product.findUnique({
    where: { id: Number(id) },
    select: { imageUrl: true },
  })

  const dataUrl = product?.imageUrl
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return new NextResponse('Sem foto', { status: 404 })
  }

  const etag = `W/"${dataUrl.length}"`
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const mime = dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg'
  const bytes = Buffer.from(base64, 'base64')
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, max-age=0, must-revalidate',
      ETag: etag,
    },
  })
}
