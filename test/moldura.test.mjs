import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import {
  Moldura, FormularioDeAcao, executarAcao, destinoSeguro, FALHA_DE_ACAO, emitirToast, ouvirToasts, serializarFlash, lerFlash, validarToast,
} from '../dist/index.js'

const MENU = [
  { id: 'shell.inicio', rotulo: 'Início', prefixo: '/' },
  { id: 'zona1.painel', rotulo: 'Painel', prefixo: '/zona1' },
]
const render = (props) => renderToString(h(Moldura, { menu: MENU, children: h('h1', null, 'Titulo da pagina'), ...props }))

test('o menu mostra so os modulos recebidos, e aria-current so no ativo', () => {
  const html = render({ ativo: 'zona1.painel' })
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1)
  assert.match(html, /<a href="\/zona1" aria-current="page">Painel<\/a>/)
  assert.match(html, /<a href="\/">Início<\/a>/)
  assert.ok(!html.includes('Relatórios'))
})

test('a moldura nao tem h1: a pagina tem exatamente um', () => {
  assert.equal((render({}).match(/<h1/g) ?? []).length, 1)
})

test('usuario aparece com o botao de sair, que e um POST ao shell', () => {
  const html = render({ usuario: { nome: 'Ana Operadora' } })
  assert.match(html, /Ana Operadora/)
  const form = html.match(/<form[^>]*>/)?.[0] ?? ''
  assert.match(form, /action="\/api\/auth\/sair"/)
  assert.match(form, /method="post"/)
  assert.ok(!render({}).includes('/api/auth/sair'), 'sem sessao, sem botao')
})

test('o flash chega renderizado no HTML do documento seguinte', () => {
  const html = render({ flash: { tipo: 'sucesso', texto: 'Tarefa concluída', id: 'f-1' } })
  assert.match(html, /moldura-toast-sucesso">Tarefa concluída</)
  assert.match(html, /role="status"/)
})

test('emitirToast chega ao ouvinte pelo barramento, sem a zona conhecer o nome do evento', () => {
  const alvo = new EventTarget()
  const vistos = []
  const parar = ouvirToasts((t) => vistos.push(t), alvo)
  emitirToast({ tipo: 'info', texto: 'oi' }, alvo)
  parar()
  emitirToast({ tipo: 'info', texto: 'depois de parar' }, alvo)
  assert.deepEqual(vistos, [{ tipo: 'info', texto: 'oi' }])
})

test('toast invalido nao e emitido nem aceito do barramento', () => {
  const alvo = new EventTarget()
  assert.throws(() => emitirToast({ tipo: 'alerta', texto: 'x' }, alvo), TypeError)
  assert.throws(() => emitirToast({ tipo: 'info', texto: 'x'.repeat(201) }, alvo), TypeError)
  const vistos = []
  ouvirToasts((t) => vistos.push(t), alvo)
  for (const detail of [null, 'texto', { tipo: 'info', texto: { html: '<b>' } }, { tipo: 'info' }]) {
    alvo.dispatchEvent(new CustomEvent('erp:moldura:toast', { detail }))
  }
  assert.deepEqual(vistos, [])
})

test('flash: ida e volta, e valor adulterado vira nada', () => {
  const t = { tipo: 'erro', texto: 'Não foi possível; tente de novo' }
  const lido = lerFlash(serializarFlash(t))
  assert.deepEqual({ tipo: lido.tipo, texto: lido.texto }, t)
  assert.match(lido.id, /^[0-9a-f-]{36}$/)
  assert.notEqual(lerFlash(serializarFlash(t)).id, lido.id, 'dois flashes iguais tem ids diferentes')
  assert.equal(lerFlash(encodeURIComponent(JSON.stringify({ ...t, id: '../x' }))), null, 'id hostil')
  for (const v of [undefined, '', '%E0', 'nao-json', encodeURIComponent('{"tipo":"x","texto":"a"}'),
                   encodeURIComponent(JSON.stringify({ tipo: 'info', texto: 'a', id: 'x', extra: '<script>' }))]) {
    const r = lerFlash(v)
    assert.ok(r === null || !('extra' in r), `aceitou ${v}`)
  }
  assert.equal(validarToast({ tipo: 'info', texto: '' }), null)
})

test('executarAcao troca o documento para o destino interno devolvido', async () => {
  const idas = []
  await executarAcao(async () => ({ destino: '/zona1' }), new FormData(), (d) => idas.push(d), () => assert.fail('avisou'))
  assert.deepEqual(idas, ['/zona1'])
})

test('executarAcao nunca navega para fora: //, /\\ ou URL absoluta viram /', async () => {
  for (const destino of ['//evil.com', '/\\evil.com', 'https://evil.com', undefined, 42]) {
    const idas = []
    await executarAcao(async () => ({ destino }), new FormData(), (d) => idas.push(d), () => {})
    assert.deepEqual(idas, ['/'], String(destino))
  }
  assert.equal(destinoSeguro('/acesso'), '/acesso')
})

test('executarAcao avisa num toast quando a action falha, e nao navega', async () => {
  const avisos = []
  await executarAcao(async () => { throw new Error('rede') }, new FormData(), () => assert.fail('navegou'), (t) => avisos.push(t))
  assert.deepEqual(avisos, [FALHA_DE_ACAO])
})

test('o componente cliente carrega a diretiva use client no pacote publicado', async () => {
  const { readFileSync } = await import('node:fs')
  for (const f of ['HostDeToast.js', 'FormularioDeAcao.js']) {
    assert.match(readFileSync(new URL(`../dist/${f}`, import.meta.url), 'utf8'), /^['"]use client['"]/, f)
  }
  assert.ok(!/^['"]use client['"]/.test(readFileSync(new URL('../dist/Moldura.js', import.meta.url), 'utf8')),
    'a moldura e server-compativel; so o host de toast e ilha')
})

test('moduloAtivo escolhe o prefixo mais longo, sem confundir /zona1 com /zona10', async () => {
  const { moduloAtivo } = await import('../dist/index.js')
  const menu = [...MENU, { id: 'zona1.relatorios', rotulo: 'Relatórios', prefixo: '/zona1/relatorios' }]
  assert.equal(moduloAtivo(menu, '/zona1/relatorios/x'), 'zona1.relatorios')
  assert.equal(moduloAtivo(menu, '/zona1/recursos/r-1'), 'zona1.painel')
  assert.equal(moduloAtivo(menu, '/zona10'), 'shell.inicio')
  assert.equal(moduloAtivo([], '/'), undefined)
})

test('FormularioDeAcao renderiza so campos de texto ocultos e o botao', () => {
  const html = renderToString(h(FormularioDeAcao, { acao: async () => ({ destino: '/' }), campos: { id: 't-1', versao: '2' },
                                                   children: h('button', { type: 'submit' }, 'Ir') }))
  assert.match(html, /<input type="hidden" name="id" value="t-1"\/>/)
  assert.match(html, /<input type="hidden" name="versao" value="2"\/>/)
  assert.match(html, /<button type="submit">Ir<\/button>/)
})
