// Neuro Harness — app desktop (macOS Apple Silicon e Windows).
// Na abertura: instala ou atualiza a distribuição (Harness fixado, motor, perfil e plugins) num processo
// filho, sobe o Harness local e abre o painel numa janela nativa. Ao sair, para o Harness se foi o app
// que o subiu. Construído sobre o DeepSeek Harness (MIT, © DeepSeek).
const { app, BrowserWindow, shell, ipcMain, nativeTheme, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { fork, spawnSync } = require('child_process')

const IS_MAC = process.platform === 'darwin'
const LIB = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'vendor', 'lib')
  : fs.existsSync(path.join(__dirname, 'vendor', 'lib')) ? path.join(__dirname, 'vendor', 'lib') : path.join(__dirname, '..', '..', 'lib')
const PLUGINS = app.isPackaged ? path.join(process.resourcesPath, 'plugins') : path.join(__dirname, '..', '..', 'plugins')

// Apps abertos pelo Finder recebem um PATH mínimo: herda o do shell de login (Homebrew, nvm, etc.).
function adoptLoginPath() {
  if (process.platform === 'win32') return
  const shellBin = process.env.SHELL || '/bin/zsh'
  const r = spawnSync(shellBin, ['-ilc', 'printf "__PATH__%s" "$PATH"'], { encoding: 'utf8', timeout: 8000 })
  const m = /__PATH__(.*)$/s.exec(r.stdout || '')
  if (m && m[1].trim()) process.env.PATH = m[1].trim()
  for (const d of ['/opt/homebrew/bin', '/usr/local/bin']) if (!process.env.PATH.split(':').includes(d)) process.env.PATH += ':' + d
}

let H, p, splash, win, startedByUs = false, quitting = false, depsTimer = null

const INSTALL_SH = 'https://raw.githubusercontent.com/monrars1995/neuro-harness-install/main/install.sh'
const INSTALL_PS1 = 'https://raw.githubusercontent.com/monrars1995/neuro-harness-install/main/install.ps1'

/** Abre um terminal visível rodando o instalador público (dependências, login no GitHub e setup). */
function openInstallerTerminal() {
  if (IS_MAC) {
    const cmd = `curl -fsSL ${INSTALL_SH} | bash -s -- --sem-app --sem-abrir`
    spawnSync('osascript', ['-e', `tell application "Terminal" to do script "${cmd}"`, '-e', 'tell application "Terminal" to activate'])
  } else if (process.platform === 'win32') {
    const inner = `& ([scriptblock]::Create((irm ${INSTALL_PS1}))) -SemApp -SemAbrir`
    spawnSync('powershell', ['-NoProfile', '-Command', `Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command','${inner.replace(/'/g, "''")}'`])
  } else {
    spawnSync('sh', ['-c', `x-terminal-emulator -e bash -lc "curl -fsSL ${INSTALL_SH} | bash -s -- --sem-app --sem-abrir; exec bash" &`])
  }
}

function missingPrereqs() {
  adoptLoginPath()
  if (process.platform === 'win32') {
    // o instalador grava no PATH do usuário e da máquina: relê para enxergar o que acabou de ser instalado
    const m = spawnSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"], { encoding: 'utf8' })
    if (m.stdout && m.stdout.trim()) process.env.PATH = m.stdout.trim()
  }
  return H.checkPrereqs().filter((r) => !r.ok)
}

function send(channel, msg) { if (splash && !splash.isDestroyed()) splash.webContents.send(channel, msg) }

function runSetup() {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(LIB, 'cli.js'), ['setup'], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NEURO_HARNESS_PLUGINS: PLUGINS, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })
    let errText = ''
    const onLine = (buf) => String(buf).split(/\r?\n/).map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean).forEach((l) => send('status', l))
    child.stdout.on('data', onLine)
    child.stderr.on('data', (b) => { errText += b; onLine(b) })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(errText.replace(/\x1b\[[0-9;]*m/g, '').trim() || `setup saiu com código ${code}`))))
  })
}

function createSplash() {
  splash = new BrowserWindow({
    width: 560, height: 360, frame: false, resizable: false, show: true, center: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121319' : '#F6F7FB',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  })
  splash.loadFile(path.join(__dirname, 'splash.html'))
}

function createMain(url) {
  win = new BrowserWindow({
    width: 1360, height: 900, minWidth: 960, minHeight: 640, show: false, title: 'Neuro Harness',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#151517' : '#FFFFFF',
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'default',
    trafficLightPosition: IS_MAC ? { x: 14, y: 14 } : undefined,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  // Links locais (Studio do Remotion, prévias) abrem no app; o resto, no navegador padrão.
  const local = (u) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u)
  win.webContents.setWindowOpenHandler(({ url: u }) => { if (local(u)) return { action: 'allow' }; shell.openExternal(u); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, u) => { if (!local(u)) { e.preventDefault(); shell.openExternal(u) } })
  win.once('ready-to-show', () => { win.show(); if (splash && !splash.isDestroyed()) splash.close() })
  win.webContents.on('did-finish-load', () => console.log(`[neuro-harness] painel carregado: ${win.webContents.getTitle()}`))
  win.webContents.on('did-fail-load', (_e, code, desc) => console.error(`[neuro-harness] falha ao carregar o painel: ${code} ${desc}`))
  win.loadURL(url)
}

async function boot() {
  try {
    send('status', 'Conferindo o que o Neuro Harness precisa...')
    const missing = missingPrereqs()
    if (missing.length) { send('deps', missing.map((m) => m.label)); return }
    send('status', 'Preparando o Neuro Harness...')
    await runSetup()
    send('status', 'Subindo o Harness...')
    const r = await H.start(p, { log: (m) => send('status', m) })
    startedByUs = !r.reused
    createMain(r.url)
  } catch (e) {
    send('error', `${e.message}\n\nConfira com: neuro-harness doctor`)
  }
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.setName('Neuro Harness')
  app.on('second-instance', () => { const w = win || splash; if (w) { if (w.isMinimized()) w.restore(); w.focus() } })
  app.whenReady().then(() => {
    adoptLoginPath()
    H = require(path.join(LIB, 'harness.js'))
    p = H.paths()
    if (IS_MAC) Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
    ]))
    createSplash()
    splash.webContents.once('did-finish-load', boot)
  })
  ipcMain.on('retry', boot)
  ipcMain.on('install-deps', () => {
    openInstallerTerminal()
    send('status', 'Siga a janela do Terminal (senha do computador e login no GitHub). Eu continuo sozinho quando terminar.')
    clearInterval(depsTimer)
    depsTimer = setInterval(() => {
      const missing = missingPrereqs()
      if (missing.length) { send('waiting', missing.map((m) => m.label)); return }
      clearInterval(depsTimer)
      boot()
    }, 5000)
  })
  ipcMain.on('quit', () => app.quit())
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (e) => {
    if (!startedByUs || quitting || !H) return
    e.preventDefault()
    quitting = true
    H.stop(p).finally(() => app.quit())
  })
}
