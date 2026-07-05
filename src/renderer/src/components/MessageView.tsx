import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { UiMessage } from '../ollama'

interface Props {
  message: UiMessage
  modelName: string
  isLast: boolean
  streaming: boolean
  onRegenerate: () => void
}

export default function MessageView({ message, modelName, isLast, streaming, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  function copy() {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`msg ${message.role}`}>
      <div className="msg-role">{isUser ? 'You' : modelName}</div>
      <div className="msg-content">
        {isUser ? (
          message.content
        ) : message.content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        ) : streaming && isLast ? (
          '…'
        ) : (
          ''
        )}
      </div>
      {!isUser && message.content && !(streaming && isLast) && (
        <div className="msg-actions">
          <button className="ghost tiny" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          {isLast && (
            <button className="ghost tiny" onClick={onRegenerate}>
              Regenerate
            </button>
          )}
          {message.stats && (
            <span className="muted tiny-text">
              {message.stats.tokensPerSec.toFixed(1)} tok/s · {message.stats.tokens} tokens
            </span>
          )}
        </div>
      )}
    </div>
  )
}
