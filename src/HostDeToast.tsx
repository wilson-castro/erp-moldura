'use client'

import { useEffect, useState } from 'react'
import { limparFlash, ouvirToasts, type Toast } from './toast.js'

type ToastVisivel = Toast & { id: number }
export const DURACAO_MS = 5000
let proximo = 1

/** Único host de toast do documento. Toda zona o monta pela `<Moldura>`. */
export function HostDeToast({ flash }: { flash?: Toast | null }) {
  const [toasts, setToasts] = useState<ToastVisivel[]>(() => (flash ? [{ ...flash, id: 0 }] : []))

  useEffect(() => {
    if (flash) limparFlash()
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const agendar = (id: number) => {
      const t = setTimeout(() => { timers.delete(t); setToasts((l) => l.filter((x) => x.id !== id)) }, DURACAO_MS)
      timers.add(t)
    }
    if (flash) agendar(0)
    const parar = ouvirToasts((t) => {
      const id = proximo++
      setToasts((l) => [...l, { ...t, id }])
      agendar(id)
    })
    return () => { parar(); for (const t of timers) clearTimeout(t) }
    // o flash só vale no primeiro render do documento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="moldura-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <p key={t.id} className={`moldura-toast moldura-toast-${t.tipo}`}>{t.texto}</p>
      ))}
    </div>
  )
}
