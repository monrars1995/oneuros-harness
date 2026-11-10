'use strict'
/**
 * Núcleo do Neuro Harness — sem dependências, usado pela CLI (`neuro-harness`) e pelo app desktop.
 *
 * O Neuro Harness é uma distribuição do DeepSeek Harness (MIT, © DeepSeek): instala o Harness numa
 * versão fixa, o motor neuro-mv-edit, os plugins da distribuição (marca e pt-BR) e um perfil próprio,
 * e sobe o Harness com o ambiente limpo. Funciona em macOS, Linux e Windows.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const net = require('net')
const { spawn, spawnSync } = require('child_process')

const IS_WIN = process.platform === 'win32'
const DSH_VERSION = '0.2.1-alpha.2'
const ENGINE_VERSION = '1.10.0'
const ENGINE_REPO = 'https://github.com/monrars1995/oneuros-mv-edit.git'
const access = require('./access.js')
const DISTRO_PLUGINS = ['neuro-harness-brand', 'neuro-harness-pt-br']
// Plugins da casa, fixados por versão. O código é público; a instalação passa pela conta Neuro aprovada.
const ADDONS = [
  { name: 'neuro-ads-manager', repo: 'https://github.com/monrars1995/oneuros-ads-manager.git', version: '0.2.0' },
]
// Pacote privado da conta: perfis de edição dos clientes (sem dados de campanha). O site só entrega a contas liberadas.
const PRIVATE_PACKS = [{ name: 'neuro-clientes', file: 'neuro-mv-edit/clientes.json' }]
// Sem a conta, só com NEURO_HARNESS_DEV=1 (desenvolvimento): o código público vem direto do GitHub.
const DEV = process.env.NEURO_HARNESS_DEV === '1'
// Plugins oficiais do DeepSeek Harness que o Neuro Harness já entrega ativos (mesma versão do Harness).
const OFFICIAL_PLUGINS = [
  '@deepseek-ai/dsh-experimental-agent-team-profile', // equipes de agentes: roster, mensagens e quadro de tarefas
  '@deepseek-ai/dsh-experimental-auto-review', // permissão "Auto": um modelo revisa cada ação antes de executar
  '@deepseek-ai/dsh-experimental-session-search', // agentes buscam e leem sessões anteriores do espaço de trabalho
  '@deepseek-ai/dsh-experimental-terminal-bundle', // processos de shell que continuam vivos entre chamadas
  '@deepseek-ai/dsh-experimental-session-titles-bundle', // títulos de sessão atualizados a cada pedido
]
const MANAGED_BEGIN = '# >>> neuro-harness (gerenciado pela distribuição; não edite entre as marcas)'
const MANAGED_END = '# <<< neuro-harness'
const RUNTIME_MARK = '# >>> neuro-runtime'
// Variáveis que não podem vazar para o Harness: chaves de provedor vêm do cofre dele, não do ambiente.
const UNSET = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL',
  'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'META_API_KEY', 'CLAUDE_PLUGIN_ROOT', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']

function paths(opts = {}) {
  const home = opts.home || process.env.NEURO_HARNESS_HOME || path.join(os.homedir(), '.neuro-harness')
  const profile = opts.profile || process.env.NEURO_HARNESS_PROFILE || 'neuro'
  const dshHome = path.join(home, 'dsh')
  return {
    home,
    dshHome,
    profile,
    profileDir: path.join(dshHome, 'profiles', profile),
    runtime: path.join(home, 'runtime'),
    dshBin: path.join(home, 'runtime', 'node_modules', '.bin', IS_WIN ? 'dsh.cmd' : 'dsh'),
    engineDir: path.join(home, 'engine', 'neuro-mv-edit'),
    pluginsDir: path.join(home, 'plugins'),
    addonsDir: path.join(home, 'addons'),
    bin: path.join(home, 'bin'),
    log: path.join(home, 'harness.log'),
    pidFile: path.join(home, 'harness.pid'),
    workdir: opts.workdir || process.env.NEURO_WORKDIR || path.join(os.homedir(), 'Neuro'),
    port: Number(opts.port || process.env.NEURO_HARNESS_PORT || 3082),
    // Cache npm das sessões na pasta temporária: é gravável dentro da sandbox do Harness 0.2.1.
    npmCache: path.join(os.tmpdir(), 'neuro-harness-npm-cache'),
    neuroLib: process.env.NEURO_HOME || path.join(os.homedir(), '.neuro-mv-edit'),
  }
}

const exists = (p) => { try { fs.accessSync(p); return true } catch { return false } }
function which(cmd) {
  const exts = IS_WIN ? ['.exe', '.cmd', '.bat', ''] : ['']
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const e of exts) { const f = path.join(dir, cmd + e); try { if (fs.statSync(f).isFile()) return f } catch {} }
  }
  return null
}
function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: IS_WIN && /\.(cmd|bat)$/i.test(cmd) || opts.shell, ...opts })
  return { code: r.status === null ? 1 : r.status, out: (r.stdout || '') + (r.stderr || ''), error: r.error }
}
const note = (log, msg) => { if (log) log(msg) }

/** Ambiente das sessões: PATH com o bin da distribuição na frente e sem pastas do Claude Code; sem chaves de provedor. */
function sessionEnv(p, base = process.env) {
  const env = { ...base }
  for (const v of UNSET) delete env[v]
  const parts = (base.PATH || '').split(path.delimiter).filter((x) => x && !/[\\/]\.claude[\\/]/.test(x) && x !== p.bin)
  env.PATH = [p.bin, ...parts].join(path.delimiter)
  env.DSH_HOME = p.dshHome
  env.npm_config_cache = p.npmCache
  env.NEURO_HOME = p.neuroLib
  return env
}

