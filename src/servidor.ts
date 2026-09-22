// @erp/moldura/servidor (ADR-0012): a parte visual do kit de página, no servidor. A decisão de
// acesso é do núcleo (`criarPaginas` de @erp/nucleo/app); aqui só o que o usuário vê — menu,
// toast e destino. A moldura não importa o núcleo: recebe `paginas` pela forma.
import { MENSAGENS, type CodigoErro } from '@erp/contratos'
import { moduloAtivo, type ItemDeMenu } from './Moldura.js'
import { lerFlash, serializarFlash, NOME_COOKIE_FLASH, type Toast } from './toast.js'
import type { ResultadoDeAcao } from './FormularioDeAcao.js'

type MotivoDeNegacao = 'origem' | 'sessao' | 'modulo'

/** A forma de `criarPaginas(...)` do núcleo que a moldura usa. */
export type Paginas = {
  caminhoAtual(): Promise<string>
  sessaoDaPagina(): Promise<{ nome: string }>
  modulosPermitidos(): Promise<readonly ItemDeMenu[]>
  acaoProtegida<R>(modulo: string, corpo: () => Promise<R>, aoNegar: (motivo: MotivoDeNegacao) => Promise<R>): Promise<R>
}

export type ConfigDaMolduraDoServidor = {
  paginas: Paginas
  /** `(await headers()).get(nome)` na app. */
  cabecalho(nome: string): Promise<string | null>
  /** `(await cookies()).set(nome, valor, atributos)` na app. */
  gravarCookie(nome: string, valor: string, atributos: { path: string; secure: boolean; sameSite: 'lax'; maxAge: number }): Promise<void>
}

/** O proxy do núcleo consome o cookie de flash e o entrega por este cabeçalho (uma vez só). */
const CABECALHO_FLASH = 'x-erp-flash'

/** Erro da aplicação (tem um código público) e não um redirect do Next ou um bug. */
const codigoDe = (e: unknown): CodigoErro | null => {
  const c = (e as { codigo?: unknown } | null)?.codigo
  return typeof c === 'string' && c in MENSAGENS ? (c as CodigoErro) : null
}

export function criarMolduraDoServidor(cfg: ConfigDaMolduraDoServidor) {
  const { paginas } = cfg

  /**
   * Sem a gestão de acesso ninguém entra em módulo: o layout mostra a moldura com "Serviço
   * indisponível" no HTML do servidor, em vez de lançar (o `global-error` do Next só aparece
   * depois da hidratação; sem JavaScript a página ficaria em branco).
   */
  async function dadosDaMoldura() {
    const sessao = await paginas.sessaoDaPagina()
    const menu = await paginas.modulosPermitidos().catch((e: unknown) => {
      if (codigoDe(e)) return null
      throw e   // redirect para o login e erro de programação seguem adiante
    })
    const flash = lerFlash(await cfg.cabecalho(CABECALHO_FLASH))
    const ativo = menu ? moduloAtivo(menu, await paginas.caminhoAtual()) : undefined
    return { usuario: { nome: sessao.nome }, menu: menu ?? [], flash, indisponivel: menu === null, ...(ativo ? { ativo } : {}) }
  }

  /** Toast que sobrevive à troca de documento, inclusive para outra zona. */
  async function flash(t: Toast): Promise<void> {
    await cfg.gravarCookie(NOME_COOKIE_FLASH, serializarFlash(t), { path: '/', secure: true, sameSite: 'lax', maxAge: 60 })
  }

  /**
   * Envelope de Server Action com toast. A decisão (origem, sessão, módulo) é do núcleo; aqui,
   * o destino de cada negação e o toast. Nunca lança para o cliente e nunca usa `redirect()`:
   * com JavaScript, o Next buscaria o destino no processo desta zona (limitação 11).
   */
  function acaoProtegida(
    modulo: string,
    voltar: string,
    corpo: () => Promise<{ toast: Toast; destino: string }>,
  ): Promise<ResultadoDeAcao> {
    return paginas.acaoProtegida<ResultadoDeAcao>(modulo,
      async () => {
        try {
          const { toast, destino } = await corpo()
          await flash(toast)
          return { destino }
        } catch (e) {
          // invariante 12: só a mensagem pública do código; erro sem código vira ERRO_INTERNO
          await flash({ tipo: 'erro', texto: MENSAGENS[codigoDe(e) ?? 'ERRO_INTERNO'] })
          return { destino: voltar }
        }
      },
      async (motivo) => {
        if (motivo === 'origem') return { destino: '/' }
        if (motivo === 'sessao') return { destino: `/login?de=${encodeURIComponent(voltar)}` }
        await flash({ tipo: 'erro', texto: MENSAGENS.OPERACAO_NAO_PERMITIDA })
        return { destino: '/' }
      })
  }

  return { dadosDaMoldura, flash, acaoProtegida }
}
