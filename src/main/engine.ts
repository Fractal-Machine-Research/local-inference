import { spawn, execFile, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export type EngineId = 'ollama' | 'llamacpp' | 'vllm'

export type EngineStatus =
  | 'running'
  | 'started'
  | 'not-installed'
  | 'failed-to-start'
  | 'needs-model'

export interface EnsureResult {
  status: EngineStatus
  baseUrl: string
  error?: string
}

const OLLAMA_PORT = 11434
// Dedicated ports for servers we launch, so we never clobber a user's own
// llama-server (default 8080) or vllm (default 8000). Those defaults are
// still probed first and adopted if something healthy is already there.
const ENGINE_PORTS: Record<Exclude<EngineId, 'ollama'>, { external: number; spawn: number }> = {
  llamacpp: { external: 8080, spawn: 11464 },
  vllm: { external: 8000, spawn: 11465 }
}

// Locations binaries end up in on macOS/Linux; the packaged app doesn't
// inherit the user's shell PATH, so we can't rely on PATH lookup alone.
const KNOWN_PATHS: Record<EngineId, string[]> = {
  ollama: [
    '/usr/local/bin/ollama',
    '/opt/homebrew/bin/ollama',
    '/usr/bin/ollama',
    `${process.env.HOME}/.ollama/bin/ollama`
  ],
  llamacpp: [
    '/opt/homebrew/bin/llama-server',
    '/usr/local/bin/llama-server',
    '/usr/bin/llama-server'
  ],
  vllm: [
    `${process.env.HOME}/.local/bin/vllm`,
    '/opt/homebrew/bin/vllm',
    '/usr/local/bin/vllm',
    '/usr/bin/vllm'
  ]
}

const HEALTH_PATH: Record<EngineId, string> = {
  ollama: '/api/version',
  llamacpp: '/health',
  vllm: '/health'
}

interface Spawned {
  engine: EngineId
  proc: ChildProcess
  model?: string
  port: number
  stderrTail: string
}

let spawned: Spawned | null = null

function url(port: number): string {
  return `http://127.0.0.1:${port}`
}

async function isUp(engine: EngineId, port: number): Promise<boolean> {
  try {
    const res = await fetch(`${url(port)}${HEALTH_PATH[engine]}`, {
      signal: AbortSignal.timeout(1500)
    })
    return res.ok
  } catch {
    return false
  }
}

// The ollama binary we ship inside the app (resources/ollama/<platform>/ in
// dev, process.resourcesPath/ollama/ when packaged). Not present on Linux.
function bundledOllama(): string | null {
  const exe = process.platform === 'win32' ? 'ollama.exe' : 'ollama'
  const p = app.isPackaged
    ? join(process.resourcesPath, 'ollama', exe)
    : join(app.getAppPath(), 'resources', 'ollama', process.platform, exe)
  return existsSync(p) ? p : null
}

function knownBinary(engine: EngineId): string | null {
  for (const p of KNOWN_PATHS[engine]) {
    if (existsSync(p)) return p
  }
  return null
}

function binaryOnPath(name: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(name, ['--version'], (err) => resolve(err ? null : name))
  })
}

function launch(engine: EngineId, bin: string, args: string[], port: number, model?: string): void {
  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  const entry: Spawned = { engine, proc, model, port, stderrTail: '' }
  proc.stderr?.on('data', (chunk: Buffer) => {
    entry.stderrTail = (entry.stderrTail + chunk.toString()).slice(-2000)
  })
  proc.on('exit', () => {
    if (spawned?.proc === proc) spawned = null
  })
  spawned = entry
}

// Polls health until up, the process dies, or the timeout passes. Model
// downloads happen during llama-server/vllm startup, so timeouts are long.
async function waitForUp(engine: EngineId, port: number, timeoutMs: number): Promise<boolean> {
  const entry = spawned
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (entry && (entry.proc.exitCode !== null || spawned !== entry)) return false
    if (await isUp(engine, port)) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

// Only stops a server this app started — never a user's own.
export function stopEngine(): void {
  spawned?.proc.kill()
  spawned = null
}

async function ensureOllama(): Promise<EnsureResult> {
  const baseUrl = url(OLLAMA_PORT)
  if (await isUp('ollama', OLLAMA_PORT)) return { status: 'running', baseUrl }

  const bin = bundledOllama() ?? knownBinary('ollama') ?? (await binaryOnPath('ollama'))
  if (!bin) return { status: 'not-installed', baseUrl }

  launch('ollama', bin, ['serve'], OLLAMA_PORT)
  if (await waitForUp('ollama', OLLAMA_PORT, 10_000)) return { status: 'started', baseUrl }
  return { status: 'failed-to-start', baseUrl, error: spawned?.stderrTail || undefined }
}

async function ensureOpenAiEngine(
  engine: 'llamacpp' | 'vllm',
  model?: string
): Promise<EnsureResult> {
  const ports = ENGINE_PORTS[engine]

  // A server we launched earlier, serving the requested model (or any model
  // if none was requested) — just wait for it to be healthy.
  if (spawned?.engine === engine && (!model || spawned.model === model)) {
    if (await waitForUp(engine, ports.spawn, 5_000)) {
      return { status: 'running', baseUrl: url(ports.spawn) }
    }
  }

  // A server the user runs themselves on the engine's default port — adopt
  // it as-is (we can't change its model, so `model` is ignored here).
  if (spawned?.engine !== engine && (await isUp(engine, ports.external))) {
    return { status: 'running', baseUrl: url(ports.external) }
  }

  const binName = engine === 'llamacpp' ? 'llama-server' : 'vllm'
  const bin = knownBinary(engine) ?? (await binaryOnPath(binName))
  const baseUrl = url(ports.spawn)
  if (!bin) return { status: 'not-installed', baseUrl }
  if (!model) return { status: 'needs-model', baseUrl }

  if (spawned) stopEngine()

  const args =
    engine === 'llamacpp'
      ? [
          // Local .gguf path vs HuggingFace repo (llama-server downloads and
          // caches -hf models itself).
          ...(model.endsWith('.gguf') ? ['-m', model] : ['-hf', model]),
          '--host',
          '127.0.0.1',
          '--port',
          String(ports.spawn),
          '--jinja'
        ]
      : ['serve', model, '--host', '127.0.0.1', '--port', String(ports.spawn)]

  launch(engine, bin, args, ports.spawn, model)
  // First launch can download many GB of weights before the server answers.
  if (await waitForUp(engine, ports.spawn, 15 * 60_000)) return { status: 'started', baseUrl }
  const error = spawned?.stderrTail || undefined
  stopEngine()
  return { status: 'failed-to-start', baseUrl, error }
}

export async function ensureEngine(engine: EngineId, model?: string): Promise<EnsureResult> {
  // Switching engines: free the memory held by the previous server we own.
  if (spawned && spawned.engine !== engine) stopEngine()

  if (engine === 'ollama') return ensureOllama()
  return ensureOpenAiEngine(engine, model)
}
