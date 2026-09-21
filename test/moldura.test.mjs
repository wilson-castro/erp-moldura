import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import {
  Moldura, emitirToast, ouvirToasts, serializarFlash, lerFlash, limparFlash, validarToast, NOME_COOKIE_FLASH,
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
  const html = render({ flash: { tipo: 'sucesso', texto: 'Tarefa concluída' } })
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
  assert.deepEqual(lerFlash(serializarFlash(t)), t)
  for (const v of [undefined, '', '%E0', 'nao-json', encodeURIComponent('{"tipo":"x","texto":"a"}'),
                   encodeURIComponent(JSON.stringify({ tipo: 'info', texto: 'a', extra: '<script>' }))]) {
    const r = lerFlash(v)
    assert.ok(r === null || !('extra' in r), `aceitou ${v}`)
  }
  assert.equal(validarToast({ tipo: 'info', texto: '' }), null)
})

test('limparFlash apaga o cookie __Host- com Path=/ e Secure, que um __Host- exige', () => {
  const doc = { cookie: '' }
  limparFlash(doc)
  assert.match(doc.cookie, new RegExp(`^${NOME_COOKIE_FLASH}=; Max-Age=0; Path=/; Secure`))
  assert.doesNotThrow(() => limparFlash(undefined))
})

test('o componente cliente carrega a diretiva use client no pacote publicado', async () => {
  const { readFileSync } = await import('node:fs')
  const js = readFileSync(new URL('../dist/HostDeToast.js', import.meta.url), 'utf8')
  assert.match(js, /^['"]use client['"]/)
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
