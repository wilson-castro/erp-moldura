// O host de toast executado de verdade, com um runtime de hooks mínimo no lugar do React
// (sem DOM e sem dependência nova). Pega: host que não ouve o barramento, flash novo
// ignorado depois da montagem, toast duplicado e toast que nunca sai.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

let atual
const hooks = {
  useState: (...a) => atual.useState(...a),
  useRef: (...a) => atual.useRef(...a),
  useEffect: (...a) => atual.useEffect(...a),
}
mock.module('react', { namedExports: hooks })
const jsx = (type, props) => ({ type, props })
mock.module('react/jsx-runtime', { namedExports: { jsx, jsxs: jsx, Fragment: 'fragmento' } })
mock.timers.enable({ apis: ['setTimeout'] })
// No navegador o barramento é o `window`; aqui, um EventTarget no lugar dele.
const barramento = new EventTarget()
for (const m of ['addEventListener', 'removeEventListener', 'dispatchEvent']) globalThis[m] = barramento[m].bind(barramento)
const { HostDeToast, DURACAO_MS } = await import('../dist/HostDeToast.js')
const { emitirToast } = await import('../dist/toast.js')

/** Monta um componente: estado por posição de hook, efeitos rodados quando as deps mudam. */
function montar(Componente) {
  const slots = []
  const limpezas = []
  let i = 0
  let pendentes = []
  atual = {
    useState(inicial) {
      const k = i++
      if (!(k in slots)) slots[k] = typeof inicial === 'function' ? inicial() : inicial
      return [slots[k], (v) => { slots[k] = typeof v === 'function' ? v(slots[k]) : v }]
    },
    useRef(inicial) {
      const k = i++
      if (!(k in slots)) slots[k] = { current: inicial }
      return slots[k]
    },
    useEffect(fn, deps) {
      const k = i++
      const antes = slots[k]
      if (!antes || deps.some((d, j) => d !== antes[j])) pendentes.push([k, fn])
      slots[k] = deps
    },
  }
  const render = (props) => {
    i = 0
    let arvore = Componente(props)
    for (const [k, fn] of pendentes) { limpezas[k]?.(); limpezas[k] = fn() }
    pendentes = []
    i = 0
    arvore = Componente(props)   // segundo passe: o que os efeitos mudaram no estado
    return [arvore.props.children].flat().map((p) => p.props.children)
  }
  return { render, desmontar: () => { for (const l of limpezas) l?.() } }
}

test('o flash do primeiro documento aparece e sai depois do prazo', () => {
  const host = montar(HostDeToast)
  assert.deepEqual(host.render({ flash: { tipo: 'sucesso', texto: 'Feito.', id: 'f1' } }), ['Feito.'])
  mock.timers.tick(DURACAO_MS)
  assert.deepEqual(host.render({ flash: { tipo: 'sucesso', texto: 'Feito.', id: 'f1' } }), [])
  host.desmontar()
})

test('o host ouve o barramento: emitirToast de uma zona aparece', () => {
  const host = montar(HostDeToast)
  assert.deepEqual(host.render({ flash: null }), [])
  emitirToast({ tipo: 'info', texto: 'Da zona.' })
  assert.deepEqual(host.render({ flash: null }), ['Da zona.'])
  host.desmontar()
  emitirToast({ tipo: 'info', texto: 'Depois de desmontar.' })
  assert.deepEqual(host.render({ flash: null }).filter((t) => t === 'Depois de desmontar.'), [], 'continuou ouvindo')
})

test('flash novo numa renderizacao seguinte aparece; o mesmo id nao duplica', () => {
  const host = montar(HostDeToast)
  host.render({ flash: null })
  assert.deepEqual(host.render({ flash: { tipo: 'sucesso', texto: 'Atualizado.', id: 'f2' } }), ['Atualizado.'])
  assert.deepEqual(host.render({ flash: { tipo: 'sucesso', texto: 'Atualizado.', id: 'f2' } }), ['Atualizado.'])
  assert.deepEqual(host.render({ flash: { tipo: 'sucesso', texto: 'Atualizado.', id: 'f3' } }), ['Atualizado.', 'Atualizado.'])
  host.desmontar()
})
