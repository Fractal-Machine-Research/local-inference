import type { UiMessage } from './ollama'

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
