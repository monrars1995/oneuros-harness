'use strict'
/**
 * Biblioteca do usuário entre computadores.
 *
 *   neuro-harness biblioteca exportar [--saida arquivo.tgz]
 *   neuro-harness biblioteca importar <arquivo.tgz|.json> [--sobrescrever]
 *
 * O pacote (.tgz) leva o que é do usuário e serve para editar em outro Mac:
 *   - biblioteca.json: perfis, temas e estilos seus (formato neuro-mv-edit/biblioteca, o do `perfil exportar`);
 *   - audio_bank/: trilhas e efeitos guardados em ~/.neuro-mv-edit/audio_bank.
 * Não leva a memória (preferências aprendidas e histórico), nem chaves, nem nada de campanhas.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const exists = (p) => { try { fs.accessSync(p); return true } catch { return false } }

function engineCli(p) {
  const cli = path.join(p.engineDir, 'current', 'cli', 'cli.js')
  if (!exists(cli)) throw new Error('motor neuro-mv-edit não instalado (rode: neuro-harness setup ou neuro-harness claude instalar)')
  return cli
}

function run(p, args) {
  const r = spawnSync(process.execPath, [engineCli(p), ...args], { encoding: 'utf8', env: { ...process.env, NEURO_HOME: p.neuroLib } })
  return { code: r.status === null ? 1 : r.status, out: (r.stdout || '') + (r.stderr || '') }
}

function copyTree(src, dst, overwrite, stats) {
  for (const name of fs.readdirSync(src)) {
    if (name === '.DS_Store') continue
    const a = path.join(src, name)
    const b = path.join(dst, name)
    if (fs.statSync(a).isDirectory()) { fs.mkdirSync(b, { recursive: true }); copyTree(a, b, overwrite, stats); continue }
    if (exists(b) && !overwrite) { stats.pulados++; continue }
    fs.copyFileSync(a, b)
    stats.copiados++
  }
}

function countFiles(dir) {
  if (!exists(dir)) return 0
  let n = 0
  for (const name of fs.readdirSync(dir)) {
    const f = path.join(dir, name)
    n += fs.statSync(f).isDirectory() ? countFiles(f) : (name === '.DS_Store' ? 0 : 1)
  }
  return n
}

function exportar(p, { saida } = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  const out = path.resolve(saida || path.join(p.workdir, 'exportacoes', `neuro-biblioteca-${stamp}.tgz`))
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-bib-'))
  try {
    const json = path.join(tmp, 'biblioteca.json')
    const r = run(p, ['perfil', 'exportar', '--saida', json])
    if (r.code !== 0 || !exists(json)) throw new Error('o neuro-mv-edit não exportou a biblioteca: ' + r.out.slice(-300))
    const b = JSON.parse(fs.readFileSync(json, 'utf8'))
    const bank = path.join(p.neuroLib, 'audio_bank')
    if (exists(bank)) copyTree(bank, path.join(tmp, 'audio_bank'), true, { copiados: 0, pulados: 0 })
    const resumo = {
      perfis: Object.keys(b.perfis || {}), temas: Object.keys(b.temas || {}), estilos: Object.keys(b.estilos || {}),
      audio: countFiles(path.join(tmp, 'audio_bank')),
    }
    fs.writeFileSync(path.join(tmp, 'LEIA-ME.txt'),
      `Biblioteca do Neuro Harness, exportada em ${new Date().toLocaleString('pt-BR')}.\n\n` +
      `No outro computador:  neuro-harness biblioteca importar <este arquivo>\n` +
      `Ou na instalação:     curl -fsSL https://harness.neuros.my/install.sh | bash -s -- --biblioteca <este arquivo>\n\n` +
      `Perfis: ${resumo.perfis.join(', ') || '—'}\nTemas: ${resumo.temas.join(', ') || '—'}\nEstilos: ${resumo.estilos.join(', ') || '—'}\n` +
      `Áudios (trilhas e efeitos): ${resumo.audio}\n`)
    const t = spawnSync('tar', ['-czf', out, '-C', tmp, '.'], { encoding: 'utf8' })
    if (t.status !== 0) throw new Error('não consegui gerar o pacote: ' + (t.stderr || '').slice(-200))
    return { arquivo: out, tamanho: fs.statSync(out).size, ...resumo }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

function importar(p, arquivo, { sobrescrever = false } = {}) {
  const src = path.resolve(arquivo)
  if (!exists(src)) throw new Error(`arquivo não encontrado: ${src}`)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-bib-'))
  try {
    let json = src
    let bankSrc = null
    if (!/\.json$/i.test(src)) {
      const t = spawnSync('tar', ['-xzf', src, '-C', tmp], { encoding: 'utf8' })
      if (t.status !== 0) throw new Error('não consegui abrir o pacote: ' + (t.stderr || '').slice(-200))
      json = path.join(tmp, 'biblioteca.json')
      if (!exists(json)) throw new Error('o pacote não tem biblioteca.json (é uma exportação do Neuro Harness?)')
      if (exists(path.join(tmp, 'audio_bank'))) bankSrc = path.join(tmp, 'audio_bank')
    }
    const r = run(p, ['perfil', 'importar', json, ...(sobrescrever ? ['--sobrescrever'] : [])])
    const linhas = r.out.split('\n').map((l) => l.trim()).filter((l) => /^(✅|⏭️|❌)/.test(l))
    const audio = { copiados: 0, pulados: 0 }
    if (bankSrc) {
      const dst = path.join(p.neuroLib, 'audio_bank')
      fs.mkdirSync(dst, { recursive: true })
      copyTree(bankSrc, dst, sobrescrever, audio)
    }
    return { ok: r.code === 0, linhas, audio, erro: r.code === 0 ? null : r.out.slice(-300) }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

module.exports = { exportar, importar }