// ------------------------------------------------------------------ instalação

function runtimeVersion(p) {
  if (!exists(p.dshBin)) return null
  const r = sh(p.dshBin, ['--version'])
  return r.code === 0 ? r.out.trim().split(/\s+/).pop() : null
}

/** Instala o DeepSeek Harness na versão fixada em <home>/runtime (precisa do npm do sistema). */
function ensureRuntime(p, log) {
  if (runtimeVersion(p) === DSH_VERSION) return { ok: true, version: DSH_VERSION, changed: false }
  const npm = which('npm')
  if (!npm) throw new Error('npm não encontrado. Instale o Node.js 22+ (macOS: brew install node · Windows: winget install OpenJS.NodeJS.LTS).')
  fs.mkdirSync(p.runtime, { recursive: true })
  const pkg = path.join(p.runtime, 'package.json')
  if (!exists(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: 'neuro-harness-runtime', private: true }, null, 2) + '\n')
  note(log, `Instalando o DeepSeek Harness ${DSH_VERSION} (uma vez, ~550 MB)...`)
  const r = sh(npm, ['install', '--prefix', p.runtime, '--no-audit', '--no-fund', '--loglevel=error', `@deepseek-ai/dsh@${DSH_VERSION}`])
  if (r.code !== 0) throw new Error(`falha ao instalar o DeepSeek Harness: ${r.out.slice(-600)}`)
  return { ok: true, version: runtimeVersion(p), changed: true }
}

