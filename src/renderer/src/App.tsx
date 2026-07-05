import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChatMessage,
  ModelInfo,
  PullProgress,
  deleteModel,
  formatBytes,
  listModels,
  pullModel,
  streamChat
} from './ollama'

type AppStatus = 'checking' | 'ready' | 'not-installed' | 'failed-to-start'

export default function App() {
  const [status, setStatus] = useState<AppStatus>('checking')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [pullName, setPullName] = useState('')
  const [pull, setPull] = useState<PullProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refreshModels = useCallback(async () => {
    const list = await listModels()
    setModels(list)
    setSelectedModel((cur) => (cur && list.some((m) => m.name === cur) ? cur : (list[0]?.name ?? '')))
  }, [])

  const connect = useCallback(async () => {
    setStatus('checking')
    setError('')
    try {
      const result = await window.api.ensureOllama()
      if (result === 'running' || result === 'started') {
        await refreshModels()
        setStatus('ready')
      } else {
        setStatus(result as AppStatus)
      }
    } catch (e) {
      setStatus('failed-to-start')
      setError(String(e))
    }
  }, [refreshModels])

  useEffect(() => {
    connect()
  }, [connect])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || !selectedModel || streaming) return
    setError('')
    setInput('')
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      for await (const token of streamChat(selectedModel, history, controller.signal)) {
        setMessages((cur) => {
          const next = [...cur]
          const last = next[next.length - 1]
          next[next.length - 1] = { ...last, content: last.content + token }
          return next
        })
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(String(e))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  async function doPull() {
    const name = pullName.trim()
    if (!name || pull) return
    setError('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      for await (const progress of pullModel(name, controller.signal)) {
        setPull(progress)
      }
      setPullName('')
      await refreshModels()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(String(e))
    } finally {
      setPull(null)
    }
  }

  async function removeModel(name: string) {
    if (!confirm(`Delete ${name} from disk?`)) return
    try {
      await deleteModel(name)
      await refreshModels()
    } catch (e) {
      setError(String(e))
    }
  }

  if (status === 'checking') {
    return <div className="center-screen">Connecting to Ollama…</div>
  }

  if (status === 'not-installed' || status === 'failed-to-start') {
    return (
      <div className="center-screen">
        <div className="setup-card">
          <h2>{status === 'not-installed' ? 'Ollama is not installed' : 'Could not start Ollama'}</h2>
          <p>
            This app uses Ollama to run models locally.{' '}
            {status === 'not-installed'
              ? 'Install it, then try again.'
              : 'Try launching the Ollama app manually, then retry.'}
          </p>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button onClick={() => window.api.openExternal('https://ollama.com/download')}>
              Download Ollama
            </button>
            <button onClick={connect}>Retry</button>
          </div>
        </div>
      </div>
    )
  }

  const pullPct =
    pull?.total && pull.completed ? Math.round((pull.completed / pull.total) * 100) : null

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Local Inference</h1>

        <label className="section-label">Model</label>
        <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
          {models.length === 0 && <option value="">No models installed</option>}
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} ({formatBytes(m.size)})
            </option>
          ))}
        </select>

        <label className="section-label">Installed</label>
        <ul className="model-list">
          {models.map((m) => (
            <li key={m.name}>
              <span title={m.details?.quantization_level}>
                {m.name}
                {m.details?.parameter_size ? ` · ${m.details.parameter_size}` : ''}
              </span>
              <button className="ghost" onClick={() => removeModel(m.name)}>
                ✕
              </button>
            </li>
          ))}
          {models.length === 0 && <li className="muted">Pull a model to get started</li>}
        </ul>

        <label className="section-label">Pull a model</label>
        <div className="pull-row">
          <input
            placeholder="e.g. qwen3:30b, llama3.1:8b"
            value={pullName}
            onChange={(e) => setPullName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doPull()}
            disabled={!!pull}
          />
          <button onClick={doPull} disabled={!!pull || !pullName.trim()}>
            Pull
          </button>
        </div>
        {pull && (
          <div className="pull-progress">
            <div className="muted">
              {pull.status}
              {pullPct !== null ? ` — ${pullPct}%` : ''}
            </div>
            {pullPct !== null && (
              <div className="bar">
                <div className="bar-fill" style={{ width: `${pullPct}%` }} />
              </div>
            )}
          </div>
        )}

        <button className="ghost new-chat" onClick={() => setMessages([])}>
          New chat
        </button>
      </aside>

      <main className="chat">
        <div className="messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="empty-hint">
              {selectedModel
                ? `Chatting with ${selectedModel} — everything runs on this machine.`
                : 'Pull a model from the sidebar to get started.'}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="msg-role">{m.role === 'user' ? 'You' : selectedModel}</div>
              <div className="msg-content">
                {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="error banner">{error}</div>}

        <div className="composer">
          <textarea
            placeholder={selectedModel ? 'Send a message…' : 'No model selected'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            disabled={!selectedModel}
            rows={3}
          />
          {streaming ? (
            <button onClick={() => abortRef.current?.abort()}>Stop</button>
          ) : (
            <button onClick={send} disabled={!input.trim() || !selectedModel}>
              Send
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
