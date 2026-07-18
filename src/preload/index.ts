import { contextBridge, ipcRenderer } from 'electron'

export interface EnsureResult {
  status: 'running' | 'started' | 'not-installed' | 'failed-to-start' | 'needs-model'
  baseUrl: string
  error?: string
}

const api = {
  ensureEngine: (engine: string, model?: string): Promise<EnsureResult> =>
    ipcRenderer.invoke('engine:ensure', engine, model),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  systemInfo: (): Promise<{ totalMemGB: number; arch: string; platform: string }> =>
    ipcRenderer.invoke('system-info')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
