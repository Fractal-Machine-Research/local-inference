# Local Inference

A desktop app for running AI models locally. Electron + React on the front, [Ollama](https://ollama.com) as the inference engine — all inference happens on your machine, nothing leaves it.

## How it works

- On launch, the app checks for an Ollama server at `localhost:11434`. If Ollama is installed but not running, the app starts `ollama serve` itself. If it isn't installed, you get a download link.
- The sidebar lists installed models, lets you pull new ones (with download progress) and delete old ones.
- Chat responses stream token-by-token from Ollama's `/api/chat` endpoint.

## Development

```sh
npm install
npm run dev        # launches Electron with hot reload
```

## Download & install

Grab the latest installer from [Releases](https://github.com/Fractal-Machine-Research/local-model-inference/releases) — `.dmg` for macOS, `.exe` for Windows, `.AppImage` for Linux.

> **macOS note:** the app is not code-signed, so on first launch macOS will say it "can't be opened" or is "damaged." Right-click the app → **Open** → **Open**, or run:
>
> ```sh
> xattr -cr "/Applications/Local Inference.app"
> ```

You'll also need [Ollama](https://ollama.com/download) installed — the app will prompt you if it's missing.

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
