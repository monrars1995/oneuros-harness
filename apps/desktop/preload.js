// Ponte mínima para a tela de abertura: recebe o andamento da instalação e pede nova tentativa.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('neuro', {
  onStatus: (fn) => ipcRenderer.on('status', (_e, msg) => fn(msg)),
  onError: (fn) => ipcRenderer.on('error', (_e, msg) => fn(msg)),
  onDeps: (fn) => ipcRenderer.on('deps', (_e, list) => fn(list)),
  onWaiting: (fn) => ipcRenderer.on('waiting', (_e, list) => fn(list)),
  installDeps: () => ipcRenderer.send('install-deps'),
  retry: () => ipcRenderer.send('retry'),
  quit: () => ipcRenderer.send('quit'),
})
