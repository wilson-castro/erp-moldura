'use client'

import { useEffect, useRef, useState } from 'react'
import { limparFlash, ouvirToasts, type Flash, type Toast } from './toast.js'

type ToastVisivel = Toast & { chave: string }
export const DURACAO_MS = 5000
let proximo = 1

/**
 * Único host de toast do documento. Toda zona o monta pela `<Moldura>`.
 *
 * O flash chega por prop a cada renderização do layout — inclusive depois de uma Server
 * Action que redireciona para a própria zona, quando o host continua montado. Por isso o
 * efeito depende do `id` do flash, e não roda só na montagem.
 */
export function HostDeToast({ flash }: { flash?: Flash | null }) {
  const [toasts, setToasts] = useState<ToastVisivel[]>(() => (flash ? [{ ...flash, chave: flash.id }] : []))
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const vistos = useRef(new Set<string>(flash ? [flash.id] : []))

  const agendar = (chave: string) => {
    const t = setTimeout(() => { timers.current.delete(t); setToasts((l) => l.filter((x) => x.chave !== chave)) }, DURACAO_MS)
    timers.current.add(t)
  }

  useEffect(() => {
    const parar = ouvirToasts((t) => {
      const chave = `evento-${proximo++}`
      setToasts((l) => [...l, { ...t, chave }])
      agendar(chave)
    })
    const pendentes = timers.current
    return () => { parar(); for (const t of pendentes) clearTimeout(t) }
  }, [])

  useEffect(() => {
    if (!flash) return
    limparFlash()
    if (toasts.some((t) => t.chave === flash.id)) { agendar(flash.id); return }
    if (vistos.current.has(flash.id)) return
    vistos.current.add(flash.id)
    setToasts((l) => [...l, { ...flash, chave: flash.id }])
    agendar(flash.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash?.id])

  return (
    <div className="moldura-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <p key={t.chave} className={`moldura-toast moldura-toast-${t.tipo}`}>{t.texto}</p>
      ))}
    </div>
  )
}
