'use strict'
/**
 * Importa chaves de API que já existem no Hermes e no OpenCode para o cofre do Harness
 * ($DSH_HOME/.credentials.yaml, seção `refs`), sem nunca imprimir um valor.
 * Cada chave é testada no próprio provedor (só o código HTTP aparece) e só as aceitas são gravadas.
 * Logins OAuth (ChatGPT/Codex, Kimi CLI, MiniMax) não são copiados: o token de renovação é único e
 * as duas ferramentas brigariam por ele. Faça o login pelo painel (Configurações → Modelos).
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

function readEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (let line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    line = line.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    let [k, ...v] = line.split('=')
    k = k.replace(/^export\s+/, '').trim()
    const val = v.join('=').trim().replace(/^["']|["']$/g, '')
    if (val) out[k] = val
  }
  return out
}
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return {} } }

function sources() {
  const home = os.homedir()
  const hermes = readEnv(path.join(home, '.hermes', '.env'))
  const opencode = readJson(path.join(home, '.local', 'share', 'opencode', 'auth.json'))
  const oc = (name) => (opencode[name] && opencode[name].type === 'api' ? opencode[name].key : undefined)
  const metaFile = path.join(home, '.config', 'opencode', 'meta-api-key')
  const meta = fs.existsSync(metaFile) ? fs.readFileSync(metaFile, 'utf8').trim() : undefined
  const bearer = (url) => ({ url, mode: 'bearer' })
  return [
    { ref: 'KIMI_API_KEY', provider: 'kimi-coding', from: [['hermes KIMI_API_KEY', hermes.KIMI_API_KEY], ['opencode kimi-for-coding', oc('kimi-for-coding')]], test: bearer('https://api.kimi.com/coding/v1/models') },
    { ref: 'OPENROUTER_API_KEY', provider: 'openrouter', from: [['hermes OPENROUTER_API_KEY', hermes.OPENROUTER_API_KEY]], test: bearer('https://openrouter.ai/api/v1/key') },
    { ref: 'ZAI_API_KEY', provider: 'zai', from: [['opencode zai-coding-plan', oc('zai-coding-plan')], ['hermes GLM_API_KEY', hermes.GLM_API_KEY]], test: bearer('https://api.z.ai/api/coding/paas/v4/models') },
    { ref: 'MINIMAX_API_KEY', provider: 'minimax', from: [['hermes MINIMAX_API_KEY', hermes.MINIMAX_API_KEY], ['opencode minimax-coding-plan', oc('minimax-coding-plan')]], test: bearer('https://api.minimax.io/v1/models') },
    { ref: 'GEMINI_API_KEY', provider: 'google', from: [['hermes GEMINI_API_KEY', hermes.GEMINI_API_KEY], ['opencode google', oc('google')]], test: { url: 'https://generativelanguage.googleapis.com/v1beta/models', mode: 'goog' } },
    { ref: 'OPENAI_API_KEY', provider: 'openai', from: [['hermes OPENAI_API_KEY', hermes.OPENAI_API_KEY]], test: bearer('https://api.openai.com/v1/models') },
    { ref: 'OPENCODE_API_KEY', provider: 'opencode', from: [['hermes OPENCODE_ZEN_API_KEY', hermes.OPENCODE_ZEN_API_KEY], ['opencode opencode', oc('opencode')]], test: bearer('https://opencode.ai/zen/v1/models') },
    { ref: 'OPENCODE_GO_API_KEY', provider: 'opencode-go', from: [['hermes OPENCODE_GO_API_KEY', hermes.OPENCODE_GO_API_KEY], ['opencode opencode-go', oc('opencode-go')]], test: bearer('https://opencode.ai/zen/go/v1/models') },
    { ref: 'NVIDIA_API_KEY', provider: 'nvidia', from: [['hermes NVIDIA_API_KEY', hermes.NVIDIA_API_KEY]], test: bearer('https://integrate.api.nvidia.com/v1/models') },
    { ref: 'META_API_KEY', provider: 'meta', from: [['opencode meta-api-key', meta]], test: bearer('https://api.meta.ai/v1/models') },
    { ref: 'DEEPSEEK_API_KEY', provider: 'deepseek', from: [['hermes DEEPSEEK_API_KEY', hermes.DEEPSEEK_API_KEY]], test: bearer('https://api.deepseek.com/models') },
  ]
}

async function probe(value, test) {
  const headers = { 'User-Agent': 'neuro-harness-credential-check' }
  if (test.mode === 'bearer') headers.Authorization = `Bearer ${value}`
  else headers['x-goog-api-key'] = value
  try {
    const r = await fetch(test.url, { headers, signal: AbortSignal.timeout(20000) })
    return r.status
  } catch { return 0 }
}

function vaultRefs(text) {
  const names = new Set()
  const after = text.split(/\nrefs:\n|^refs:\n/m)[1]
  if (!after) return names
  for (const line of after.split('\n')) {
    if (line && !line.startsWith(' ')) break
    const m = /^ {2}([A-Z0-9_]+):/.exec(line)
    if (m) names.add(m[1])
  }
  return names
}

/**
 * @param {string} dshHome - pasta do Harness ($DSH_HOME)
 * @param {{dryRun?: boolean, overwrite?: boolean, log?: (s: string) => void}} opts
 */
