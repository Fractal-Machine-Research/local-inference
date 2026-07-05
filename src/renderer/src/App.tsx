import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ModelInfo,
  PullProgress,
  UiMessage,
  deleteModel,
  formatBytes,
  listModels,
  pullModel,
  streamChat
} from './ollama'
import { Conversation, loadConversations, saveConversations } from './storage'
import ModelPicker from './components/ModelPicker'
import MessageView from './components/MessageView'

type AppStatus = 'checking' | 'ready' | 'not-installed' | 'failed-to-start'

const STARTERS = [
  'Explain how running an AI model locally works',
  'Write a haiku about being offline',
  'Help me plan a weekend coding project'
]

export default function App() {
  const [status, setStatus] = useState<AppStatus>('checking')
  const [sysMemGB, setSysMemGB] = useState(16)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [convs, setConvs] = useState<Conversation[]>(() => loadConversations())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [pulling, setPulling] = useState<{ tag: string; progress: PullProgress } | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pullName, setPullName] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const active = convs.find((c) => c.id === activeId) ?? null
  const messages = active?.messages ?? []

  useEffect(() => saveConversations(convs), [convs])

  const refreshModels = useCallback(async () => {
    const list = await listModels()
    setModels(list)
    setSelectedModel((cur) => (cur && list.some((m) => m.name === cur) ? cur : (list[0]?.name ?? '')))
    return list
  }, [])

  const connect = useCallback(async () => {
    setStatus('checking')
    setError('')
    try {
      const info = await window.api.systemInfo()
      setSysMemGB(info.totalMemGB)
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
  }, [convs, streaming])

  function updateConv(id: string, update: (c: Conversation) => Conversation) {
    setConvs((cur) => cur.map((c) => (c.id === id ? update(c) : c)))
  }

  async function generate(convId: string, history: UiMessage[], model: string) {
    updateConv(convId, (c) => ({
      ...c,
      messages: [...history, { role: 'assistant', content: '' }],
      updatedAt: Date.now()
    }))
    setStreaming(true)
    setError('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      for await (const token of streamChat(model, history, controller.signal, (stats) => {
        updateConv(convId, (c) => {
          const msgs = [...c.messages]
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], stats }
          return { ...c, messages: msgs }
        })
      })) {
        updateConv(convId, (c) => {
          const msgs = [...c.messages]
          const last = msgs[msgs.length - 1]
          msgs[msgs.length - 1] = { ...last, content: last.content + token }
          return { ...c, messages: msgs, updatedAt: Date.now() }
        })
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(String(e))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if (!text || !selectedModel || streaming) return
    setInput('')
    let convId = activeId
    let history: UiMessage[]
    if (!convId || !convs.some((c) => c.id === convId)) {
      convId = crypto.randomUUID()
      history = [{ role: 'user', content: text }]
      const conv: Conversation = {
        id: convId,
        title: text.length > 44 ? text.slice(0, 44) + '…' : text,
        model: selectedModel,
        messages: history,
        updatedAt: Date.now()
      }
      setConvs((cur) => [conv, ...cur])
      setActiveId(convId)
    } else {
      history = [...messages, { role: 'user', content: text }]
    }
    await generate(convId, history, selectedModel)
  }

  async function regenerate() {
    if (!active || streaming) return
    const history = [...active.messages]
    while (history.length && history[history.length - 1].role === 'assistant') history.pop()
    if (!history.length) return
    await generate(active.id, history, selectedModel)
  }

  async function doPull(tag: string) {
    if (!tag || pulling) return
    setError('')
    setPulling({ tag, progress: { status: 'starting' } })
    const controller = new AbortController()
    try {
      for await (const progress of pullModel(tag, controller.signal)) {
        setPulling({ tag, progress })
      }
      const list = await refreshModels()
      const pulled = list.find((m) => m.name.startsWith(tag))
      if (pulled) setSelectedModel(pulled.name)
      setPullName('')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(String(e))
    } finally {
      setPulling(null)
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
    return <div className="center-screen">Starting local AI engine…</div>
  }

  if (status === 'not-installed' || status === 'failed-to-start') {
    return (
      <div className="center-screen">
        <div className="setup-card">
          <h2>Couldn&apos;t start the AI engine</h2>
          <p>
            The bundled engine failed to launch. Installing Ollama separately also works — the
            app will find it.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button onClick={() => window.api.openExternal('https://ollama.com/download')}>
              Get Ollama
            </button>
            <button onClick={connect}>Retry</button>
          </div>
        </div>
      </div>
    )
  }

  // First run: engine is up but no models yet — one guided decision.
  if (models.length === 0) {
    return (
      <div className="onboarding">
        <h1>Pick a model to get started</h1>
        <p className="muted">
          Everything runs on this machine ({sysMemGB} GB memory) — nothing leaves it. You can
          add more models later.
        </p>
        <ModelPicker
          totalMemGB={sysMemGB}
          installed={[]}
          pulling={pulling}
          onPull={doPull}
        />
        {error && <div className="error banner">{error}</div>}
      </div>
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Local Inference</h1>

        <button onClick={() => setActiveId(null)}>New chat</button>

        <ul className="conv-list">
          {convs.map((c) => (
            <li
              key={c.id}
              className={c.id === activeId ? 'active' : ''}
              onClick={() => setActiveId(c.id)}
            >
              <span className="conv-title">{c.title}</span>
              <button
                className="ghost tiny"
                onClick={(e) => {
                  e.stopPropagation()
                  setConvs((cur) => cur.filter((x) => x.id !== c.id))
                  if (activeId === c.id) setActiveId(null)
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <label className="section-label">Model</label>
        <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} ({formatBytes(m.size)})
            </option>
          ))}
        </select>

        <button className="ghost" onClick={() => setShowPicker(!showPicker)}>
          {showPicker ? 'Hide models' : 'Get more models'}
        </button>

        {showPicker && (
          <div className="sidebar-picker">
            <ModelPicker
              totalMemGB={sysMemGB}
              installed={models.map((m) => m.name)}
              pulling={pulling}
              onPull={doPull}
            />
            <div className="pull-row">
              <input
                placeholder="Any Ollama model tag…"
                value={pullName}
                onChange={(e) => setPullName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doPull(pullName.trim())}
                disabled={!!pulling}
              />
              <button onClick={() => doPull(pullName.trim())} disabled={!!pulling || !pullName.trim()}>
                Pull
              </button>
            </div>
            <ul className="model-list">
              {models.map((m) => (
                <li key={m.name}>
                  <span>{m.name}</span>
                  <button className="ghost tiny" onClick={() => removeModel(m.name)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <main className="chat">
        <div className="messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="empty-hint">
              <p>Chatting with {selectedModel} — everything stays on this machine.</p>
              <div className="starters">
                {STARTERS.map((s) => (
                  <button key={s} className="ghost" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageView
              key={i}
              message={m}
              modelName={active?.model ?? selectedModel}
              isLast={i === messages.length - 1}
              streaming={streaming}
              onRegenerate={regenerate}
            />
          ))}
        </div>

        {error && <div className="error banner">{error}</div>}

        <div className="composer">
          <textarea
            placeholder="Send a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={3}
            autoFocus
          />
          {streaming ? (
            <button onClick={() => abortRef.current?.abort()}>Stop</button>
          ) : (
            <button onClick={() => send()} disabled={!input.trim() || !selectedModel}>
              Send
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
