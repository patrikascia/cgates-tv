import { formatTime } from '../data/epg'
import type { Program } from '../data/epg'

export type EpgLoad =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; programs: Program[] }

interface Props {
  load: EpgLoad
  now: number
  playingId: string | null
  onSelect: (program: Program) => void
  onRetry: () => void
}

function tagFor(p: Program, now: number): { text: string; cls: string } {
  if (now >= p.start && now < p.end) return { text: 'ON AIR · LIVE', cls: 'tag-live' }
  if (p.start > now) return { text: 'Upcoming', cls: 'tag-none' }
  if (p.recordingUrl) return { text: '● Sample recording', cls: 'tag-rec' }
  return { text: 'No recording', cls: 'tag-none' }
}

export default function Epg({ load, now, playingId, onSelect, onRetry }: Props) {
  return (
    <section className="epg" aria-label="Programme guide">
      <h2>
        Programme guide <span className="mock-pill">MOCK DATA</span>
      </h2>

      {load.state === 'loading' && <p className="state" role="status">Loading programme guide…</p>}

      {load.state === 'error' && (
        <div className="state state-error" role="alert">
          <p>Could not load the programme guide: {load.message}</p>
          <button data-nav="epg" onClick={onRetry}>Try again</button>
        </div>
      )}

      {load.state === 'ready' && load.programs.length === 0 && (
        <p className="state">No programmes are scheduled for this channel.</p>
      )}

      {load.state === 'ready' && load.programs.length > 0 && (
        <ul data-nav-group="epg">
          {load.programs.map((p) => {
            const tag = tagFor(p, now)
            return (
              <li key={p.id}>
                <button
                  data-nav="epg"
                  data-current={now >= p.start && now < p.end ? 'true' : undefined}
                  className={p.id === playingId ? 'row playing' : 'row'}
                  onClick={() => onSelect(p)}
                >
                  <span className="row-time">{formatTime(p.start)}–{formatTime(p.end)}</span>
                  <span className="row-title">{p.title}</span>
                  <span className={`tag ${tag.cls}`}>{tag.text}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
