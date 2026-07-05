import { spawn, execFile } from 'child_process'
import { existsSync } from 'fs'

export const OLLAMA_URL = 'http://127.0.0.1:11434'

// Locations `ollama` ends up in on macOS/Linux; the packaged app doesn't
// inherit the user's shell PATH, so we can't rely on PATH lookup alone.
const KNOWN_PATHS = [
  '/usr/local/bin/ollama',
  '/opt/homebrew/bin/ollama',
  '/usr/bin/ollama',
  `${process.env.HOME}/.ollama/bin/ollama`
]

export type OllamaStatus = 'running' | 'started' | 'not-installed' | 'failed-to-start'

async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/version`, {
      signal: AbortSignal.timeout(1500)
    })
    return res.ok
  } catch {
    return false
  }
}

function findBinary(): string | null {
  for (const p of KNOWN_PATHS) {
    if (existsSync(p)) return p
  }
  return null
}

function binaryOnPath(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('ollama', ['--version'], (err) => resolve(err ? null : 'ollama'))
  })
}

export async function ensureOllama(): Promise<OllamaStatus> {
  if (await isServerUp()) return 'running'

  const bin = findBinary() ?? (await binaryOnPath())
  if (!bin) return 'not-installed'

  const child = spawn(bin, ['serve'], { detached: true, stdio: 'ignore' })
  child.unref()

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (await isServerUp()) return 'started'
  }
  return 'failed-to-start'
}
