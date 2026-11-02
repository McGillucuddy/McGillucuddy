'use strict';
// The desktop build: the browser game (copied into game/ by tools/desktop.sh) in its own window, for Steam and itch.io.
// Starts fullscreen; F11 or Alt+Enter toggles it. The game's own Exit closes the window, which quits.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required'); // the music and the engine can start without a click

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, fullscreen: true,
    backgroundColor: '#0b0b0d', title: 'Death Row Derby', icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'game', 'index.html'));
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.key === 'Enter' && input.alt))) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; }); // links (feedback) open in the browser
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
