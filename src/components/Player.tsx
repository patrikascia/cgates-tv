import { useRef } from 'react'
import { usePlayer } from '../player/usePlayer'
import type { PlayerStatus, Source } from '../player/usePlayer'

const STATUS_LABEL: Record<PlayerStatus, string> = {
  loading: 'Loading…',
  buffering: 'Buffering…',
  playing: 'Playing',
  paused: 'Paused',
  ended: 'Ended',
  error: 'Error',
}

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  source: Source
  onBackToLive: () => void
}

export default function Player({ source, onBackToLive }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { state, togglePlay, seekBy, goToLiveEdge, changeVolume, toggleMute } = usePlayer(videoRef, source)
  const isLive = source.kind === 'live'
  const span = Math.max(1, state.rangeEnd - state.rangeStart)
  const progress = Math.min(100, Math.max(0, ((state.currentTime - state.rangeStart) / span) * 100))
  const busy = state.status === 'loading' || state.status === 'buffering'
  const volumePct = state.muted ? 0 : Math.round(state.volume * 100)

  return (
    <section className="player" aria-label="Video player">
      <div className="screen">
        <video ref={videoRef} playsInline />

        <div className={`badge ${isLive ? 'badge-live' : 'badge-rec'}`}>
          {isLive ? 'LIVE' : 'RECORDING'}
        </div>

        {busy && <div className="overlay" role="status">{STATUS_LABEL[state.status]}</div>}

        {state.status === 'error' && state.error && (
          <div className="overlay overlay-error" role="alert">
            <h2>{state.error.title}</h2>
            <p>{state.error.detail}</p>
            {!isLive && (
              <button data-nav="controls" onClick={onBackToLive}>
                Back to live
              </button>
            )}
          </div>
        )}
      </div>

      <div className="now-playing">
        <span className="np-title">{source.title}</span>
        <span className="np-status" role="status">{STATUS_LABEL[state.status]}</span>
      </div>

      <div className="progress" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="times">
        <span>{clock(state.currentTime - state.rangeStart)}</span>
        <span>{isLive ? 'rewind window' : 'recording length'} {clock(span)}</span>
      </div>

      <div className="controls" role="toolbar" aria-label="Player controls" data-nav-group="controls">
        <button data-nav="controls" onClick={togglePlay} disabled={state.status === 'error'}>
          {state.status === 'playing' || busy ? '⏸ Pause' : '▶ Play'}
        </button>
        <button data-nav="controls" onClick={() => seekBy(-10)} disabled={state.status === 'error'}>⏪ 10s</button>
        <button data-nav="controls" onClick={() => seekBy(10)} disabled={state.status === 'error'}>10s ⏩</button>
        {isLive ? (
          <button data-nav="controls" onClick={goToLiveEdge} disabled={state.status === 'error'}>⏭ Live edge</button>
        ) : (
          <button data-nav="controls" onClick={onBackToLive}>⏭ Back to live</button>
        )}
        <button data-nav="controls" onClick={toggleMute}>{state.muted || state.volume === 0 ? '🔇 Unmute' : '🔊 Mute'}</button>
        <button data-nav="controls" onClick={() => changeVolume(-0.1)}>− Vol</button>
        <span className="volume" aria-label={`Volume ${volumePct} percent`}>{volumePct}%</span>
        <button data-nav="controls" onClick={() => changeVolume(0.1)}>+ Vol</button>
      </div>
    </section>
  )
}
