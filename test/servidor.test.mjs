// @erp/moldura/servidor e os componentes comuns (ADR-0012): a parte visual do que as apps
// copiavam em lib/pagina.ts, indisponivel.tsx e global-error.tsx. A decisão de acesso é do
// núcleo (`paginas.acaoProtegida`); aqui só o que o usuário vê.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import { MENSAGENS } from '@erp/contratos'
import { criarMolduraDoServidor } from '../dist/servidor.js'
import { ServicoIndisponivel, ErroGlobal, NOME_COOKIE_FLASH, lerFlash } from '../dist/index.js'

class ErroDeApp extends Error { constructor(codigo) { super(codigo); this.codigo = codigo } }

/** `paginas` falso com a mesma forma de `criarPaginas` do núcleo (tipagem estrutural). */
function paginas({ modulos = [{ id: 'zona1', rotulo: 'Painel', prefixo: '/zona1' }], acessoFora = false, nega = null, requisitos = [] } = {}) {
  return {
    caminhoAtual: async () => '/zona1',
    sessaoDaPagina: async () => ({ sub: 'ana', nome: 'Ana Operadora' }),
    modulosPermitidos: async () => { if (acessoFora) throw new ErroDeApp('ERRO_INTERNO'); return modulos },
    acaoProtegida: async (requisito, corpo, aoNegar) => { requisitos.push(requisito); return nega ? aoNegar(nega) : corpo() },
  }
}

function montar(opcoes, cabecalhos = {}) {
  const cookies = []
  const m = criarMolduraDoServidor({
    paginas: paginas(opcoes),
    cabecalho: async (n) => cabecalhos[n] ?? null,
    gravarCookie: async (nome, valor, atributos) => { cookies.push({ nome, valor, atributos }) },
  })
  return { ...m, cookies }
}

test('dadosDaMoldura: usuario, menu, modulo ativo e flash do cabecalho interno', async () => {
  const flash = encodeURIComponent(JSON.stringify({ tipo: 'sucesso', texto: 'Feito', id: 'f1' }))
  const d = await montar({}, { 'x-erp-flash': flash }).dadosDaMoldura()
  assert.deepEqual(d.usuario, { nome: 'Ana Operadora' })
  assert.equal(d.menu.length, 1)
  assert.equal(d.ativo, 'zona1')
  assert.equal(d.indisponivel, false)
  assert.equal(d.flash?.texto, 'Feito')
})

test('dadosDaMoldura: gestao de acesso fora vira moldura sem menu e "indisponivel", sem lancar', async () => {
  const d = await montar({ acessoFora: true }).dadosDaMoldura()
  assert.equal(d.indisponivel, true)
  assert.deepEqual(d.menu, [])
})

test('dadosDaMoldura: erro que nao e da aplicacao (redirect do Next, bug) segue adiante', async () => {
  const m = criarMolduraDoServidor({
    paginas: { ...paginas(), modulosPermitidos: async () => { throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;/login' }) } },
    cabecalho: async () => null, gravarCookie: async () => {},
  })
  await assert.rejects(m.dadosDaMoldura(), /NEXT_REDIRECT/)
})

test('flash: cookie __Host- com Secure, Lax, caminho / e 60 s, que lerFlash le de volta', async () => {
  const m = montar({})
  await m.flash({ tipo: 'sucesso', texto: 'Ok' })
  const [c] = m.cookies
  assert.equal(c.nome, NOME_COOKIE_FLASH)
  assert.deepEqual(c.atributos, { path: '/', secure: true, sameSite: 'lax', maxAge: 60 })
  assert.equal(lerFlash(c.valor)?.texto, 'Ok')
})

const PAINEL = { modulo: 'zona1', funcionalidade: 'painel.ver' }

test('acaoProtegida: sucesso grava o toast e devolve o destino do corpo', async () => {
  const m = montar({})
  const r = await m.acaoProtegida(PAINEL, '/zona1', async () => ({ toast: { tipo: 'sucesso', texto: 'Tarefa concluída.' }, destino: '/zona1' }))
  assert.deepEqual(r, { destino: '/zona1' })
  assert.equal(lerFlash(m.cookies[0].valor)?.texto, 'Tarefa concluída.')
})

test('acaoProtegida: cada negacao do nucleo vira o destino certo, sem rodar o corpo', async () => {
  const corpo = async () => { throw new Error('o corpo nao podia rodar') }
  const origem = montar({ nega: 'origem' })
  assert.deepEqual(await origem.acaoProtegida(PAINEL, '/zona2', corpo), { destino: '/' })
  assert.equal(origem.cookies.length, 0, 'origem recusada nao deve gravar nada')
  assert.deepEqual(await montar({ nega: 'sessao' }).acaoProtegida(PAINEL, '/zona2', corpo), { destino: '/login?de=%2Fzona2' })
  const modulo = montar({ nega: 'modulo' })
  assert.deepEqual(await modulo.acaoProtegida(PAINEL, '/zona2', corpo), { destino: '/' })
  assert.equal(lerFlash(modulo.cookies[0].valor)?.texto, MENSAGENS.OPERACAO_NAO_PERMITIDA)
})

test('acaoProtegida: erro do corpo vira toast com a mensagem publica do codigo e volta', async () => {
  const conhecido = montar({})
  assert.deepEqual(await conhecido.acaoProtegida(PAINEL, '/zona2', async () => { throw new ErroDeApp('REGISTRO_DESATUALIZADO') }), { destino: '/zona2' })
  assert.equal(lerFlash(conhecido.cookies[0].valor)?.texto, MENSAGENS.REGISTRO_DESATUALIZADO)
  const bug = montar({})
  await bug.acaoProtegida(PAINEL, '/zona2', async () => { throw new TypeError('stacktrace secreto') })
  assert.equal(lerFlash(bug.cookies[0].valor)?.texto, MENSAGENS.ERRO_INTERNO, 'erro interno vazou detalhe')
})

test('ServicoIndisponivel: titulo e a mensagem publica, nada mais', () => {
  const html = renderToString(h(ServicoIndisponivel))
  assert.match(html, /<h1>Serviço indisponível<\/h1>/)
  assert.ok(html.includes(MENSAGENS.ERRO_INTERNO))
})

test('ErroGlobal: documento proprio, mensagem publica e so o digest opaco', () => {
  const html = renderToString(h(ErroGlobal, { error: Object.assign(new Error('ECONNREFUSED 10.0.0.1'), { digest: 'abc123' }) }))
  assert.match(html, /<html lang="pt-BR">/)
  assert.ok(html.includes('abc123'))
  assert.ok(!html.includes('ECONNREFUSED'), 'mensagem interna vazou')
})

test('acaoProtegida: o requisito chega inteiro ao nucleo (a funcionalidade nao se perde no caminho)', async () => {
  const requisitos = []
  const m = criarMolduraDoServidor({ paginas: paginas({ requisitos }), cabecalho: async () => null, gravarCookie: async () => {} })
  await m.acaoProtegida({ modulo: 'zona2', funcionalidade: 'tarefas.concluir' }, '/zona2', async () => ({ toast: { tipo: 'sucesso', texto: 'ok' }, destino: '/zona2' }))
  await m.acaoProtegida({ administra: true }, '/acesso', async () => ({ toast: { tipo: 'sucesso', texto: 'ok' }, destino: '/acesso' }))
  assert.deepEqual(requisitos, [{ modulo: 'zona2', funcionalidade: 'tarefas.concluir' }, { administra: true }])
})