function engineVersion(p) {
  const cli = path.join(p.engineDir, 'current', 'cli', 'cli.js')
  if (!exists(cli)) return null
  const r = sh(process.execPath, [cli, 'version'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
  return r.code === 0 ? r.out.trim() : null
}

/** Instala o motor neuro-mv-edit (versão fixada) e aponta `current` para ele. Pela conta Neuro; clone do GitHub só em desenvolvimento. */
function ensureEngine(p, version = ENGINE_VERSION, log) {
  const dir = path.join(p.engineDir, version)
  if (!exists(path.join(dir, 'cli', 'cli.js'))) {
    note(log, `Instalando o motor neuro-mv-edit v${version}...`)
    fs.mkdirSync(p.engineDir, { recursive: true })
    const tmp = dir + '.tmp'
    fs.rmSync(tmp, { recursive: true, force: true })
    if (access.readKey(p)) {
      // Conta Neuro: o pacote vem do site, sem GitHub.
      const r = access.fetchPackage(p, 'neuro-mv-edit', version, tmp)
      if (!r.ok) throw new Error(r.msg)
    } else if (DEV) {
      if (!which('git')) throw new Error('git não encontrado (macOS: xcode-select --install · Windows: winget install Git.Git).')
      const r = sh('git', ['-c', 'advice.detachedHead=false', 'clone', '-q', '--depth', '1', '--branch', `v${version}`, ENGINE_REPO, tmp])
      if (r.code !== 0) throw new Error(`não consegui clonar o neuro-mv-edit v${version}: ${r.out.slice(-300)}`)
    } else {
      throw new Error('a instalação dos agentes precisa da sua conta Neuro aprovada: rode neuro-harness entrar')
    }
    fs.renameSync(tmp, dir)
  }
  const current = path.join(p.engineDir, 'current')
  try { fs.rmSync(current, { recursive: true, force: true }) } catch {}
  fs.symlinkSync(IS_WIN ? dir : version, current, IS_WIN ? 'junction' : 'dir')
  ensureShims(p)
  return { ok: true, version: engineVersion(p) }
}

/** Atalhos `neuro-mv-edit` no bin da distribuição (sh e .cmd), apontando para o motor fixado. */
function ensureShims(p) {
  fs.mkdirSync(p.bin, { recursive: true })
  const cli = path.join(p.engineDir, 'current', 'cli', 'cli.js')
  const shPath = path.join(p.bin, 'neuro-mv-edit')
  fs.writeFileSync(shPath, `#!/bin/sh\n# neuro-mv-edit do Neuro Harness: motor fixado (troque com: neuro-harness engine <versão>)\nexec node "${cli}" "$@"\n`)
  fs.chmodSync(shPath, 0o755)
  fs.writeFileSync(path.join(p.bin, 'neuro-mv-edit.cmd'), `@echo off\r\nnode "${cli}" %*\r\n`)
}

function profilePatchPath(p) { return path.join(p.profileDir, 'cordis.patch.yml') }

/** Cria o perfil (a partir do modelo Web do Harness) e mantém o bloco gerenciado da distribuição. */
function ensureProfile(p, log) {
  if (!exists(p.profileDir)) {
    note(log, `Criando o perfil ${p.profile}...`)
    const r = sh(p.dshBin, [p.profile, '--from-default-profile', 'web', '--dump-config'], { env: { ...process.env, DSH_HOME: p.dshHome }, cwd: p.home })
    if (r.code !== 0 && !exists(p.profileDir)) throw new Error(`não consegui criar o perfil ${p.profile}: ${r.out.slice(-400)}`)
  }
  const file = profilePatchPath(p)
  let text = exists(file) ? fs.readFileSync(file, 'utf8') : '[]\n'
  if (/^\[\]\s*$/m.test(text) && !/^- /m.test(text)) text = text.replace(/^\[\]\s*$/m, '')
  const managed = [MANAGED_BEGIN,
    '# Marca: o plugin neuro-harness-brand ocupa os espaços de marca; a marca oficial do DeepSeek Harness fica desligada.',
    '- id: ui-brand-official', '  disabled: true', MANAGED_END].join('\n')
  const re = new RegExp(`${escapeRe(MANAGED_BEGIN)}[\\s\\S]*?${escapeRe(MANAGED_END)}`)
  if (re.test(text)) text = text.replace(re, managed)
  else if (/^- id: ui-brand-official\n\s+disabled: true\n?/m.test(text)) text = text.replace(/(# Marca:[^\n]*\n)?- id: ui-brand-official\n\s+disabled: true\n?/m, managed + '\n')
  else {
    const i = text.indexOf(RUNTIME_MARK)
    text = i >= 0 ? text.slice(0, i) + managed + '\n' + text.slice(i) : text.replace(/\s*$/, '\n') + managed + '\n'
  }
  fs.writeFileSync(file, text)
  return { ok: true, file }
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Copia os plugins da distribuição para <home>/plugins (ou liga direto, em desenvolvimento) e instala no perfil. */
function ensurePlugins(p, sourceDir, { link = false, log } = {}) {
  const pkgFile = path.join(p.profileDir, 'package.json')
  const deps = exists(pkgFile) ? (JSON.parse(fs.readFileSync(pkgFile, 'utf8')).dependencies || {}) : {}
  const results = []
  for (const name of DISTRO_PLUGINS) {
    const src = path.join(sourceDir, name)
    if (!exists(path.join(src, 'package.json'))) { results.push({ name, ok: false, msg: `não encontrado em ${src}` }); continue }
    // Sem o bundle de cliente o Harness falha ao compor a interface: pula o plugin até ele existir.
    const manifest = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'))
    const clientRel = manifest.exports && manifest.exports['./client']
    if (clientRel && !exists(path.join(src, clientRel))) { results.push({ name, ok: false, msg: `falta ${clientRel} (gere antes de instalar)` }); continue }
    let target = src
    if (!link) {
      target = path.join(p.pluginsDir, name)
      const srcVer = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')).version
      const curVer = exists(path.join(target, 'package.json')) ? JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8')).version : null
      if (curVer !== srcVer || !sameTree(src, target)) {
        fs.rmSync(target, { recursive: true, force: true })
        fs.cpSync(src, target, { recursive: true })
      }
    }
    const spec = `link:${target}`
    if (deps[name] !== spec) {
      note(log, `Instalando o plugin ${name} no perfil ${p.profile}...`)
      const r = sh(p.dshBin, ['plugin', '--profile', p.profile, 'add', spec], { env: { ...process.env, DSH_HOME: p.dshHome }, cwd: p.home })
      if (r.code !== 0) { results.push({ name, ok: false, msg: r.out.slice(-300) }); continue }
    }
    results.push({ name, ok: true, target })
  }
  return results
}
function sameTree(a, b) {
  try {
    const list = (d) => fs.readdirSync(d, { recursive: true }).filter((f) => !String(f).includes('node_modules')).sort()
    const la = list(a), lb = list(b)
    if (la.join('|') !== lb.join('|')) return false
    return la.every((f) => { const fa = path.join(a, f); return fs.statSync(fa).isDirectory() || fs.readFileSync(fa).equals(fs.readFileSync(path.join(b, f))) })
  } catch { return false }
}

/** Instalação completa e idempotente. */
/**
 * Skills da distribuição em <DSH_HOME>/skills (o Harness lê essa pasta sozinho).
 * A do Muse Code só entra quando o CLI `muse` existe nesta máquina.
 */
function ensureSkills(p, log) {
  const src = path.join(__dirname, '..', 'skills')
  const dst = path.join(p.dshHome, 'skills')
  const out = []
  if (!exists(src)) return out
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name, 'SKILL.md')
    if (!exists(from)) continue
    const target = path.join(dst, name)
    const wanted = name !== 'muse-code' || Boolean(which('muse'))
    if (!wanted) { if (exists(target)) fs.rmSync(target, { recursive: true, force: true }); continue }
    fs.mkdirSync(target, { recursive: true })
    const body = fs.readFileSync(from)
    const cur = exists(path.join(target, 'SKILL.md')) ? fs.readFileSync(path.join(target, 'SKILL.md')) : null
    if (!cur || !cur.equals(body)) { fs.writeFileSync(path.join(target, 'SKILL.md'), body); note(log, `Skill ${name} instalada.`) }
    out.push(name)
  }
  return out
}

function setup(p, { pluginsSource, link = false, log } = {}) {
  for (const d of [p.home, p.workdir, p.neuroLib, p.npmCache]) fs.mkdirSync(d, { recursive: true })
  const steps = {}
  steps.runtime = ensureRuntime(p, log)
  steps.engine = engineVersion(p) === ENGINE_VERSION ? { ok: true, version: ENGINE_VERSION } : ensureEngine(p, ENGINE_VERSION, log)
  ensureShims(p)
  steps.profile = ensureProfile(p, log)
  steps.plugins = pluginsSource ? ensurePlugins(p, pluginsSource, { link, log }) : []
  steps.addons = ensureAddons(p, log)
  steps.profilePlugins = ensureProfilePlugins(p, log)
  steps.skills = ensureSkills(p, log)
  steps.packs = ensurePrivatePacks(p, log)
  return steps
}

/** Baixa os plugins da casa (tag fixada) para <home>/addons/<nome>/<versão>. */
function ensureAddons(p, log) {
  const out = []
  for (const a of ADDONS) {
    const dir = path.join(p.addonsDir, a.name, a.version)
    if (!exists(path.join(dir, 'package.json'))) {
      note(log, `Baixando o plugin ${a.name} v${a.version}...`)
      fs.mkdirSync(path.dirname(dir), { recursive: true })
      const tmp = dir + '.tmp'
      fs.rmSync(tmp, { recursive: true, force: true })
      if (access.readKey(p)) {
        const r = access.fetchPackage(p, a.name, a.version, tmp)
        if (!r.ok) { out.push({ name: a.name, ok: false, msg: r.msg }); continue }
      } else if (DEV) {
        const r = sh('git', ['-c', 'advice.detachedHead=false', 'clone', '-q', '--depth', '1', '--branch', `v${a.version}`, a.repo, tmp])
        if (r.code !== 0) { out.push({ name: a.name, ok: false, msg: `não consegui clonar v${a.version}` }); continue }
      } else {
        out.push({ name: a.name, ok: false, msg: 'precisa da sua conta Neuro aprovada (neuro-harness entrar)' }); continue
      }
      fs.renameSync(tmp, dir)
    }
    out.push({ name: a.name, ok: true, version: a.version, dir })
  }
  return out
}

/**
 * Pacotes privados da conta (perfis de edição dos clientes). O site só entrega a contas liberadas para eles;
 * as demais recebem 403/404 e seguem sem nada. Os perfis entram na biblioteca do usuário (~/.neuro-mv-edit),
 * sem sobrescrever o que já existe lá.
 */
function ensurePrivatePacks(p, log) {
  const out = []
  if (!access.readKey(p)) return out
  const cli = path.join(p.engineDir, 'current', 'cli', 'cli.js')
  for (const pk of PRIVATE_PACKS) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-priv-'))
    try {
      const r = access.fetchPackage(p, pk.name, 'latest', tmp)
      if (!r.ok) { if (!/acesso não aprovado|HTTP 404|HTTP 403/.test(r.msg)) out.push({ name: pk.name, ok: false, msg: r.msg }); continue }
      const f = path.join(tmp, pk.file)
      if (!exists(f) || !exists(cli)) continue
      const imp = sh(process.execPath, [cli, 'perfil', 'importar', f], { env: { ...process.env, NEURO_HOME: p.neuroLib } })
      note(log, `Perfis da sua conta (${pk.name}) na biblioteca.`)
      out.push({ name: pk.name, ok: imp.code === 0, msg: imp.code === 0 ? 'perfis da conta instalados' : imp.out.slice(-200) })
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }
  return out
}

/** Plugins que o perfil precisa ter: o motor e os da casa (link para a versão fixada) e os oficiais escolhidos. */
function wantedProfilePlugins(p) {
  const want = { 'neuro-mv-edit': `link:${path.join(p.engineDir, ENGINE_VERSION)}` }
  for (const a of ADDONS) {
    const dir = path.join(p.addonsDir, a.name, a.version)
    if (exists(path.join(dir, 'package.json'))) want[a.name] = `link:${dir}`
  }
  for (const name of OFFICIAL_PLUGINS) want[name] = DSH_VERSION
  return want
}

function profileDeps(p) {
  const f = path.join(p.profileDir, 'package.json')
  return exists(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).dependencies || {}) : {}
}

/** Instala no perfil o que falta ou mudou de versão (uma chamada para links, outra para pacotes do npm). */
function ensureProfilePlugins(p, log) {
  const deps = profileDeps(p)
  const want = wantedProfilePlugins(p)
  const missing = Object.entries(want).filter(([name, spec]) => deps[name] !== spec)
  const links = missing.filter(([, spec]) => spec.startsWith('link:')).map(([, spec]) => spec)
  const npmSpecs = missing.filter(([, spec]) => !spec.startsWith('link:')).map(([name, spec]) => `${name}@${spec}`)
  const results = []
  for (const batch of [links, npmSpecs]) {
    if (!batch.length) continue
    note(log, `Instalando no perfil ${p.profile}: ${batch.map((s) => s.replace(/^link:.*[\\/]([^\\/]+)[\\/][^\\/]+$/, '$1').replace(/@[^@]+$/, '')).join(', ')}...`)
    const r = sh(p.dshBin, ['plugin', '--profile', p.profile, 'add', ...batch], { env: { ...process.env, DSH_HOME: p.dshHome }, cwd: p.home })
    if (r.code !== 0) results.push({ ok: false, msg: r.out.slice(-400) })
  }
  const after = profileDeps(p)
  for (const [name, spec] of Object.entries(want)) results.push({ name, ok: after[name] === spec })
  return results
}

/** Pré-requisitos do sistema (o app e o instalador usam esta lista). */
function checkPrereqs() {
  const ver = (cmd, args, re) => {
    const bin = which(cmd)
    if (!bin) return null
    const r = sh(bin, args)
    const m = re.exec(r.out)
    return m ? m[1] : r.code === 0 ? '?' : null
  }
  const major = (v) => Number(String(v || '0').split('.')[0])
  const node = ver('node', ['--version'], /v(\d+\.\d+\.\d+)/)
  const py = ver(IS_WIN ? 'python' : 'python3', ['--version'], /Python (\d+\.\d+)/)
  const ff = ver('ffmpeg', ['-version'], /ffmpeg version n?(\d+[^\s]*)/)
  const gitv = ver('git', ['--version'], /version (\d+\.\d+)/)
  const ghv = ver('gh', ['--version'], /version (\d+\.\d+)/)
  const ghAuth = ghv ? sh(which('gh'), ['auth', 'status']).code === 0 : false
  const hasKey = Boolean(access.readKey(paths()))
  const pyOk = py ? (() => { const [a, b] = py.split('.').map(Number); return a > 3 || (a === 3 && b >= 10) })() : false
  return [
    { id: 'node', label: 'Node.js 22+', ok: major(node) >= 22, found: node },
    { id: 'git', label: 'git', ok: Boolean(gitv), found: gitv },
    { id: 'python', label: 'Python 3.10+', ok: pyOk, found: py },
    { id: 'ffmpeg', label: 'FFmpeg 5+', ok: ff ? (major(ff) >= 5 || !/^\d/.test(ff)) : false, found: ff },
    // A instalação dos agentes passa pela conta Neuro aprovada (o código é público).
    { id: 'conta', label: 'conta Neuro (neuro-harness entrar)', ok: hasKey || DEV, found: hasKey ? 'conta Neuro' : DEV ? 'modo desenvolvimento' : null },
  ]
}

// ------------------------------------------------------------------ execução

const readPid = (p) => { try { return Number(fs.readFileSync(p.pidFile, 'utf8').trim()) || null } catch { return null } }
function alive(pid) { if (!pid) return false; try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
function url(p) {
  try {
    const m = fs.readFileSync(p.log, 'utf8').match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/g)
    return m ? m[m.length - 1] : null
  } catch { return null }
}
function running(p) { const pid = readPid(p); return alive(pid) ? pid : null }
function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)))
    s.listen(port, '127.0.0.1')
  })
}

