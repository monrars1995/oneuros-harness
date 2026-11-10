'use strict'
/**
 * Acesso pela conta Neuro: a chave pessoal de instalação (nh_…) e o download dos pacotes
 * privados pelo site (harness.neuros.my/api/pacotes), sem login no GitHub.
 *
 * A chave fica em <home>/acesso.json (modo 600) ou vem de NEURO_HARNESS_CHAVE.
 * Sem chave, a instalação dos agentes é recusada (só NEURO_HARNESS_DEV=1 clona os repositórios públicos).
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const SITE = (process.env.NEURO_HARNESS_SITE || 'https://harness.neuros.my').replace(/\/$/, '')
const IS_WIN = process.platform === 'win32'

const file = (p) => path.join(p.home, 'acesso.json')

function readKey(p) {
  const env = (process.env.NEURO_HARNESS_CHAVE || '').trim()
  if (env) return env
  try { return JSON.parse(fs.readFileSync(file(p), 'utf8')).key || null } catch { return null }
}

function saveKey(p, key, extra = {}) {
  if (!/^nh_[A-Za-z0-9_-]{20,}$/.test(key)) throw new Error('chave inválida (esperado nh_…)')
  fs.mkdirSync(p.home, { recursive: true })
  fs.writeFileSync(file(p), JSON.stringify({ key, site: SITE, savedAt: new Date().toISOString(), ...extra }, null, 2) + '\n', { mode: 0o600 })
  try { fs.chmodSync(file(p), 0o600) } catch {}
}

function clearKey(p) { try { fs.rmSync(file(p)); return true } catch { return false } }

const mask = (k) => (k ? k.slice(0, 6) + '…' + k.slice(-4) : '')

/**
 * Baixa o tarball de <pacote>@<versão> pelo site e extrai em destDir (sem a pasta-raiz do tarball).
 * O curl manda a chave por arquivo de cabeçalho (não aparece na lista de processos) e não a
 * repassa no redirecionamento para o link temporário do GitHub.
 */
function fetchPackage(p, name, version, destDir) {
  const key = readKey(p)
  if (!key) return { ok: false, msg: 'sem chave de instalação (rode: neuro-harness entrar)' }
  const curl = IS_WIN ? 'curl.exe' : 'curl'
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-pkg-'))
  const hdr = path.join(tmp, 'h')
  const tgz = path.join(tmp, 'p.tgz')
  try {
    fs.writeFileSync(hdr, `Authorization: Bearer ${key}\n`, { mode: 0o600 })
    const url = `${SITE}/api/pacotes/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
    const r = spawnSync(curl, ['-fsSL', '--retry', '2', '-H', `@${hdr}`, '-o', tgz, '-w', '%{http_code}', url], { encoding: 'utf8' })
    if (r.error) return { ok: false, msg: `curl não encontrado (${r.error.message})` }
    if (r.status !== 0) {
      const code = (r.stdout || '').trim()
      const why = code === '401' ? 'chave inválida ou revogada' : code === '403' ? 'acesso não aprovado' : code === '501' ? 'o site ainda não serve pacotes' : `HTTP ${code || '?'}`
      return { ok: false, msg: `não consegui baixar ${name} ${version} pelo site (${why})` }
    }
    fs.rmSync(destDir, { recursive: true, force: true })
    fs.mkdirSync(destDir, { recursive: true })
    const t = spawnSync('tar', ['-xzf', tgz, '-C', destDir, '--strip-components=1'], { encoding: 'utf8' })
    if (t.status !== 0) return { ok: false, msg: `não consegui extrair ${name} (${(t.stderr || '').slice(-200)})` }
    return { ok: true }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

async function api(pathname, opts = {}) {
  const r = await fetch(SITE + pathname, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, signal: AbortSignal.timeout(15000) })
  let data = {}
  try { data = await r.json() } catch {}
  return { ok: r.ok, status: r.status, data }
}

function openBrowser(url) {
  const cmd = IS_WIN ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]
  try { spawnSync(cmd[0], cmd[1], { stdio: 'ignore' }) } catch {}
}

/** Fluxo de dispositivo: mostra um código, o usuário confirma no site já logado, a máquina recebe a chave. */
async function deviceLogin(p, { log = console.log, open = true } = {}) {
  const c = await api('/api/dispositivo/codigo', { method: 'POST', body: '{}' })
  if (!c.ok) throw new Error(c.status === 503 ? 'o login pela conta Neuro ainda não está ligado no site' : `não consegui iniciar o login (HTTP ${c.status})`)
  const { codigo, segredo, url } = c.data
  log(`\nConfirme este computador na sua conta Neuro:\n\n  ${url}\n\n  Código: ${codigo}\n`)
  if (open) openBrowser(url)
  log('Aguardando a confirmação (até 10 minutos)...')
  const until = Date.now() + 10 * 60e3
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 3000))
    const s = await api(`/api/dispositivo/status?codigo=${encodeURIComponent(codigo)}&segredo=${encodeURIComponent(segredo)}`).catch(() => ({ data: {} }))
    const st = s.data && s.data.estado
    if (st === 'confirmado') {
      const k = await api('/api/dispositivo/resgatar', { method: 'POST', body: JSON.stringify({ codigo, segredo }) })
      if (!k.ok || !k.data.key) throw new Error('a confirmação chegou, mas não consegui receber a chave')
      saveKey(p, k.data.key, { maquina: os.hostname() })
      return k.data.key
    }
    if (st === 'expirado' || st === 'invalido' || st === 'usado') throw new Error(`o código ${st === 'usado' ? 'já foi usado' : 'expirou'}; rode de novo`)
  }
  throw new Error('o tempo para confirmar acabou; rode de novo')
}

/** Confere a chave no site sem baixar nada. */
async function checkKey(p) {
  const key = readKey(p)
  if (!key) return { ok: false, msg: 'sem chave' }
  const r = await api('/api/chave', { headers: { Authorization: `Bearer ${key}` } }).catch((e) => ({ ok: false, status: 0, data: { error: e.message } }))
  return r.ok ? { ok: true, ...r.data } : { ok: false, msg: r.status === 401 ? 'chave inválida ou revogada' : (r.data.error || `HTTP ${r.status}`) }
}

module.exports = { SITE, readKey, saveKey, clearKey, mask, fetchPackage, deviceLogin, checkKey, file }
