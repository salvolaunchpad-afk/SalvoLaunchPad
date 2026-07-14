import { useSyncExternalStore } from 'react'
import { getEvents, subscribe } from '../mock'

export default function Ticker() {
  const events = useSyncExternalStore(subscribe, getEvents)
  if (events.length === 0) return null
  const loop = [...events, ...events]
  return (
    <div className="ticker">
      <div className="ticker-track">
        {loop.map((e, i) => (
          <span key={`${e.id}-${i}`} className="ticker-item">
            <span className={`tk tk-${e.kind}`}>◆</span> {e.text}
          </span>
        ))}
      </div>
    </div>
  )
}
