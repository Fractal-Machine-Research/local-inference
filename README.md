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

## Packaging

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
