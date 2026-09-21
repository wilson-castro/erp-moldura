'use client'

import type { ReactNode } from 'react'
import { emitirToast } from './toast.js'

export type ResultadoDeAcao = { readonly destino: string }

/**
 * Formulário para Server Action que termina num documento novo. A action devolve o destino
 * e esta ilha troca o documento com `location.assign` — nunca `redirect()` na action:
 * com JavaScript, o Next buscaria o destino no processo da zona atual e, se ele for de outra
 * aplicação (outra zona, ou o login do shell), entregaria o 404 errado (limitação 11).
 *
 * Só campos de texto entram (invariante 2): nada de objeto do domínio vira prop desta ilha.
 */
export function FormularioDeAcao({ acao, campos, children }: {
  acao: (dados: FormData) => Promise<ResultadoDeAcao>
  campos: Readonly<Record<string, string>>
  children: ReactNode
}) {
  return (
    <form action={async (dados) => {
      try {
        const { destino } = await acao(dados)
        // só caminho interno: a action é nossa, mas a ilha não confia no que atravessa a rede
        window.location.assign(destino.startsWith('/') && !destino.startsWith('//') ? destino : '/')
      } catch {
        emitirToast({ tipo: 'erro', texto: 'Não foi possível concluir a operação. Tente de novo em instantes.' })
      }
    }}>
      {Object.entries(campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
    </form>
  )
}
