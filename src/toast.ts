/**
 * Contrato de toast entre zonas e moldura (N4). A zona chama `emitirToast`; o nome do
 * evento é detalhe interno deste pacote, e nenhuma zona precisa conhecê-lo.
 */
export type TipoDeToast = 'sucesso' | 'erro' | 'info'
export type Toast = { readonly tipo: TipoDeToast; readonly texto: string }

const TIPOS: readonly TipoDeToast[] = ['sucesso', 'erro', 'info']
const EVENTO = 'erp:moldura:toast'
export const TEXTO_MAXIMO = 200

/** Valida tudo o que chega de fora: evento de outro script, cookie editado à mão. */
export function validarToast(x: unknown): Toast | null {
  const t = x as Partial<Toast> | null
  if (!t || typeof t !== 'object') return null
  if (!TIPOS.includes(t.tipo as TipoDeToast)) return null
  if (typeof t.texto !== 'string' || t.texto.length === 0 || t.texto.length > TEXTO_MAXIMO) return null
  return { tipo: t.tipo as TipoDeToast, texto: t.texto }
}

export function emitirToast(toast: Toast, alvo: EventTarget = globalThis): void {
  const t = validarToast(toast)
  if (!t) throw new TypeError('toast invalido')
  alvo.dispatchEvent(new CustomEvent(EVENTO, { detail: t }))
}

export function ouvirToasts(fn: (t: Toast) => void, alvo: EventTarget = globalThis): () => void {
  const ouvinte = (e: Event) => {
    const t = validarToast((e as CustomEvent).detail)
    if (t) fn(t)
  }
  alvo.addEventListener(EVENTO, ouvinte)
  return () => alvo.removeEventListener(EVENTO, ouvinte)
}

/**
 * Flash: toast que atravessa uma navegação entre zonas. A Server Action grava o cookie,
 * o documento seguinte (de qualquer zona) o lê no servidor e o host de toast o apaga
 * ao montar — por isso aparece uma vez só.
 */
export const NOME_COOKIE_FLASH = '__Host-flash'

export const serializarFlash = (t: Toast): string => {
  const v = validarToast(t)
  if (!v) throw new TypeError('toast invalido')
  return encodeURIComponent(JSON.stringify(v))
}

export function lerFlash(valor: string | undefined | null): Toast | null {
  if (!valor) return null
  try { return validarToast(JSON.parse(decodeURIComponent(valor))) } catch { return null }
}

/** `doc` injetável para teste. `Secure` e `Path=/` são exigidos para apagar um `__Host-`. */
export function limparFlash(doc: { cookie: string } | undefined = globalThis.document): void {
  if (!doc) return
  try { doc.cookie = `${NOME_COOKIE_FLASH}=; Max-Age=0; Path=/; Secure; SameSite=Lax` } catch { /* ambiente restrito */ }
}