/** Sobe o Harness em segundo plano (processo próprio, log em <home>/harness.log) e devolve a URL local. */
async function start(p, { log, timeoutMs = 90000 } = {}) {
  const pid = running(p)
  if (pid && url(p)) return { pid, url: url(p), reused: true }
  if (!exists(p.dshBin)) throw new Error('Harness não instalado: rode neuro-harness setup')
  const port = (await portFree(p.port)) ? p.port : 0
  fs.mkdirSync(p.workdir, { recursive: true })
  fs.writeFileSync(p.log, '')
  const out = fs.openSync(p.log, 'a')
  const child = spawn(p.dshBin, ['--profile', p.profile, '--no-open', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: p.workdir, env: sessionEnv(p), detached: !IS_WIN, stdio: ['ignore', out, out], shell: IS_WIN, windowsHide: true,
  })
  child.unref()
  fs.writeFileSync(p.pidFile, String(child.pid))
  note(log, `Subindo o Neuro Harness (porta ${port || 'livre'})...`)
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const u = url(p)
    if (u) return { pid: child.pid, url: u, reused: false }
    if (!alive(child.pid)) break
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`o Harness não subiu; veja ${p.log}\n${tail(p.log, 1200)}`)
}
const tail = (f, n) => { try { const s = fs.readFileSync(f, 'utf8'); return s.slice(-n) } catch { return '' } }

