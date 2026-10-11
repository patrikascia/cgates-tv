import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import ChannelLogo from '../../components/ChannelLogo'
import Icon from '../../components/Icon'
import type { Channel } from '../../data/channels'
import { availabilityOf, phaseOf } from '../../data/epg'
import type { Programme } from '../../data/epg'
import { formatDay, formatDuration, formatRange } from '../../lib/time'
import { useMutedPreview } from '../../player/previewPlayers'

interface Props {
  programme: Programme
  channel: Channel
  now: number
  hasReminder: boolean
  /** The primary action; the guide decides whether it plays or explains why it can't. */
  onActivate: () => void
}

function statusLine(p: Programme, now: number): string {
  const phase = phaseOf(p, now)
  if (phase === 'current') return `On now · ${formatDuration(p.end - now)} left`
  if (phase === 'upcoming') return `Starts in ${formatDuration(p.start - now)}`
  return `Ended ${formatDuration(now - p.end)} ago`
}

// Rapid arrowing through the grid should not start and stop a video player each step.
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

export default function DetailsPanel({ programme: p, channel, now, hasReminder, onActivate }: Props) {
  const avail = availabilityOf(p, channel, now)
  const phase = phaseOf(p, now)
  const progress = phase === 'current' ? (now - p.start) / (p.end - p.start) : 0
  // Reminders depend only on time, so they apply to demo channels too.
  const upcoming = phase === 'upcoming'

  // A muted preview is only possible where a real stream exists and is on air.
  const previewUrl = useDebounced(avail === 'live' ? (channel.streamUrl ?? null) : null, 350)
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewStatus = useMutedPreview(videoRef, previewUrl)
  const wantsPreview = avail === 'live'

  // Green "pressed" fill while Enter / Space is held. :active covers the mouse; Enter
  // never sets :active. Cleared on key up and blur, so it never sticks.
  const [pressed, setPressed] = useState(false)
  const onActionKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) setPressed(true)
  }

  return (
    <section className="details" aria-live="polite" aria-label="Programme details">
      <div className={`preview preview-${wantsPreview ? previewStatus : 'none'}`}>
        <video ref={videoRef} muted playsInline aria-hidden="true" />
        {wantsPreview && previewStatus === 'playing' && <span className="preview-badge">Live preview · muted</span>}
        {wantsPreview && previewStatus !== 'playing' && previewStatus !== 'error' && (
          <span className="preview-msg">
            <span className="spinner spinner-sm" aria-hidden="true" />
            Loading preview
          </span>
        )}
        {(!wantsPreview || previewStatus === 'error') && (
          <span className="preview-msg">
            <ChannelLogo channel={channel} size="lg" />
            <span>
              {previewStatus === 'error' && wantsPreview
                ? 'Preview could not be loaded'
                : avail === 'demo'
                  ? 'No preview — demo channel'
                  : avail === 'upcoming'
                    ? 'Preview available when it airs'
                    : 'No preview for past programmes'}
            </span>
          </span>
        )}
      </div>

      <div className="details-body">
        <p className="details-channel">
          <span>{channel.number}</span>
          <span>{channel.name}</span>
          {!channel.streamUrl && <span className="stream-tag">Demo</span>}
        </p>
        <h2 className="details-title">{p.title}</h2>
        <p className="details-meta">
          {avail === 'live' && <span className="tag tag-live">Live</span>}
          {avail === 'recording' && <span className="tag tag-rec">Sample recording</span>}
          <span>
            {formatDay(p.start, now)}, {formatRange(p.start, p.end)}
          </span>
          <span className="dot" aria-hidden="true" />
          <span>{formatDuration(p.end - p.start)}</span>
          <span className="dot" aria-hidden="true" />
          <span>{p.category}</span>
        </p>
        <div className="details-status">
          <span>{statusLine(p, now)}</span>
          {phase === 'current' && (
            <span className="meter" aria-hidden="true">
              <span style={{ width: `${progress * 100}%` }} />
            </span>
          )}
        </div>
        <p className="details-desc">{p.description}</p>

        <div className="details-actions">
          <button
            type="button"
            data-nav="details"
            className={`btn btn-primary action-btn${pressed ? ' is-pressed' : ''}`}
            onClick={onActivate}
            onKeyDown={onActionKeyDown}
            onKeyUp={() => setPressed(false)}
            onBlur={() => setPressed(false)}
          >
            <Icon name={upcoming ? (hasReminder ? 'bellOff' : 'bell') : 'play'} />
            {upcoming
              ? hasReminder
                ? 'Remove reminder'
                : 'Set reminder'
              : phase === 'past'
                ? 'Watch recording'
                : 'Watch now'}
          </button>
        </div>
      </div>
    </section>
  )
}
