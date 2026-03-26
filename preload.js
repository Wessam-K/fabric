const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of valid IPC channels
const VALID_SEND_CHANNELS = [
  'app:minimize',
  'app:maximize',
  'app:close',
  'app:restart-backend',
  'log:write',
];

const VALID_RECEIVE_CHANNELS = [
  'app:version',
  'app:update-status',
  'backend:status',
  'backend:log',
];

const VALID_INVOKE_CHANNELS = [
  'app:get-version',
  'app:get-paths',
  'app:is-packaged',
  'dialog:open-file',
  'dialog:save-file',
  'dialog:message-box',
  'export:save-to-disk',
  'db:backup-now',
  'db:get-path',
  'db:get-size',
  'system:get-info',
  'cache:get',
  'cache:set',
  'cache:clear',
];

contextBridge.exposeInMainWorld('electronAPI', {
  // App controls
  minimize: () => ipcRenderer.send('app:minimize'),
  maximize: () => ipcRenderer.send('app:maximize'),
  close: () => ipcRenderer.send('app:close'),
  restartBackend: () => ipcRenderer.send('app:restart-backend'),

  // Invoke (request-response)
  invoke: (channel, ...args) => {
    if (VALID_INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Invalid invoke channel: ${channel}`));
  },

  // One-way send
  send: (channel, data) => {
    if (VALID_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Listen for messages from main
  on: (channel, callback) => {
    if (VALID_RECEIVE_CHANNELS.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    return () => {};
  },

  // Listen once
  once: (channel, callback) => {
    if (VALID_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    }
  },

  // Platform info (safe static values)
  platform: process.platform,
  arch: process.arch,
});
