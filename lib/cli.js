#!/usr/bin/env node
'use strict'
/**
 * neuro-harness — CLI da distribuição Neuro Harness (construída sobre o DeepSeek Harness).
 *
 *   neuro-harness setup [--link]       instala/atualiza tudo (Harness fixado, motor, perfil e plugins)
 *   neuro-harness start | stop | restart | status | url | open
 *   neuro-harness doctor               confere o ambiente
 *   neuro-harness engine [versão]      instala/troca o motor neuro-mv-edit das sessões
 *   neuro-harness credenciais [--dry-run] [--sobrescrever]   importa chaves do Hermes e do OpenCode
 *   neuro-harness run "<tarefa>" [--modelo provedor/modelo]  tarefa sem interface
 *   neuro-harness entrar [--chave nh_…] | sair | conta   acesso pela conta Neuro (sem GitHub)
 *   neuro-harness version
 */
const path = require('path')
const { spawnSync } = require('child_process')
const H = require('./harness.js')
const { importCredentials } = require('./credentials.js')
const Meta = require('./meta.js')

const ROOT = path.resolve(__dirname, '..')
// O app desktop empacota os plugins fora do asar e informa a pasta por NEURO_HARNESS_PLUGINS.
const PLUGINS = process.env.NEURO_HARNESS_PLUGINS || path.join(ROOT, 'plugins')
const VERSION = require('../package.json').version
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[90m', b: '\x1b[1m', x: '\x1b[0m' }
const log = (s) => console.log(`${C.d}${s}${C.x}`)

const accessHint = (u) => {
  const base = u ? u.split('?')[0] : 'http://127.0.0.1:3082/'
  return `${C.d}No navegador, abra este endereço (com o token) uma vez: o navegador guarda um acesso válido por 30 dias,\n` +
    `mesmo depois de reiniciar, e aí ${base} funciona direto. Ou rode: neuro-harness open${C.x}`
}

function help() {
  console.log(`${C.b}Neuro Harness ${VERSION}${C.x} ${C.d}(sobre o DeepSeek Harness ${H.DSH_VERSION})${C.x}

  ${C.g}setup${C.x} [--link]          instala ou atualiza tudo: Harness fixado, motor neuro-mv-edit, perfil e plugins
                           (--link liga os plugins direto deste clone, para desenvolvimento)
  ${C.g}start${C.x} · ${C.g}stop${C.x} · ${C.g}restart${C.x}    sobe ou para o Harness em segundo plano
  ${C.g}status${C.x} · ${C.g}url${C.x} · ${C.g}open${C.x}        estado, endereço local, abrir no navegador
  ${C.g}doctor${C.x}                  confere ferramentas, Harness, motor, perfil, plugins e chaves
  ${C.g}deps${C.x}                    confere os pré-requisitos do sistema e mostra como instalar o que falta
  ${C.g}engine${C.x} [versão]         instala ou troca o motor neuro-mv-edit (padrão ${H.ENGINE_VERSION})
  ${C.g}credenciais${C.x} [--dry-run] [--sobrescrever]
                           importa chaves de API do Hermes e do OpenCode para o cofre do Harness
  ${C.g}run${C.x} "<tarefa>" [--modelo provedor/modelo]
                           uma tarefa sem interface, com o mesmo ambiente das sessões
  ${C.g}entrar${C.x} [--chave nh_…]   liga este computador à sua conta Neuro (instala e atualiza sem GitHub)
  ${C.g}sair${C.x} · ${C.g}conta${C.x}             desliga o computador da conta · mostra o acesso deste computador
  ${C.g}meta${C.x}                    mostra o Muse Code (Meta): CLI, assinatura e a skill que delega tarefas a ele
  ${C.g}claude${C.x} [instalar|status|remover] [--dry-run]
                           os especialistas no Claude Code: marketplace local neuro-harness com os plugins
                           neuro-harness, neuro-mv-edit e neuro-ads-manager (versões fixadas, sem GitHub)
  ${C.g}version${C.x}

Variáveis: NEURO_HARNESS_HOME (padrão ~/.neuro-harness), NEURO_HARNESS_PROFILE (neuro),
NEURO_HARNESS_PORT (3082), NEURO_WORKDIR (~/Neuro), NEURO_HOME (~/.neuro-mv-edit).`)
}

function flag(args, name) { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v }

async function main() {
  const args = process.argv.slice(2)
  const cmd = args.shift() || 'help'
  const p = H.paths()
  switch (cmd) {
    case 'setup': {
      const link = args.includes('--link')
      const steps = H.setup(p, { pluginsSource: PLUGINS, link, log })
      console.log(`${C.g}✓${C.x} DeepSeek Harness ${steps.runtime.version}  ${C.g}✓${C.x} motor neuro-mv-edit v${steps.engine.version}  ${C.g}✓${C.x} perfil ${p.profile}`)
      for (const r of steps.plugins) console.log(`${r.ok ? C.g + '✓' : C.r + '✗'}${C.x} plugin ${r.name}${r.ok ? '' : ': ' + r.msg}`)
      for (const r of steps.addons) console.log(`${r.ok ? C.g + '✓' : C.r + '✗'}${C.x} ${r.name}${r.version ? ' v' + r.version : ''}${r.ok ? '' : ': ' + r.msg}`)
      for (const r of steps.packs || []) console.log(`${r.ok ? C.g + '✓' : C.r + '✗'}${C.x} ${r.msg}`)
      for (const r of steps.profilePlugins) if (r.name) console.log(`${r.ok ? C.g + '✓' : C.r + '✗'}${C.x} no perfil: ${r.name}`); else if (!r.ok) console.log(`${C.r}✗${C.x} ${r.msg}`)
      console.log(`${C.d}Pronto. Suba com: neuro-harness start${C.x}`)
      break
    }
    case 'start': {
      const r = await H.start(p, { log })
      console.log(`${C.g}Neuro Harness ${r.reused ? 'já estava ' : ''}no ar:${C.x} ${r.url}`)
      console.log(accessHint(r.url))
      break
    }
    case 'stop': {
      const r = await H.stop(p)
      console.log(r.stopped ? 'parado' : 'não estava rodando')
      break
    }
    case 'restart': {
      await H.stop(p)
      const r = await H.start(p, { log })
      console.log(`${C.g}Neuro Harness no ar:${C.x} ${r.url}`)
      console.log(accessHint(r.url))
      break
    }
    case 'status': {
      const pid = H.running(p)
      console.log(pid ? `rodando (pid ${pid}): ${H.url(p) || 'sem URL ainda'}` : 'parado')
      process.exitCode = pid ? 0 : 1
      break
    }
    case 'url': { const u = H.url(p); if (u) console.log(u); else process.exitCode = 1; break }
    case 'open': {
      const u = H.running(p) ? H.url(p) : (await H.start(p, { log })).url
      const opener = process.platform === 'darwin' ? ['open', [u]] : H.IS_WIN ? ['cmd', ['/c', 'start', '', u]] : ['xdg-open', [u]]
      spawnSync(opener[0], opener[1], { stdio: 'ignore' })
      console.log(u)
      break
    }
    case 'doctor': {
      console.log(`${C.b}Neuro Harness — conferência${C.x}`)
      const rows = H.doctor(p)
      if (H.which('claude')) {
        const st = require('./claude.js').status(p)
        const falta = st.rows.filter((r) => !r.instalado || r.atualizar).map((r) => r.name)
        rows.push({ ok: true, msg: falta.length ? `Claude Code: ${falta.join(', ')} ${st.market ? 'desatualizado(s) ou ausente(s)' : 'não instalado(s)'} (opcional: neuro-harness claude instalar)` : 'Claude Code: especialistas instalados e em dia' })
      }
      for (const r of rows) console.log(`  ${r.ok ? '✅' : '❌'} ${r.msg}`)
      process.exitCode = rows.every((r) => r.ok) ? 0 : 1
      break
    }
    case 'deps': {
      console.log(`${C.b}Pré-requisitos do sistema${C.x}`)
      const rows = H.checkPrereqs()
      for (const r of rows) console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}${r.found && r.found !== 'ok' ? ' (' + r.found + ')' : ''}`)
      if (!rows.every((r) => r.ok)) {
        console.log(`\nPara instalar o que falta, rode o instalador:`)
        console.log(H.IS_WIN ? '  irm https://harness.neuros.my/install.ps1 | iex'
          : '  curl -fsSL https://harness.neuros.my/install.sh | bash')
      }
      process.exitCode = rows.every((r) => r.ok) ? 0 : 1
      break
    }
    case 'engine': {
      const r = H.ensureEngine(p, args[0] || H.ENGINE_VERSION, log)
      console.log(`${C.g}✓${C.x} motor neuro-mv-edit v${r.version}`)
      break
    }
    case 'credenciais': case 'credentials': {
      console.log(`Cofre: ${path.join(p.dshHome, '.credentials.yaml')}`)
      const r = await importCredentials(p.dshHome, { dryRun: args.includes('--dry-run'), overwrite: args.includes('--sobrescrever') })
      if (r.written.length) console.log(`${C.g}✓ gravadas:${C.x} ${r.written.join(', ')}`)
      else if (r.wouldWrite && r.wouldWrite.length) console.log(`(simulação) gravaria: ${r.wouldWrite.join(', ')}`)
      else console.log('Nada a gravar.')
      break
    }
    case 'run': {
      const model = flag(args, '--modelo') || flag(args, '--model')
      process.exitCode = H.runTask(p, args.join(' '), { model }) ?? 1
      break
    }
    case 'entrar': case 'login': {
      const chave = flag(args, '--chave')
      if (chave) { H.access.saveKey(p, chave.trim()); console.log(`${C.g}✓${C.x} chave salva (${H.access.mask(chave)})`) }
      else {
        const k = await H.access.deviceLogin(p, { log: (s) => console.log(s), open: !args.includes('--sem-navegador') })
        console.log(`${C.g}✓${C.x} computador conectado à sua conta (${H.access.mask(k)})`)
      }
      const c = await H.access.checkKey(p)
      if (!c.ok) { console.log(`${C.y}!${C.x} ${c.msg}`); process.exitCode = 1 }
      else console.log(`${C.d}A instalação e as atualizações agora vêm de ${H.access.SITE}, sem GitHub. Rode: neuro-harness setup${C.x}`)
      break
    }
    case 'sair': case 'logout': {
      console.log(H.access.clearKey(p) ? `${C.g}✓${C.x} este computador saiu da conta (a chave foi apagada daqui; revogue em ${H.access.SITE}/conta se quiser)` : 'Este computador não estava conectado.')
      break
    }
    case 'conta': {
      const k = H.access.readKey(p)
      if (!k) { console.log(`Sem conta conectada. Rode: neuro-harness entrar`); process.exitCode = 1; break }
      const c = await H.access.checkKey(p)
      console.log(c.ok ? `${C.g}✓${C.x} conectado como ${c.email || 'conta Neuro'} · chave ${H.access.mask(k)}${c.maquina ? ' · ' + c.maquina : ''}` : `${C.r}✗${C.x} ${c.msg} · chave ${H.access.mask(k)}`)
      if (!c.ok) process.exitCode = 1
      break
    }
    case 'meta': case 'muse': {
      const m = Meta.museInfo()
      const skill = require('fs').existsSync(require('path').join(p.dshHome, 'skills', 'muse-code', 'SKILL.md'))
      console.log(`${m.bin ? C.g + '✓' : C.y + '!'}${C.x} CLI do Muse Code: ${m.bin ? m.version : 'não encontrado (instale o Muse Code da Meta)'}`)
      console.log(`${m.subscription ? C.g + '✓' : C.y + '!'}${C.x} assinatura: ${m.subscription ? 'ativa (' + m.email + ')' : 'não logada — rode: muse login'}`)
      console.log(`${skill ? C.g + '✓' : C.y + '!'}${C.x} skill muse-code no Harness: ${skill ? 'instalada' : 'não instalada — rode: neuro-harness setup'}`)
      console.log(`${C.d}Peça no painel: "use o Muse Code para …". O agente delega ao muse exec, e a tarefa roda pela assinatura.\nA Meta só aceita a assinatura no cliente oficial; os modelos Muse direto no Harness precisam de chave de API paga (META_API_KEY).${C.x}`)
      break
    }
    case 'claude': case 'claude-code': {
      const CC = require('./claude.js')
      const sub = args.shift() || 'status'
      if (sub === 'instalar' || sub === 'install' || sub === 'atualizar' || sub === 'update') {
        const dry = args.includes('--dry-run')
        console.log(`${C.b}Neuro Harness no Claude Code${C.x}${dry ? ' (simulação)' : ''}`)
        const r = CC.install(p, { log, dryRun: dry })
        if (r.plan) for (const l of r.plan) console.log(`  · ${l}`)
        for (const st of r.steps || []) console.log(`  ${st.ok ? C.g + '✓' : C.r + '✗'}${C.x} ${st.name}${st.version ? ' v' + st.version : ''}${st.msg ? C.d + ' — ' + st.msg + C.x : ''}`)
        if (!r.ok && r.msg) console.log(`${C.r}✗${C.x} ${r.msg}`)
        if (r.ok && !dry) console.log(`${C.d}Pronto. Abra uma sessão nova do Claude Code (ou rode /reload-plugins) e comece com /neuro-harness:comecar${C.x}`)
        process.exitCode = r.ok ? 0 : 1
      } else if (sub === 'status') {
        const st = CC.status(p)
        if (!st.claude) { console.log(`${C.y}!${C.x} Claude Code não encontrado (comando claude)`); process.exitCode = 1; break }
        console.log(`${C.b}Neuro Harness no Claude Code${C.x} ${C.d}marketplace: ${st.market || 'não registrado (neuro-harness claude instalar)'}${C.x}`)
        for (const r of st.rows) {
          const mark = r.instalado ? (r.atualizar ? C.y + '↑' : C.g + '✓') : C.r + '✗'
          console.log(`  ${mark}${C.x} ${r.name.padEnd(18)} ${r.instalado ? 'v' + r.instalado : 'não instalado'}${r.atualizar ? ` → v${r.disponivel} (neuro-harness claude instalar)` : ''}${r.instalado && !r.ativo ? ' (desativado)' : ''}${r.antigo ? C.d + ` · versão antiga v${r.antigo} pelo marketplace ${r.name}` + C.x : ''}`)
        }
        process.exitCode = st.rows.every((r) => r.instalado && !r.atualizar) ? 0 : 1
      } else if (sub === 'remover' || sub === 'uninstall' || sub === 'remove') {
        const r = CC.remove()
        for (const st of r.steps) console.log(`  ${st.ok ? C.g + '✓' : C.r + '✗'}${C.x} ${st.name}${C.d} — ${st.msg}${C.x}`)
        if (!r.steps.length) console.log(`${C.d}Nada do Neuro Harness instalado no Claude Code.${C.x}`)
      } else {
        console.log('uso: neuro-harness claude [instalar|status|remover] [--dry-run]')
        process.exitCode = 1
      }
      break
    }
    case 'version': case '--version': case '-v': console.log(VERSION); break
    case 'help': case '--help': case '-h': help(); break
    default: console.log(`${C.r}Comando desconhecido: ${cmd}${C.x}`); help(); process.exitCode = 2
  }
}

main().catch((e) => { console.error(`${C.r}✗ ${e.message}${C.x}`); process.exit(1) })
