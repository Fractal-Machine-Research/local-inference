import { contextBridge, ipcRenderer } from 'electron'

const api = {
  ensureOllama: (): Promise<string> => ipcRenderer.invoke('ollama:ensure'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  systemInfo: (): Promise<{ totalMemGB: number; arch: string; platform: string }> =>
    ipcRenderer.invoke('system-info')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
