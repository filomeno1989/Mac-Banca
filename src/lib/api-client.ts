export class NetworkError extends Error {
  constructor(msg = 'Sem ligação à internet') {
    super(msg)
    this.name = 'NetworkError'
  }
}

export async function api<T = unknown>(
  path: string,
  opts?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = opts ?? {}
  let res: Response
  try {
    res = await fetch(path, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
  } catch {
    // falha de rede (sem internet, DNS, CORS mortal, etc.)
    throw new NetworkError()
  }
  // gateway/timeout da rede - tratar como offline para permitir fila offline
  if (res.status === 502 || res.status === 504) throw new NetworkError()
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || 'Ocorreu um erro. Tente novamente.'
    throw new Error(msg)
  }
  return data as T
}