/** Para o Harness com sinal de encerramento e espera ele sair. */
async function stop(p, { timeoutMs = 30000 } = {}) {
  const pid = running(p)
  if (!pid) { fs.rmSync(p.pidFile, { force: true }); return { stopped: false } }
  if (IS_WIN) sh('taskkill', ['/PID', String(pid), '/T'])
  else { try { process.kill(-pid, 'SIGINT') } catch { try { process.kill(pid, 'SIGINT') } catch {} } }
  const t0 = Date.now()
  while (alive(pid) && Date.now() - t0 < timeoutMs) await new Promise((r) => setTimeout(r, 300))
  if (alive(pid)) { if (IS_WIN) sh('taskkill', ['/PID', String(pid), '/T', '/F']); else { try { process.kill(-pid, 'SIGKILL') } catch {} } }
  fs.rmSync(p.pidFile, { force: true })
  return { stopped: true }
}

/** Uma tarefa sem interface (perfil headless do Harness), com os provedores do perfil neuro. */
function runTask(p, task, { model } = {}) {
  const file = profilePatchPath(p)
  const text = exists(file) ? fs.readFileSync(file, 'utf8') : ''
  const i = text.indexOf(RUNTIME_MARK)
  let overlay = i >= 0 ? text.slice(i) : ''
  if (model) {
    const [provider, ...rest] = model.split('/')
    overlay += `\n- id: agent-default-model\n  name: "@deepseek-ai/dsh-agent-default-model"\n  config:\n    provider: ${provider}\n    model: ${rest.join('/')}\n`
  }
  const overlayFile = path.join(p.home, 'run.patch.yml')
  fs.writeFileSync(overlayFile, overlay || '[]\n')
  return spawnSync(p.dshBin, ['headless', '--patch', overlayFile, task], { cwd: p.workdir, env: sessionEnv(p), stdio: 'inherit', shell: IS_WIN }).status
}

