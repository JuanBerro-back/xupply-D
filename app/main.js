const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = Number(process.env.XUPLY_PORT || 4420);
const URL = `http://127.0.0.1:${PORT}`;
const SERVER_RUNNER = path.join(__dirname, 'server', 'dist', 'server.js');
const SERVER_CWD = path.join(__dirname, 'server');
const BUNDLED_NODE = path.join(__dirname, '..', 'node', 'node.exe');

let serverProc = null;

function nodeBin() {
  return fs.existsSync(BUNDLED_NODE) ? BUNDLED_NODE : 'node';
}

function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(`${URL}/health`, (res) => {
          res.resume();
          res.destroy();
          if (res.statusCode === 200) return resolve();
          retry();
        })
        .on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Wait timeout'));
      setTimeout(tick, 400);
    };
    tick();
  });
}

function startServer() {
  serverProc = spawn(nodeBin(), [SERVER_RUNNER], {
    cwd: SERVER_CWD,
    env: { ...process.env, PORT: String(PORT) },
    windowsHide: true,
  });
  serverProc.stdout.on('data', (d) => console.log('[xupply-server]', String(d).trim()));
  serverProc.stderr.on('data', (d) => console.error('[xupply-server]', String(d).trim()));
  serverProc.on('exit', (code) => {
    if (code && code !== 0) {
      dialog.showErrorBox(
        'Xupply',
        'El servidor interno de Xupply se detuvo inesperadamente.\n\nAsegurate de que PostgreSQL este corriendo con la base "xupply" (usuario juan_berroteran) y vuelve a abrir la aplicacion.'
      );
    }
  });
}

function createWindow() {
  const iconFile = path.join(__dirname, 'web', 'public', 'icon-512.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    title: 'Xupply',
    icon: fs.existsSync(iconFile) ? iconFile : undefined,
    backgroundColor: '#0284c7',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(URL);
}

app.on('window-all-closed', () => app.quit());
app.on('quit', () => {
  if (serverProc) {
    try {
      serverProc.kill();
    } catch {
      /* noop */
    }
  }
});

app.whenReady().then(async () => {
  startServer();
  try {
    await waitForHealth();
    createWindow();
  } catch (e) {
    dialog.showErrorBox('Xupply', `No se pudo iniciar la aplicacion:\n${e.message}`);
    app.exit(1);
  }
});