async function importCredentials(dshHome, { dryRun = false, overwrite = false, log = console.log } = {}) {
  const vault = path.join(dshHome, '.credentials.yaml')
  let text = fs.existsSync(vault) ? fs.readFileSync(vault, 'utf8') : 'version: 1\nrefs:\n'
  if (!/^refs:\s*$/m.test(text)) text = text.replace(/\s*$/, '\n') + 'refs:\n'
  const top = text.split('\n').filter((l) => l && !l.startsWith(' ') && !l.startsWith('#')).map((l) => l.split(':')[0])
  if (top[top.length - 1] !== 'refs') throw new Error('o cofre não termina na seção refs:; use o painel (Configurações → Modelos)')
  const have = vaultRefs(text)
  const write = []
  const report = []
  for (const s of sources()) {
    const cands = s.from.filter(([, v]) => v)
    if (!cands.length) { report.push(['➖', s.provider, 'sem chave no Hermes nem no OpenCode']); continue }
    if (have.has(s.ref) && !overwrite) { report.push(['↺', s.provider, `${s.ref} já está no cofre (mantido)`]); continue }
    let chosen
    for (const [origin, value] of cands) {
      const st = await probe(value, s.test)
      const ok = st >= 200 && st < 300
      report.push([ok ? '✅' : '❌', s.provider, `${origin} → HTTP ${st || 'sem resposta'}`])
      if (ok) { chosen = value; break }
    }
    if (chosen) write.push([s.ref, chosen])
  }
  for (const [icon, prov, msg] of report) log(`  ${icon} ${prov.padEnd(12)} ${msg}`)
  if (!write.length || dryRun) return { written: [], wouldWrite: write.map(([r]) => r) }
  fs.mkdirSync(dshHome, { recursive: true })
  if (fs.existsSync(vault)) { fs.copyFileSync(vault, vault + '.bak'); fs.chmodSync(vault + '.bak', 0o600) }
  let lines = text.replace(/\s*$/, '').split('\n')
  for (const [ref, value] of write) {
    const line = `  ${ref}: ${JSON.stringify(value)}`
    const i = lines.findIndex((l) => l.startsWith(`  ${ref}:`))
    if (i >= 0) lines[i] = line
    else lines.push(line)
  }
  const tmp = vault + '.tmp'
  fs.writeFileSync(tmp, lines.join('\n') + '\n', { mode: 0o600 })
  fs.renameSync(tmp, vault)
  fs.chmodSync(vault, 0o600)
  return { written: write.map(([r]) => r) }
}

module.exports = { importCredentials }
