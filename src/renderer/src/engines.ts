export type EngineId = 'ollama' | 'llamacpp' | 'vllm'

export interface EngineDef {
  label: string
  // Ollama manages a local model library (pull/delete/list). llama.cpp and
  // vLLM serve a single model chosen at launch instead.
  managedModels: boolean
  installHint: string
  installUrl: string
  modelPlaceholder?: string
  modelHint?: string
  suggestions?: string[]
}

export const ENGINES: Record<EngineId, EngineDef> = {
  ollama: {
    label: 'Ollama',
    managedModels: true,
    installHint: 'The bundled engine failed to launch. Installing Ollama separately also works — the app will find it.',
    installUrl: 'https://ollama.com/download'
  },
  llamacpp: {
    label: 'llama.cpp',
    managedModels: false,
    installHint: 'llama-server was not found. Install llama.cpp (e.g. `brew install llama.cpp`) and retry.',
    installUrl: 'https://github.com/ggml-org/llama.cpp',
    modelPlaceholder: 'HF GGUF repo or local .gguf path',
    modelHint:
      'A HuggingFace GGUF repo (downloaded and cached automatically) or a path to a local .gguf file.',
    suggestions: [
      'ggml-org/gemma-3-4b-it-GGUF',
      'bartowski/Llama-3.2-3B-Instruct-GGUF',
      'unsloth/Qwen3-4B-Instruct-2507-GGUF'
    ]
  },
  vllm: {
    label: 'vLLM',
    managedModels: false,
    installHint:
      'The vllm command was not found. Install it with `pip install vllm` and retry. Note: vLLM is built for Linux with NVIDIA GPUs; macOS support is limited.',
    installUrl: 'https://docs.vllm.ai',
    modelPlaceholder: 'HuggingFace model id',
    modelHint: 'A HuggingFace model id — vLLM downloads and caches it automatically.',
    suggestions: ['Qwen/Qwen2.5-1.5B-Instruct', 'Qwen/Qwen2.5-7B-Instruct', 'HuggingFaceTB/SmolLM2-1.7B-Instruct']
  }
}

export const ENGINE_IDS = Object.keys(ENGINES) as EngineId[]
