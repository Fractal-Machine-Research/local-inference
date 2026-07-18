// Client for OpenAI-compatible servers (llama.cpp's llama-server, vLLM).
import type { ChatMessage, GenStats, ModelInfo } from './ollama'

export async function listModels(baseUrl: string): Promise<ModelInfo[]> {
  const res = await fetch(`${baseUrl}/v1/models`)
  if (!res.ok) throw new Error(`Failed to list models: ${res.status}`)
  const data = await res.json()
  return (data.data ?? []).map((m: { id: string }) => ({ name: m.id, size: 0 }))
}

async function* sse(res: Response): AsyncGenerator<any> {
  if (!res.ok || !res.body) {
    throw new Error(`Request failed: ${res.status} ${await res.text()}`)
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
      const data = line.startsWith('data:') ? line.slice(5).trim() : ''
      if (!data || data === '[DONE]') continue
      yield JSON.parse(data)
    }
  }
}

export async function* streamChat(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  onStats?: (stats: GenStats) => void
): AsyncGenerator<string> {
  const body = (withUsage: boolean) =>
    JSON.stringify({
      model,
      messages,
      stream: true,
      ...(withUsage ? { stream_options: { include_usage: true } } : {})
    })
  const post = (b: string) =>
    fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: b,
      signal
    })

  let res = await post(body(true))
  // Older servers reject stream_options — retry once without it.
  if (res.status === 400) res = await post(body(false))

  let tokens = 0
  let startedAt = 0
  for await (const chunk of sse(res)) {
    if (chunk.error) throw new Error(chunk.error.message ?? String(chunk.error))
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta) {
      if (!startedAt) startedAt = performance.now()
      tokens++ // rough count; overwritten by real usage below when reported
      yield delta
    }
    if (chunk.usage?.completion_tokens) tokens = chunk.usage.completion_tokens
  }
  const secs = (performance.now() - startedAt) / 1000
  if (tokens && secs > 0) onStats?.({ tokens, tokensPerSec: tokens / secs })
}
