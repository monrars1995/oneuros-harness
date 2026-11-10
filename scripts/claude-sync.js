// Plugin do Claude Code (claude-code/neuro-harness) em dia com a distribuição e com o plugin público:
//   - copia skills/muse-code para o plugin;
//   - grava a versão do pacote no plugin.json;
//   node scripts/claude-sync.js [--check]
const fs = require('fs')
const path = require('path')
const H = require('../lib/harness.js')

const ROOT = path.resolve(__dirname, '..')
const check = process.argv.includes('--check')
const VERSION = require('../package.json').version
let diffs = []

function want(file, content) {
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
  if (cur === content) return
  diffs.push(path.relative(ROOT, file))
  if (!check) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content) }
}

// O plugin central é público (repositório neuro-harness-install, npm @oneuros/harness, marketplace oficial):
// os comandos e o ícone vêm de lá quando o clone está ao lado deste.
const PUB = process.env.NEURO_HARNESS_INSTALL_REPO || path.join(ROOT, '..', 'neuro-harness-install')
const pubPlugin = path.join(PUB, 'claude-plugin')
if (fs.existsSync(path.join(pubPlugin, '.claude-plugin', 'plugin.json'))) {
  const cmds = path.join(pubPlugin, 'commands')
  const mine = path.join(ROOT, 'claude-code', 'neuro-harness', 'commands')
  for (const f of fs.readdirSync(cmds)) want(path.join(mine, f), fs.readFileSync(path.join(cmds, f), 'utf8'))
  for (const f of fs.existsSync(mine) ? fs.readdirSync(mine) : []) {
    if (!fs.existsSync(path.join(cmds, f))) { diffs.push(`claude-code/neuro-harness/commands/${f} (a mais)`); if (!check) fs.rmSync(path.join(mine, f)) }
  }
  const pub = JSON.parse(fs.readFileSync(path.join(pubPlugin, '.claude-plugin', 'plugin.json'), 'utf8'))
  const pjMine = path.join(ROOT, 'claude-code', 'neuro-harness', '.claude-plugin', 'plugin.json')
  want(pjMine, JSON.stringify({ ...pub, version: VERSION }, null, 2) + '\n')
}

const srcSkills = path.join(ROOT, 'skills')
for (const name of fs.readdirSync(srcSkills)) {
  const f = path.join(srcSkills, name, 'SKILL.md')
  if (fs.existsSync(f)) want(path.join(ROOT, 'claude-code', 'neuro-harness', 'skills', name, 'SKILL.md'), fs.readFileSync(f, 'utf8'))
}
const pj = path.join(ROOT, 'claude-code', 'neuro-harness', '.claude-plugin', 'plugin.json')
const plugin = JSON.parse(fs.readFileSync(pj, 'utf8'))
want(pj, JSON.stringify({ ...plugin, version: VERSION }, null, 2) + '\n')

if (check) {
  console.log(diffs.length ? `✗ fora de sincronia: ${diffs.join(', ')} (rode npm run claude:sync)` : '✓ plugin do Claude Code em sincronia')
  process.exit(diffs.length ? 1 : 0)
}
console.log(diffs.length ? `✓ atualizado: ${diffs.join(', ')}` : '✓ nada a mudar')
