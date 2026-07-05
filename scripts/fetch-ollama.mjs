// Downloads the Ollama server binary (MIT licensed) for the current platform
// into resources/ollama/<platform>/ so electron-builder can bundle it.
// Linux has no compact standalone build — the app falls back to a system
// install there.
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const URLS = {
  darwin: 'https://github.com/ollama/ollama/releases/latest/download/ollama-darwin.tgz',
  win32: 'https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip'
}

const plat = process.platform
const dest = path.join(import.meta.dirname, '..', 'resources', 'ollama', plat)
const exe = plat === 'win32' ? 'ollama.exe' : 'ollama'

if (!URLS[plat]) {
  console.log(`no standalone ollama bundle for ${plat} — app will use a system install`)
  process.exit(0)
}
if (fs.existsSync(path.join(dest, exe))) {
  console.log(`ollama already fetched: ${path.join(dest, exe)}`)
  process.exit(0)
}

fs.mkdirSync(dest, { recursive: true })
const archive = path.join(dest, plat === 'win32' ? 'ollama.zip' : 'ollama.tgz')

console.log('downloading', URLS[plat])
const res = await fetch(URLS[plat], { redirect: 'follow' })
if (!res.ok) throw new Error(`download failed: ${res.status}`)
fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()))

execSync(`tar -xf "${archive}" -C "${dest}"`)
fs.rmSync(archive)
if (plat !== 'win32') fs.chmodSync(path.join(dest, exe), 0o755)
console.log('bundled ollama at', path.join(dest, exe))
