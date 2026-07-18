import type { UiMessage } from './ollama'
import { ENGINES, type EngineId } from './engines'

export interface Conversation {
  id: string
  title: string
  model: string
  messages: UiMessage[]
  updatedAt: number
}

const KEY = 'conversations-v1'

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as Conversation[]
  } catch {
    return []
  }
}

const ENGINE_KEY = 'engine-v1'
const ENGINE_MODELS_KEY = 'engine-models-v1'

export function loadEngine(): EngineId {
  const raw = localStorage.getItem(ENGINE_KEY)
  return raw && raw in ENGINES ? (raw as EngineId) : 'ollama'
}

export function saveEngine(engine: EngineId): void {
  localStorage.setItem(ENGINE_KEY, engine)
}

// Which model llama.cpp / vLLM should serve, per engine (they load one
// model at launch instead of managing a library like Ollama).
export function loadEngineModels(): Partial<Record<EngineId, string>> {
  try {
    return JSON.parse(localStorage.getItem(ENGINE_MODELS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveEngineModels(models: Partial<Record<EngineId, string>>): void {
  localStorage.setItem(ENGINE_MODELS_KEY, JSON.stringify(models))
}

export function saveConversations(convs: Conversation[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(convs))
  } catch {
    // Quota exceeded on huge histories — drop the oldest half and retry once.
    const trimmed = [...convs].sort((a, b) => b.updatedAt - a.updatedAt)
    trimmed.length = Math.ceil(trimmed.length / 2)
    try {
      localStorage.setItem(KEY, JSON.stringify(trimmed))
    } catch {
      /* give up silently */
    }
  }
}
