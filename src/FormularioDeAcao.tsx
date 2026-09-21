'use client'

import type { ReactNode } from 'react'
import { emitirToast, type Toast } from './toast.js'

export type ResultadoDeAcao = { readonly destino: string }

export const FALHA_DE_ACAO: Toast = { tipo: 'erro', texto: 'Não foi possível concluir a operação. Tente de novo em instantes.' }

/** Só caminho interno: `/x`, nunca `//x`, `/\x` ou URL absoluta. O resto vira `/`. */
export const destinoSeguro = (d: unknown): string =>
  typeof d === 'string' && d.startsWith('/') && !d.startsWith('//') && !d.startsWith('/\\') ? d : '/'

/**
 * O que o formulário faz, sem React, para ser testável: roda a action e troca o documento;
 * se a chamada falhar (rede, action que lançou), avisa num toast em vez de calar.
 */
export async function executarAcao(
  acao: (dados: FormData) => Promise<ResultadoDeAcao>,
  dados: FormData,
  navegar: (destino: string) => void = (d) => window.location.assign(d),
  avisar: (t: Toast) => void = emitirToast,
): Promise<void> {
  let resultado: ResultadoDeAcao
  try {
    resultado = await acao(dados)
  } catch {
    avisar(FALHA_DE_ACAO)
    return
  }
  navegar(destinoSeguro(resultado?.destino))
}

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
    <form action={(dados) => executarAcao(acao, dados)}>
      {Object.entries(campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
    </form>
  )
}
