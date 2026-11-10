// Copia o núcleo (lib/), os plugins da distribuição e os avisos de licença para apps/desktop/vendor,
// de onde o electron-builder empacota. Rode antes de `electron .` e de qualquer build.
const fs = require('fs')
const path = require('path')

const APP = path.resolve(__dirname, '..')
const ROOT = path.resolve(APP, '..', '..')
const VENDOR = path.join(APP, 'vendor')

fs.rmSync(VENDOR, { recursive: true, force: true })
fs.mkdirSync(VENDOR, { recursive: true })
fs.cpSync(path.join(ROOT, 'lib'), path.join(VENDOR, 'lib'), { recursive: true })
fs.cpSync(path.join(ROOT, 'package.json'), path.join(VENDOR, 'package.json'))
fs.mkdirSync(path.join(VENDOR, 'plugins'))
for (const name of fs.readdirSync(path.join(ROOT, 'plugins'))) {
  const src = path.join(ROOT, 'plugins', name)
  if (!fs.statSync(src).isDirectory()) continue
  fs.cpSync(src, path.join(VENDOR, 'plugins', name), { recursive: true, filter: (f) => !f.includes(`${path.sep}node_modules`) })
}
fs.cpSync(path.join(ROOT, 'skills'), path.join(VENDOR, 'skills'), { recursive: true })
for (const f of ['NOTICE', 'LICENSE']) fs.cpSync(path.join(ROOT, f), path.join(VENDOR, f))
console.log('vendor pronto:', fs.readdirSync(path.join(VENDOR, 'plugins')).join(', '))