// ------------------------------------------------------------------ diagnóstico

function doctor(p) {
  const rows = []
  const add = (ok, msg) => rows.push({ ok, msg })
  const nodeMajor = Number(process.versions.node.split('.')[0])
  add(nodeMajor >= 22 ? true : false, `Node.js ${process.versions.node}${nodeMajor >= 22 ? '' : ' (precisa 22+)'}`)
  for (const c of ['git', IS_WIN ? 'python' : 'python3', 'ffmpeg']) add(Boolean(which(c)), which(c) ? c : `${c} não encontrado`)
  const rv = runtimeVersion(p)
  add(rv === DSH_VERSION, rv ? `DeepSeek Harness ${rv} em ${p.runtime}` : 'Harness não instalado (neuro-harness setup)')
  const ev = engineVersion(p)
  add(Boolean(ev), ev ? `motor neuro-mv-edit v${ev} (atalho em ${p.bin})` : 'motor neuro-mv-edit ausente (neuro-harness engine)')
  add(exists(p.profileDir), exists(p.profileDir) ? `perfil ${p.profile}` : `perfil ${p.profile} ausente (neuro-harness setup)`)
  const pkgFile = path.join(p.profileDir, 'package.json')
  const deps = exists(pkgFile) ? (JSON.parse(fs.readFileSync(pkgFile, 'utf8')).dependencies || {}) : {}
  for (const n of DISTRO_PLUGINS) add(Boolean(deps[n]), deps[n] ? `plugin ${n}` : `plugin ${n} não instalado (neuro-harness setup)`)
  for (const [n, spec] of Object.entries(wantedProfilePlugins(p))) add(deps[n] === spec, deps[n] === spec ? `plugin ${n}` : `plugin ${n} ${deps[n] ? 'em outra versão' : 'não instalado'} (neuro-harness setup)`)
  const vault = path.join(p.dshHome, '.credentials.yaml')
  const refs = exists(vault) ? (fs.readFileSync(vault, 'utf8').split(/\nrefs:\n/)[1] || '').split('\n').filter((l) => /^ {2}[A-Z0-9_]+:/.test(l)).map((l) => l.trim().split(':')[0]) : []
  add(refs.length > 0, refs.length ? `${refs.length} chaves de provedor no cofre (${refs.join(', ')})` : 'nenhuma chave de provedor (neuro-harness credenciais, ou Settings → Models)')
  add(true, `cache npm das sessões: ${p.npmCache}`)
  if (!IS_WIN && exists(path.join(os.homedir(), '.npm'))) {
    const r = sh('find', [path.join(os.homedir(), '.npm'), '-user', 'root', '-print', '-quit'])
    add(!r.out.trim(), r.out.trim() ? '~/.npm tem arquivos do root: sudo chown -R "$(id -u):$(id -g)" ~/.npm' : '~/.npm sem arquivos do root')
  }
  const pid = running(p)
  add(true, pid ? `rodando (pid ${pid}): ${url(p) || 'sem URL ainda'}` : 'parado')
  return rows
}

module.exports = {
  access,
  DSH_VERSION, ENGINE_VERSION, DISTRO_PLUGINS, OFFICIAL_PLUGINS, ADDONS, IS_WIN,
  paths, sessionEnv, setup, ensureRuntime, ensureEngine, ensureShims, ensureProfile, ensurePlugins, ensureAddons, ensureProfilePlugins, ensureSkills, ensurePrivatePacks, checkPrereqs,
  start, stop, running, url, runTask, doctor, runtimeVersion, engineVersion, which,
}
