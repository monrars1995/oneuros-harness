// Extrai os dicionários de interface (en e zh) de todos os bundles de cliente do DeepSeek Harness instalado.
// Carrega cada lib/client.js num sandbox, chama o factory e o apply com proxies e captura locale.register(...).
//   node extract.cjs <node_modules/@deepseek-ai> <saída.json>
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = process.argv[2]
const RT = path.resolve(root, '..', '..')
// React do cliente: o runtime não o expõe; aponte REACT_FROM para uma pasta com react 18 instalado.
const realRequire = require('module').createRequire(path.join(process.env.REACT_FROM || process.cwd(), 'package.json'))
const REAL = {}
for (const m of ['react', 'react/jsx-runtime', 'react-dom']) { try { REAL[m] = realRequire(m) } catch {} }
process.on('uncaughtException', () => {})
process.on('unhandledRejection', () => {})
const provided = []
const out = process.argv[3]

function anyProxy(label = 'x') {
  const fn = function () {}
  return new Proxy(fn, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => ''
      if (prop === Symbol.iterator) return function* () {}
      if (prop === 'then') return undefined
      if (prop === 'prototype') return {}
      return anyProxy(`${label}.${String(prop)}`)
    },
    apply() { return anyProxy(`${label}()`) },
    construct() { return anyProxy(`new ${label}`) },
    has() { return true },
  })
}

const dicts = {} // ns -> { en: {...}, zh: {...}, from: pkg }
function capture(pkg, ns, a, b) {
  if (typeof ns !== 'string') return
  let pairs
  if (typeof a === 'string') pairs = [[a, b]]
  else if (a && typeof a === 'object') pairs = Object.entries(a)
  else return
  for (const [loc, entries] of pairs) {
    if (!entries || typeof entries !== 'object') continue
    dicts[ns] = dicts[ns] || { from: pkg }
    dicts[ns][loc] = { ...(dicts[ns][loc] || {}), ...entries }
  }
}

function fakeCtx(pkg) {
  const locale = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'register') return (ns, a, b) => { capture(pkg, ns, a, b); return () => {} }
      if (prop === 'bind') return () => (k) => k
      return anyProxy('locale.' + String(prop))
    },
  })
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'locale') return locale
      if (prop === 'effect') return (fn) => { try { const r = fn(); return r } catch { return () => {} } }
      if (prop === 'inject') return (deps, cb) => { if (typeof cb === 'function') { try { cb(ctx) } catch {} } }
      if (prop === 'get') return (name) => (name === 'locale' ? locale : anyProxy('get:' + name))
      if (prop === 'plugin') return (p, cfg) => { try { (p.apply || p)(ctx, cfg) } catch {} }
      if (prop === 'slots') return new Proxy({}, { get(_s, sp) {
        if (sp === 'inject') return (name, cb) => { try { const r = cb(); if (r && typeof r.next === 'function') for (const _ of r) {} } catch {} }
        return () => () => {}
      } })
      if (prop === 'provide') return (name, value) => { provided.push([pkg, name, value]) }
      if (prop === 'then') return undefined
      return anyProxy('ctx.' + String(prop))
    },
  })
  return ctx
}

const pkgs = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'lib', 'client.js')))
let ok = 0, failed = []
for (const d of pkgs) {
  const file = path.join(root, d, 'lib', 'client.js')
  const loaded = []
  const sandbox = {
    window: { __ModuleLoader__: { load: (m) => loaded.push(m) } },
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    globalThis: undefined, process: { env: {} }, navigator: { languages: ['en'], language: 'en' },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, queueMicrotask: () => {}, AbortController, AbortSignal, EventTarget, Event, crypto: require('crypto').webcrypto, structuredClone, Intl, Symbol, Object, Array, Map, Set, WeakMap, WeakSet, Promise, Error, TypeError,
    JSON, Math, Date, RegExp, Number, String, Boolean, URL, URLSearchParams, TextEncoder, TextDecoder,
    document: anyProxy('document'), matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  }
  sandbox.globalThis = sandbox
  try {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file, timeout: 5000 })
    for (const m of loaded) {
      let exp
      try { exp = m.factory((id) => REAL[id] || anyProxy('require:' + id)) } catch (e) { failed.push(`${d}: factory ${e.message.slice(0, 80)}`); continue }
      const apply = exp && (exp.apply || (exp.default && exp.default.apply))
      if (typeof apply === 'function') {
        try { apply(fakeCtx(d), {}) } catch (e) { failed.push(`${d}: apply ${e.message.slice(0, 80)}`) }
      }
    }
    ok++
  } catch (e) {
    failed.push(`${d}: ${e.message.slice(0, 100)}`)
  }
}
for (const [pkg, name, value] of provided) {
  if (value && value.dicts instanceof Map) for (const [ns, locs] of value.dicts) for (const [loc, entries] of locs) capture(pkg, ns, loc, entries)
}
fs.writeFileSync(out, JSON.stringify(dicts, null, 1))
const nsList = Object.keys(dicts)
const enCount = nsList.reduce((n, ns) => n + Object.keys(dicts[ns].en || {}).length, 0)
console.log(`pacotes lidos: ${ok}/${pkgs.length}; namespaces: ${nsList.length}; textos en: ${enCount}`)
if (failed.length) console.log('avisos:\n  ' + failed.slice(0, 30).join('\n  '))
