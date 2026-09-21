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

/** Flash carrega um id: dois flashes de mesmo texto seguidos são dois avisos, não um. */
export type Flash = Toast & { readonly id: string }

/**
 * Flash: toast que atravessa uma navegação entre zonas. A Server Action grava o cookie; o
 * proxy do documento seguinte (de qualquer zona) o consome — entrega ao layout e apaga o
 * cookie na mesma resposta — por isso aparece uma vez só, com ou sem JavaScript.
 */
export const NOME_COOKIE_FLASH = '__Host-flash'

const ID_FLASH = /^[A-Za-z0-9-]{1,64}$/

export const serializarFlash = (t: Toast): string => {
  const v = validarToast(t)
  if (!v) throw new TypeError('toast invalido')
  return encodeURIComponent(JSON.stringify({ ...v, id: crypto.randomUUID() }))
}

export function lerFlash(valor: string | undefined | null): Flash | null {
  if (!valor) return null
  try {
    const bruto = JSON.parse(decodeURIComponent(valor)) as { id?: unknown }
    const t = validarToast(bruto)
    return t && typeof bruto.id === 'string' && ID_FLASH.test(bruto.id) ? { ...t, id: bruto.id } : null
  } catch { return null }
}
