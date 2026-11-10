// Verificação do repositório: sintaxe do núcleo e do app, bundles dos plugins e traduções pt-BR.
//   npm run check
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
let fail = 0
const ok = (msg) => console.log(`  ✅ ${msg}`)
const bad = (msg) => { console.log(`  ❌ ${msg}`); fail++ }

const js = ['lib/harness.js', 'lib/credentials.js', 'lib/cli.js', 'lib/claude.js', 'scripts/claude-sync.js', 'apps/desktop/main.js', 'apps/desktop/preload.js', 'apps/desktop/scripts/sync.js']
for (const dir of fs.readdirSync(path.join(ROOT, 'plugins'))) {
  for (const f of ['lib/index.js', 'lib/client.js']) if (fs.existsSync(path.join(ROOT, 'plugins', dir, f))) js.push(`plugins/${dir}/${f}`)
}
for (const f of js) {
  const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' })
  r.status === 0 ? ok(`sintaxe ${f}`) : bad(`sintaxe ${f}: ${r.stderr.trim().split('\n')[0]}`)
}
for (const dir of fs.readdirSync(path.join(ROOT, 'plugins'))) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugins', dir, 'package.json'), 'utf8'))
  const client = pkg.exports && pkg.exports['./client']
  if (client && !fs.existsSync(path.join(ROOT, 'plugins', dir, client))) bad(`${dir}: falta ${client}`)
  else ok(`${dir} ${pkg.version}: manifesto e bundle de cliente`)
}
const py = process.platform === 'win32' ? 'python' : 'python3'
const loc = spawnSync(py, [path.join(ROOT, 'plugins/neuro-harness-pt-br/scripts/build-locale.py'), '--check'], { encoding: 'utf8' })
loc.status === 0 ? ok(loc.stdout.trim()) : bad(`traduções pt-BR:\n${loc.stdout}${loc.stderr}`)
const versions = new Set([
  JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
  JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/desktop/package.json'), 'utf8')).version,
])
versions.size === 1 ? ok(`versão única ${[...versions][0]} (CLI e app)`) : bad(`versões diferentes: ${[...versions].join(', ')}`)
const cc = spawnSync(process.execPath, [path.join(ROOT, 'scripts/claude-sync.js'), '--check'], { encoding: 'utf8' })
cc.status === 0 ? ok(cc.stdout.trim().replace(/^✓ /, '')) : bad(cc.stdout.trim().replace(/^✗ /, ''))
console.log(fail ? `\n${fail} problema(s).` : '\nTudo certo.')
process.exit(fail ? 1 : 0)
