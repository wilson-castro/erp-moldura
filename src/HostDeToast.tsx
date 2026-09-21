'use client'

import { useEffect, useRef, useState } from 'react'
import { ouvirToasts, type Flash, type Toast } from './toast.js'

type ToastVisivel = Toast & { chave: string }
export const DURACAO_MS = 5000
let proximo = 1

/**
 * Único host de toast do documento. Toda aplicação o monta pela `<Moldura>`.
 *
 * O flash chega por prop, já consumido pelo proxy. Um flash novo (outro `id`) numa
 * renderização seguinte do layout também aparece — o efeito depende do `id`.
 */
export function HostDeToast({ flash }: { flash?: Flash | null }) {
  const [toasts, setToasts] = useState<ToastVisivel[]>(() => (flash ? [{ ...flash, chave: flash.id }] : []))
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const vistos = useRef(new Set<string>(flash ? [flash.id] : []))

  const mostrar = (t: Toast, chave: string) => {
    setToasts((l) => [...l, { ...t, chave }])
    const timer = setTimeout(() => { timers.current.delete(timer); setToasts((l) => l.filter((x) => x.chave !== chave)) }, DURACAO_MS)
    timers.current.add(timer)
  }

  useEffect(() => {
    const parar = ouvirToasts((t) => mostrar(t, `evento-${proximo++}`))
    const pendentes = timers.current
    return () => { parar(); for (const t of pendentes) clearTimeout(t) }
  }, [])

  useEffect(() => {
    if (!flash) return
    if (vistos.current.has(flash.id)) {
      // o do primeiro render já está na lista; só falta o prazo para sair
      const timer = setTimeout(() => setToasts((l) => l.filter((x) => x.chave !== flash.id)), DURACAO_MS)
      timers.current.add(timer)
      return
    }
    vistos.current.add(flash.id)
    mostrar(flash, flash.id)
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
