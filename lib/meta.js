'use strict'
/**
 * Muse Code (Meta) no Neuro Harness.
 *
 * A assinatura do Muse Code só vale no cliente oficial: a Meta recusa pedidos de outros apps
 * com `client_attestation_denied` ("Muse Code subscriptions cover requests from the Muse Code
 * client only"). Por isso o Harness não usa a assinatura como provedor de modelos; ele delega
 * tarefas ao CLI `muse` pela skill `muse-code`. Os modelos Muse direto no Harness só funcionam
 * com uma chave de API paga (META_API_KEY, em dev.meta.ai).
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

function museInfo() {
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['muse'], { encoding: 'utf8' })
  const bin = which.status === 0 ? which.stdout.split('\n')[0].trim() : null
  const version = bin ? (spawnSync(bin, ['--version'], { encoding: 'utf8' }).stdout || '').trim() : null
  const authFile = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'muse', 'auth.json')
  let subscription = false, email = null
  try {
    const m = JSON.parse(fs.readFileSync(authFile, 'utf8')).providers?.meta || {}
    subscription = m.mechanism === 'oauth' && m.subs_active === true
    email = m.user_email || null
  } catch {}
  return { bin, version, subscription, email }
}

module.exports = { museInfo }
