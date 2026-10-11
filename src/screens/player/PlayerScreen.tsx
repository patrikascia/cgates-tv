import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Selection } from '../../App'
import ChannelLogo from '../../components/ChannelLogo'
import Icon from '../../components/Icon'
import { REAL_CHANNEL } from '../../data/channels'
import { availabilityOf, programmeAt } from '../../data/epg'
import type { Guide } from '../../data/epg'
import { formatClock, formatDay, formatRange, formatTime, formatTimeSec, useNow } from '../../lib/time'
import { usePlayer } from '../../player/usePlayer'
import type { Source } from '../../player/usePlayer'
import Scrubber from './Scrubber'
import './player.css'

interface Props {
  selection: Selection
  guide: Guide | null
  onBack: () => void
  onWatchLive: () => void
}

const ROWS = ['top', 'scrub', 'controls'] as const
const LIVE_TOLERANCE = 8 // s; one segment

const focusables = (row: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-row="${row}"]`)).filter(
    (el) => !(el as HTMLButtonElement).disabled && el.tabIndex >= 0 && el.offsetParent !== null,
  )

/** Moves focus between player rows with the arrow keys (TV remote style). */
function moveFocus(key: string): boolean {
  const active = document.activeElement as HTMLElement | null
  const row = active?.dataset.row
  if (!row) {
    const first = focusables('controls')[0] ?? focusables('top')[0]
    first?.focus()
    return Boolean(first)
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const list = focusables(row)
    const i = list.indexOf(active!)
    list[i + (key === 'ArrowRight' ? 1 : -1)]?.focus()
    return true
  }
  const order = ROWS.filter((r) => focusables(r).length)
  const target = order[order.indexOf(row as (typeof ROWS)[number]) + (key === 'ArrowDown' ? 1 : -1)]
  if (target) focusables(target)[0]?.focus()
  return true
}

export default function PlayerScreen({ selection, guide, onBack, onWatchLive }: Props) {
  const { channel, programme } = selection
  // Decided once when the screen opens; a new selection remounts this screen.
  const [openedAt] = useState(() => Date.now())
  const mode = programme ? availabilityOf(programme, channel, openedAt) : channel.streamUrl ? 'live' : 'demo'

  if (mode === 'live' && channel.streamUrl) {
    return (
      <Playback
        source={{ kind: 'live', url: channel.streamUrl, title: channel.name }}
        selection={selection}
        guide={guide}
        onBack={onBack}
        onWatchLive={onWatchLive}
      />
    )
  }
  if (mode === 'recording' && programme?.recordingUrl) {
    return (
      <Playback
        source={{ kind: 'recording', url: programme.recordingUrl, title: programme.title }}
        selection={selection}
        guide={guide}
        onBack={onBack}
        onWatchLive={onWatchLive}
      />
    )
  }
  return <Unavailable selection={selection} reason={mode} onBack={onBack} onWatchLive={onWatchLive} />
}

function TopBar({ selection, subtitle, children, onBack }: {
  selection: Selection
  subtitle: string
  children?: ReactNode
  onBack: () => void
}) {
  const now = useNow(5_000)
  return (
    <div className="player-top">
      <button type="button" className="btn btn-ghost" data-row="top" onClick={onBack}>
        <Icon name="back" />
        Guide
      </button>
      <div className="player-ident">
        <ChannelLogo channel={selection.channel} size="sm" />
        <div>
          <p className="player-channel">
            {selection.channel.number} · {selection.channel.name}
          </p>
          <p className="player-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="player-top-end">
        {children}
        <span className="clock-time">{formatTime(now)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Unavailable({ selection, reason, onBack, onWatchLive }: {
  selection: Selection
  reason: 'demo' | 'upcoming' | 'no-recording' | 'live' | 'recording'
  onBack: () => void
  onWatchLive: () => void
}) {
  const { channel, programme: p } = selection
  const [now] = useState(() => Date.now())
  const firstAction = useRef<HTMLButtonElement>(null)
  useEffect(() => firstAction.current?.focus(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack') {
        e.preventDefault()
        onBack()
      } else if (e.key.startsWith('Arrow') && moveFocus(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const copy =
    reason === 'demo'
      ? {
          title: `${channel.name} has no stream`,
          text: `This is a demo channel used to fill the guide. In this prototype only ${REAL_CHANNEL.name} has a real live stream.`,
        }
      : reason === 'upcoming' && p
        ? {
            title: 'This programme has not started yet',
            text: `It starts ${formatDay(p.start, now).toLowerCase()} at ${formatTime(p.start)} on ${channel.name}.`,
          }
        : {
            title: 'No recording available',
            text: `${p ? `“${p.title}” aired ${formatDay(p.start, now).toLowerCase()}, ${formatRange(p.start, p.end)}. ` : ''}No recording exists for it, and the live stream can only be rewound by about 3 minutes.`,
          }

  return (
    <div className="player-screen is-static">
      <TopBar selection={selection} subtitle={p?.title ?? 'Live'} onBack={onBack} />
      <div className="player-center">
        <div className="state-card state-card-wide">
          {p && (
            <p className="state-eyebrow">
              {p.title} · {formatDay(p.start, now)}, {formatRange(p.start, p.end)}
            </p>
          )}
          <p className="state-title">{copy.title}</p>
          <p className="state-text">{copy.text}</p>
          <div className="state-actions">
            <button ref={firstAction} type="button" className="btn btn-primary" data-row="controls" onClick={onWatchLive}>
              <span className="status-dot" aria-hidden="true" />
              Watch {REAL_CHANNEL.name} live
            </button>
            <button type="button" className="btn btn-secondary" data-row="controls" onClick={onBack}>
              <Icon name="guide" />
              Back to guide
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Hides the player chrome after a period without input, only while `enabled`. */
function useAutoHide(enabled: boolean, delay = 3500) {
  const [hidden, setHidden] = useState(false)
  const timer = useRef(0)
  const hiddenRef = useRef(false) // readable from event listeners without re-subscribing

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current)
    if (!enabled) {
      hiddenRef.current = false
      return
    }
    timer.current = window.setTimeout(() => {
      hiddenRef.current = true
      setHidden(true)
    }, delay)
  }, [enabled, delay])

  useEffect(() => {
    schedule()
    return () => window.clearTimeout(timer.current)
  }, [schedule])

  const poke = useCallback(() => {
    hiddenRef.current = false
    setHidden(false)
    schedule()
  }, [schedule])

  return { visible: !hidden || !enabled, hiddenRef, poke }
}

function Playback({ source, selection, guide, onBack, onWatchLive }: {
  source: Source
  selection: Selection
  guide: Guide | null
  onBack: () => void
  onWatchLive: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playBtn = useRef<HTMLButtonElement>(null)
  const { state, togglePlay, seekBy, seekTo, goToLiveEdge, setVolume, toggleMute, retry } = usePlayer(videoRef, source)
  const isLive = source.kind === 'live'
  const { status } = state
  const ready = state.rangeEnd > state.rangeStart && status !== 'loading' && status !== 'error'
  const chrome = useAutoHide(status === 'playing')
  const now = useNow(5_000)

  const behind = Math.max(0, state.rangeEnd - state.currentTime)
  const atLive = isLive && behind < LIVE_TOLERANCE
  const wallClockAt = useCallback(
    (t: number) => (isLive && state.presentationStart !== null ? state.presentationStart + t * 1000 : null),
    [isLive, state.presentationStart],
  )
  const schedule = guide?.programmes[selection.channel.id]
  const programmeAtWall = useCallback((ms: number) => programmeAt(schedule, ms), [schedule])
  const playheadWall = wallClockAt(state.currentTime)
  const onAir = isLive ? programmeAtWall(playheadWall ?? now) : undefined
  const subtitle = isLive
    ? onAir
      ? `${onAir.title} · ${formatRange(onAir.start, onAir.end)} (demo schedule)`
      : 'Live'
    : `${selection.programme?.title ?? source.title} · Sample recording`

  useEffect(() => playBtn.current?.focus(), [])

  // Keyboard. Capture phase so that, while the controls are hidden, the first key
  // press only reveals them instead of also seeking or toggling something unseen.
  const { poke, hiddenRef } = chrome
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const wasHidden = hiddenRef.current
      poke()
      const isBack = e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack'
      if (wasHidden && !isBack && (e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [poke, hiddenRef])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return // handled by a control (e.g. scrubber cancelling a scrub)
      const active = document.activeElement as HTMLElement | null
      const onButton = active?.tagName === 'BUTTON'
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack') {
        e.preventDefault()
        onBack()
      } else if (e.key === 'MediaPlayPause' || e.key === 'k' || (e.key === ' ' && !onButton)) {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'm') {
        toggleMute()
      } else if (e.key.startsWith('Arrow')) {
        const range = active instanceof HTMLInputElement && active.type === 'range'
        // The volume slider keeps Left/Right for itself except at its ends.
        if (range && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          const v = Number(active.value)
          const atEdge = (e.key === 'ArrowLeft' && v <= 0) || (e.key === 'ArrowRight' && v >= 1)
          if (!atEdge) return
        }
        if (moveFocus(e.key)) e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack, togglePlay, toggleMute])

  const volume = state.muted ? 0 : state.volume
  const playing = status === 'playing' || status === 'buffering'

  return (
    <div
      className={`player-screen${chrome.visible ? '' : ' chrome-hidden'}`}
      onPointerMove={chrome.poke}
      onPointerDown={chrome.poke}
    >
      {/* detail check: the second click of the double-click that opened the player lands here */}
      <video ref={videoRef} className="player-video" playsInline onClick={(e) => e.detail === 1 && togglePlay()} />

      <div className="player-scrim" aria-hidden="true" />

      <TopBar selection={selection} subtitle={subtitle} onBack={onBack}>
        {isLive ? (
          <span className={`status-chip ${atLive ? 'status-live' : 'status-behind'}`}>
            <span className="status-dot" aria-hidden="true" />
            {atLive ? 'Live' : `${formatClock(behind)} behind live`}
          </span>
        ) : (
          <span className="status-chip status-rec">Recording</span>
        )}
      </TopBar>

      <div className="player-center" aria-live="polite">
        {status === 'loading' && (
          <div className="state-inline" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>{isLive ? `Connecting to ${selection.channel.name}` : 'Loading recording'}</span>
          </div>
        )}
        {status === 'buffering' && <span className="spinner" role="status" aria-label="Buffering" />}
        {status === 'error' && state.error && (
          <div className="state-card state-card-wide" role="alert">
            <p className="state-eyebrow">{isLive ? 'Live playback stopped' : 'Recording unavailable'}</p>
            <p className="state-title">{state.error.title}</p>
            <p className="state-text">{state.error.detail}</p>
            <div className="state-actions">
              <button type="button" className="btn btn-primary" data-row="controls" onClick={retry} autoFocus>
                <Icon name="retry" />
                Try again
              </button>
              {!isLive && (
                <button type="button" className="btn btn-secondary" data-row="controls" onClick={onWatchLive}>
                  <span className="status-dot" aria-hidden="true" />
                  Watch {REAL_CHANNEL.name} live
                </button>
              )}
              <button type="button" className="btn btn-secondary" data-row="controls" onClick={onBack}>
                <Icon name="guide" />
                Back to guide
              </button>
            </div>
          </div>
        )}
        {status === 'ended' && (
          <div className="state-card">
            <p className="state-title">End of recording</p>
            <div className="state-actions">
              <button
                type="button"
                className="btn btn-primary"
                data-row="controls"
                autoFocus
                onClick={() => {
                  seekTo(state.rangeStart)
                  togglePlay()
                }}
              >
                <Icon name="retry" />
                Play again
              </button>
              <button type="button" className="btn btn-secondary" data-row="controls" onClick={onBack}>
                <Icon name="guide" />
                Back to guide
              </button>
            </div>
          </div>
        )}
      </div>

      {status !== 'error' && (
        <div className="player-bottom">
          <Scrubber
            isLive={isLive}
            url={source.url}
            start={state.rangeStart}
            end={state.rangeEnd}
            current={state.currentTime}
            disabled={!ready}
            wallClockAt={wallClockAt}
            programmeAt={programmeAtWall}
            onSeek={seekTo}
          />

          <div className="player-controls">
            <div className="controls-group">
              <button
                ref={playBtn}
                type="button"
                className="ctl ctl-primary"
                data-row="controls"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                <Icon name={playing ? 'pause' : 'play'} size="1.6em" />
              </button>
              <button
                type="button"
                className="ctl"
                data-row="controls"
                onClick={() => seekBy(-10)}
                disabled={!ready}
                aria-label="Back 10 seconds"
              >
                <Icon name="replay10" size="1.6em" />
              </button>
              <button
                type="button"
                className="ctl"
                data-row="controls"
                onClick={() => seekBy(10)}
                disabled={!ready || atLive}
                aria-label="Forward 10 seconds"
              >
                <Icon name="forward10" size="1.6em" />
              </button>
              {isLive && (
                <button
                  type="button"
                  className="ctl ctl-text"
                  data-row="controls"
                  onClick={goToLiveEdge}
                  disabled={!ready || atLive}
                >
                  <span className="status-dot" aria-hidden="true" />
                  Go live
                </button>
              )}
              <span className="time-readout" aria-live="off">
                {isLive ? (
                  <>
                    <strong>{playheadWall !== null ? formatTimeSec(playheadWall) : '--:--:--'}</strong>
                    <span>
                      {ready
                        ? `Rewind window ${formatClock(state.rangeEnd - state.rangeStart)} · limited by this stream`
                        : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>{formatClock(state.currentTime - state.rangeStart)}</strong>
                    <span>/ {formatClock(state.rangeEnd - state.rangeStart)}</span>
                  </>
                )}
              </span>
            </div>

            <div className="controls-group">
              <button
                type="button"
                className="ctl"
                data-row="controls"
                onClick={toggleMute}
                aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              >
                <Icon name={volume === 0 ? 'mute' : 'volume'} />
              </button>
              <input
                className="volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                data-row="controls"
                aria-label="Volume"
                aria-valuetext={`${Math.round(volume * 100)}%`}
                onChange={(e) => setVolume(Number(e.target.value))}
                style={{ '--vol': volume } as CSSProperties}
              />
              <button type="button" className="ctl ctl-text" data-row="controls" onClick={onBack}>
                <Icon name="guide" />
                Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
