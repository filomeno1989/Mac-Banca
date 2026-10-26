/**
 * Foto de produto: escolhe um ficheiro, reduz para no máximo 512 px e
 * comprime em JPEG para um dataURL pequeno (algumas dezenas de KB).
 * Assim a foto pode ser guardada na própria base de dados e entrar no backup.
 */

export const MAX_IMAGE_BYTES = 600_000 // rede de segurança no servidor (~600 KB)

export function validateImageDataUrl(v: string): string | null {
  if (typeof v !== 'string' || !v) return null
  if (!v.startsWith('data:image/')) return null
  if (v.length > MAX_IMAGE_BYTES) return null
  return v
}

/** Reduz e comprime a imagem escolhida; devolve dataURL JPEG ou lança erro */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Escolha um ficheiro de imagem (foto).')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('Não foi possível ler a foto.'))
    fr.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Foto inválida.'))
    im.src = dataUrl
  })

  const MAX = 512
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a foto neste aparelho.')
  // fundo branco: evita pixels pretos em fotos PNG com transparência
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)

  return canvas.toDataURL('image/jpeg', 0.78)
}
