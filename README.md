# Local Inference

A desktop app for running AI models locally — download, open, pick a model, chat. Electron + React on the front, a bundled [Ollama](https://ollama.com) engine (MIT licensed) inside — all inference happens on your machine, nothing leaves it.

## How it works

- The Ollama server binary ships **inside the app** (fetched at build time by `scripts/fetch-ollama.mjs`, bundled via electron-builder `extraResources`). On launch the app starts it automatically; if you already run your own Ollama, the app uses that instead and shares its models. On Linux (no standalone Ollama build) it falls back to a system install.
- First run shows a guided model picker: curated models with plain-English descriptions and RAM-aware fit badges ("Runs great" / "Will be slow" / "Won't fit") computed from your machine's memory, with one-click downloads.
- Chats render markdown, persist across restarts, and show tokens/sec after each reply. Responses stream token-by-token from Ollama's `/api/chat` endpoint.

## Development

```sh
npm install
npm run fetch-ollama   # one-time: download the engine binary to resources/
npm run dev            # launches Electron with hot reload
```

## Download & install

Grab the latest installer from [Releases](https://github.com/Fractal-Machine-Research/local-model-inference/releases) — `.dmg` for macOS, `.exe` for Windows, `.AppImage` for Linux.

> **macOS note:** the app is not code-signed, so on first launch macOS will say it "can't be opened" or is "damaged." Right-click the app → **Open** → **Open**, or run:
>
> ```sh
> xattr -cr "/Applications/Local Inference.app"
> ```

No other installs needed — the inference engine is bundled. (Linux only: install [Ollama](https://ollama.com/download) separately.)

## Releasing a new version

Releases are automated via GitHub Actions (`.github/workflows/release.yml`). Bump the version and push a tag:

```sh
npm version patch          # bumps package.json + creates the git tag
git push && git push --tags
```

CI builds installers for macOS (arm64 + Intel), Windows, and Linux and attaches them to a GitHub Release. Note: electron-builder creates the release as a **draft** — review it on GitHub and click Publish.

## Packaging locally

```sh
npm run dist       # builds a .dmg into release/
```

## Model suggestions (≤30B)

| Model | Pull command | RAM needed (4-bit) |
| --- | --- | --- |
| Qwen3 30B (MoE, fast) | `ollama pull qwen3:30b` | ~20 GB |
| Gemma 3 27B | `ollama pull gemma3:27b` | ~18 GB |
| Llama 3.1 8B | `ollama pull llama3.1:8b` | ~6 GB |
| Qwen3 4B (light) | `ollama pull qwen3:4b` | ~4 GB |

## Project layout

- `src/main/` — Electron main process; window setup and Ollama detection/launch (`ollama.ts`)
- `src/preload/` — context bridge exposing `window.api` to the renderer
- `src/renderer/` — React UI; `ollama.ts` is the streaming API client, `App.tsx` the chat + model manager
