import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemSnapshot: () => ipcRenderer.invoke('system:get-snapshot'),
  killProcess: (pid: number) => ipcRenderer.invoke('system:kill-process', pid),
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store-set', key, value),
});
