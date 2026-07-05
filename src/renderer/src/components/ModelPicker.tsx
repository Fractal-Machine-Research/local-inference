import { CURATED, fitFor, recommendedTag, Fit } from '../models'
import type { PullProgress } from '../ollama'

const FIT_LABEL: Record<Fit, string> = {
  great: 'Runs great on your machine',
  slow: 'Will be slow — tight on memory',
  no: "Won't fit in your memory"
}

interface Props {
  totalMemGB: number
  installed: string[]
  pulling: { tag: string; progress: PullProgress } | null
  onPull: (tag: string) => void
}

export default function ModelPicker({ totalMemGB, installed, pulling, onPull }: Props) {
  const recommended = recommendedTag(totalMemGB)

  return (
    <div className="cards">
      {CURATED.map((m) => {
        const fit = fitFor(m, totalMemGB)
        const isInstalled = installed.some((name) => name.startsWith(m.tag))
        const isPulling = pulling?.tag === m.tag
        const pct =
          isPulling && pulling.progress.total && pulling.progress.completed
            ? Math.round((pulling.progress.completed / pulling.progress.total) * 100)
            : null
        return (
          <div key={m.tag} className={`card fit-${fit}`}>
            <div className="card-head">
              <span className="card-title">{m.title}</span>
              {m.tag === recommended && <span className="rec-badge">Recommended</span>}
            </div>
            <div className="card-blurb">{m.blurb}</div>
            <div className={`fit-badge fit-${fit}`}>{FIT_LABEL[fit]}</div>
            <div className="card-foot">
              <span className="muted">{m.downloadGB} GB download</span>
              {isInstalled ? (
                <span className="installed-badge">Installed</span>
              ) : isPulling ? (
                <span className="muted">
                  {pct !== null ? `${pct}%` : pulling.progress.status}
                </span>
              ) : (
                <button
                  onClick={() => onPull(m.tag)}
                  disabled={fit === 'no' || pulling !== null}
                >
                  Download
                </button>
              )}
            </div>
            {isPulling && pct !== null && (
              <div className="bar">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
