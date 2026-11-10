'use strict'
/**
 * Neuro Harness no Claude Code.
 *
 * `neuro-harness claude instalar` monta um marketplace local em <NEURO_HARNESS_HOME>/.claude-plugin/marketplace.json
 * apontando para os pacotes que a distribuição já baixa (pela conta Neuro ou pelo GitHub), nas versões fixadas:
 *
 *   neuro-harness      → <home>/claude-code/neuro-harness      (cópia de claude-code/neuro-harness deste pacote)
 *   neuro-mv-edit      → <home>/engine/neuro-mv-edit/<versão>  (o mesmo motor do Harness)
 *   neuro-ads-manager  → <home>/addons/neuro-ads-manager/<versão>
 *
 * e registra esse marketplace no Claude Code (`claude plugin marketplace add <home>`), instalando ou atualizando os
 * três plugins no escopo do usuário. Não precisa de GitHub. Os plugins de antes (marketplaces `neuro-mv-edit` e
 * `neuro-ads-manager`, um por repositório) saem, para os comandos não aparecerem duplicados.
 *
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const H = require('./harness.js')

const MARKET = 'neuro-harness'
const ROOT = path.resolve(__dirname, '..')
const VERSION = require('../package.json').version
const LEGACY = ['neuro-mv-edit', 'neuro-ads-manager'] // marketplaces antigos, um por plugin

const exists = (p) => { try { fs.accessSync(p); return true } catch { return false } }

/** `claude ... --json`, com o ambiente limpo de variáveis de provedor (não interferem, mas também não vazam). */
function claudeJson(args, timeout = 300000) {
  const env = { ...process.env }
  for (const v of ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']) delete env[v]
  const r = spawnSync('claude', [...args, '--json'], { encoding: 'utf8', timeout, env, shell: H.IS_WIN })
  const text = (r.stdout || '').trim()
  try { return JSON.parse(text) } catch {}
  const last = text.split('\n').filter((l) => /^\s*[[{]/.test(l)).pop()
  try { return last ? JSON.parse(last) : { outcome: 'error', message: (r.stderr || text).slice(-400) } } catch { return { outcome: 'error', message: (r.stderr || text).slice(-400) } }
}

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }

/** Os três plugins: pasta de origem, versão (do plugin.json) e se estão prontos para entrar no marketplace. */
function pluginDirs(p) {
  const ads = H.ADDONS.find((a) => a.name === 'neuro-ads-manager')
  const list = [
    { name: 'neuro-harness', dir: path.join(p.home, 'claude-code', 'neuro-harness'), src: path.join(ROOT, 'claude-code', 'neuro-harness') },
    { name: 'neuro-mv-edit', dir: path.join(p.engineDir, H.ENGINE_VERSION) },
  ]
  if (ads) list.push({ name: 'neuro-ads-manager', dir: path.join(p.addonsDir, ads.name, ads.version) })
  for (const it of list) {
    const pj = readJson(path.join(it.dir, '.claude-plugin', 'plugin.json'))
    it.version = pj && pj.version
    it.ok = Boolean(pj)
  }
  return list
}

function copyDir(src, dst) {
  fs.rmSync(dst, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.cpSync(src, dst, { recursive: true, filter: (s) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(s) })
}

/** Grava <home>/.claude-plugin/marketplace.json com os plugins prontos (caminhos relativos à pasta da distribuição). */
function writeMarketplace(p, plugins) {
  const rel = (d) => './' + path.relative(p.home, d).split(path.sep).join('/')
  const desc = {
    'neuro-harness': 'Ponto de partida dos especialistas da Neuro: comecar, verificar, atualizar e a skill muse-code.',
    'neuro-mv-edit': 'Edição de vídeo do bruto à entrega, com exportação em 4K, 1440p ou 1080p (H.264, HEVC, ProRes) sem perder qualidade.',
    'neuro-ads-manager': 'Gestão de tráfego na Meta (auditoria, plano, relatório, conversão) e copy de criativos com compliance.',
  }
  const m = {
    name: MARKET,
    owner: { name: 'Neuro Harness', url: 'https://harness.neuros.my' },
    description: `Neuro Harness ${VERSION} no Claude Code (marketplace local, versões fixadas pela distribuição).`,
    plugins: plugins.filter((x) => x.ok).map((x) => ({ name: x.name, source: rel(x.dir), description: desc[x.name], version: x.version })),
  }
  const f = path.join(p.home, '.claude-plugin', 'marketplace.json')
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(m, null, 2) + '\n')
  return f
}

const samePath = (a, b) => { try { return fs.realpathSync(a) === fs.realpathSync(b) } catch { return path.resolve(a) === path.resolve(b) } }

function state() {
  const list = claudeJson(['plugin', 'list'])
  const markets = claudeJson(['plugin', 'marketplace', 'list'])
  return { plugins: Array.isArray(list) ? list : [], markets: Array.isArray(markets) ? markets : [] }
}

/** Instala ou atualiza os plugins no Claude Code. `fetch` baixa motor e addons que faltarem (sem subir o Harness). */
function install(p, { log = () => {}, fetch = true, dryRun = false } = {}) {
  if (!H.which('claude')) return { ok: false, msg: 'o Claude Code (comando `claude`) não está instalado neste computador: https://claude.com/claude-code' }
  const out = []
  if (fetch && !dryRun) {
    if (H.engineVersion(p) !== H.ENGINE_VERSION || !exists(path.join(p.engineDir, H.ENGINE_VERSION, '.claude-plugin', 'plugin.json'))) {
      try { H.ensureEngine(p, H.ENGINE_VERSION, log) } catch (e) { out.push({ name: 'neuro-mv-edit', ok: false, msg: e.message }) }
    }
    for (const r of H.ensureAddons(p, log)) if (!r.ok) out.push({ name: r.name, ok: false, msg: r.msg })
    for (const r of H.ensurePrivatePacks(p, log)) out.push({ name: r.name, ok: r.ok, msg: r.msg })
  }
  const plugins = pluginDirs(p)
  const core = plugins[0]
  // o plugin central é público (marketplace oficial do Claude, `neuros` ou npm @oneuros/harness): se ele já veio
  // de outro marketplace, o local não instala outra cópia (os comandos /neuro-harness:* apareceriam em dobro)
  const before = dryRun ? { plugins: [] } : state()
  const coreElsewhere = before.plugins.find((q) => q.id.startsWith('neuro-harness@') && q.id !== `neuro-harness@${MARKET}`)
  if (!dryRun) { copyDir(core.src, core.dir); core.version = (readJson(path.join(core.dir, '.claude-plugin', 'plugin.json')) || {}).version; core.ok = true }
  else { const pj = readJson(path.join(core.src, '.claude-plugin', 'plugin.json')); core.ok = Boolean(pj); core.version = pj && pj.version }
  for (const x of plugins) if (!x.ok && !x.skip && !out.find((o) => o.name === x.name)) out.push({ name: x.name, ok: false, msg: `pacote ausente em ${x.dir} (rode neuro-harness entrar e tente de novo)` })
  if (dryRun) return { ok: true, dryRun: true, plan: plugins.map((x) => `${x.name}${x.version ? ' v' + x.version : ''} ← ${x.dir}`) }

  if (coreElsewhere) {
    core.ok = false
    core.skip = true
    if (before.plugins.find((q) => q.id === `neuro-harness@${MARKET}`)) claudeJson(['plugin', 'uninstall', `neuro-harness@${MARKET}`])
    out.push({ name: 'neuro-harness', ok: true, version: coreElsewhere.version, msg: `já instalado por ${coreElsewhere.id.split('@')[1]}` })
  }
  writeMarketplace(p, plugins)
  const st = state()
  // marketplaces antigos (um por plugin) saem, levando os plugins deles
  for (const name of LEGACY) {
    const old = st.markets.find((m) => m.name === name)
    if (old) {
      const r = claudeJson(['plugin', 'marketplace', 'remove', name])
      out.push({ name: `marketplace antigo ${name}`, ok: r.outcome === 'ok', msg: r.outcome === 'ok' ? 'removido (os plugins agora vêm do neuro-harness)' : r.message })
    }
  }
  const market = st.markets.find((m) => m.name === MARKET)
  if (!market || market.source !== 'directory' || !samePath(market.path || '', p.home)) {
    if (market) claudeJson(['plugin', 'marketplace', 'remove', MARKET])
    const r = claudeJson(['plugin', 'marketplace', 'add', p.home, '--scope', 'user'])
    if (r.outcome !== 'ok') return { ok: false, msg: `não consegui registrar o marketplace: ${r.message || 'erro do claude'}`, steps: out }
    out.push({ name: `marketplace ${MARKET}`, ok: true, msg: p.home })
  } else {
    claudeJson(['plugin', 'marketplace', 'update', MARKET])
  }
  const now = state().plugins
  for (const x of plugins.filter((y) => y.ok)) {
    const id = `${x.name}@${MARKET}`
    const cur = now.find((q) => q.id === id)
    const r = cur ? claudeJson(['plugin', 'update', id]) : claudeJson(['plugin', 'install', id, '--scope', 'user'])
    let after = state().plugins.find((q) => q.id === id)
    if (after && !after.enabled) { claudeJson(['plugin', 'enable', id]); after = state().plugins.find((q) => q.id === id) }
    const ok = Boolean(after) && r.outcome !== 'error'
    out.push({ name: x.name, ok, version: after && after.version, msg: ok ? `${cur ? (cur.version === after.version ? 'em dia' : `atualizado de v${cur.version}`) : 'instalado'}${after.enabled ? '' : ' (desativado)'}` : (r.message || 'falhou') })
  }
  return { ok: out.every((o) => o.ok), steps: out }
}

function status(p) {
  if (!H.which('claude')) return { claude: false, rows: [] }
  const st = state()
  const market = st.markets.find((m) => m.name === MARKET)
  const rows = pluginDirs(p).map((x) => {
    const inst = st.plugins.find((q) => q.id === `${x.name}@${MARKET}`) || (x.name === 'neuro-harness' && st.plugins.find((q) => q.id.startsWith('neuro-harness@')))
    const legacy = LEGACY.includes(x.name) && st.plugins.find((q) => q.id === `${x.name}@${x.name}`)
    return { name: x.name, disponivel: x.version || null, instalado: inst ? inst.version : null, ativo: inst ? inst.enabled : false,
      atualizar: Boolean(inst && x.version && inst.version !== x.version), antigo: legacy ? legacy.version : null }
  })
  return { claude: true, market: market ? (market.source === 'directory' ? market.path : `${market.repo || market.url}${market.ref ? '#' + market.ref : ''}`) : null, rows }
}

function remove() {
  if (!H.which('claude')) return { ok: true, steps: [] }
  const st = state()
  const out = []
  for (const q of st.plugins.filter((x) => x.id.endsWith(`@${MARKET}`))) {
    const r = claudeJson(['plugin', 'uninstall', q.id])
    out.push({ name: q.id, ok: r.outcome !== 'error', msg: r.message || 'removido' })
  }
  if (st.markets.find((m) => m.name === MARKET)) {
    const r = claudeJson(['plugin', 'marketplace', 'remove', MARKET])
    out.push({ name: `marketplace ${MARKET}`, ok: r.outcome !== 'error', msg: r.message || 'removido' })
  }
  return { ok: out.every((o) => o.ok), steps: out }
}

module.exports = { install, status, remove, writeMarketplace, pluginDirs, MARKET }
