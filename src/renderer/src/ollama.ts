const BASE = 'http://127.0.0.1:11434'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelInfo {
  name: string
  size: number
  details?: { parameter_size?: string; quantization_level?: string }
}

export interface PullProgress {
  status: string
  total?: number
  completed?: number
}

async function* ndjson(res: Response): AsyncGenerator<any> {
  if (!res.ok || !res.body) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line)
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer)
}

export async function listModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE}/api/tags`)
  if (!res.ok) throw new Error(`Failed to list models: ${res.status}`)
  const data = await res.json()
  return data.models ?? []
}

export async function* streamChat(
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal
): AsyncGenerator<string> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal
  })
  for await (const chunk of ndjson(res)) {
    if (chunk.error) throw new Error(chunk.error)
    if (chunk.message?.content) yield chunk.message.content
    if (chunk.done) return
  }
}

export async function* pullModel(
  name: string,
  signal: AbortSignal
): AsyncGenerator<PullProgress> {
  const res = await fetch(`${BASE}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name, stream: true }),
    signal
  })
  for await (const chunk of ndjson(res)) {
    if (chunk.error) throw new Error(chunk.error)
    yield chunk
  }
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetch(`${BASE}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name })
  })
  if (!res.ok) throw new Error(`Failed to delete model: ${res.status}`)
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${bytes} B`
}
