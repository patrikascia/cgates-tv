import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import type { Programme } from '../../data/epg'
import { formatClock, formatTimeSec } from '../../lib/time'
import { useFramePreview } from '../../player/previewPlayers'

interface Props {
  isLive: boolean
  url: string
  start: number // seek range, media seconds
  end: number
  current: number
  disabled: boolean
  /** Media time -> wall-clock ms, when the stream provides it (live). */
  wallClockAt: (t: number) => number | null
  programmeAt: (wallMs: number) => Programme | undefined
  onSeek: (t: number) => void
}

const KEY_STEP = 10 // seconds per arrow press
const COMMIT_DELAY = 800 // ms of inactivity before a keyboard scrub is applied

export default function Scrubber({ isLive, url, start, end, current, disabled, wallClockAt, programmeAt, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [pending, setPending] = useState<number | null>(null) // keyboard or drag target
  const [dragging, setDragging] = useState(false)
  const [engaged, setEngaged] = useState(false) // start frame previews on first interaction
  const commitTimer = useRef(0)

  const frames = useFramePreview(previewRef, url, engaged && !disabled)
  const span = Math.max(0.001, end - start)
  const clamp = useCallback((t: number) => Math.min(end, Math.max(start, t)), [start, end])
  const frac = (t: number) => Math.min(1, Math.max(0, (t - start) / span))

  const tipTime = pending ?? hoverTime
  const { request } = frames
  useEffect(() => {
    if (tipTime !== null) request(tipTime)
  }, [tipTime, request])

  useEffect(() => () => window.clearTimeout(commitTimer.current), [])

  const timeAtPointer = (e: PointerEvent) => {
    const r = trackRef.current!.getBoundingClientRect()
    return start + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * span
  }

  const commit = (t: number) => {
    window.clearTimeout(commitTimer.current)
    setPending(null)
    onSeek(t)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      setEngaged(true)
      const next = clamp((pending ?? current) + (e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP))
      setPending(next)
      window.clearTimeout(commitTimer.current)
      commitTimer.current = window.setTimeout(() => commit(next), COMMIT_DELAY)
    } else if ((e.key === 'Enter' || e.key === ' ') && pending !== null) {
      e.preventDefault()
      commit(pending)
    } else if ((e.key === 'Escape' || e.key === 'Backspace') && pending !== null) {
      e.preventDefault() // cancel the scrub instead of leaving the player
      window.clearTimeout(commitTimer.current)
      setPending(null)
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && pending !== null) {
      commit(pending) // leaving the scrubber applies the scrub
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    if (disabled || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setEngaged(true)
    setDragging(true)
    setPending(timeAtPointer(e))
  }
  const onPointerMove = (e: PointerEvent) => {
    if (disabled) return
    const t = timeAtPointer(e)
    setEngaged(true)
    if (dragging) setPending(t)
    else setHoverTime(t)
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return
    setDragging(false)
    commit(timeAtPointer(e))
  }

  const shownPos = pending ?? current
  const behind = end - current

  // Tooltip content
  const wall = tipTime !== null ? wallClockAt(tipTime) : null
  const tipProgramme = wall !== null ? programmeAt(wall) : undefined
  const frameMatches =
    frames.status === 'ready' && frames.frameTime !== null && tipTime !== null && Math.abs(frames.frameTime - tipTime) < 1.5
  const showFrameBox = frames.status === 'loading' || frames.status === 'ready'

  const valueText = isLive
    ? behind < 8
      ? 'At live edge'
      : `${formatClock(behind)} behind live`
    : `${formatClock(current - start)} of ${formatClock(span)}`

  return (
    <div className={`scrubber${disabled ? ' is-disabled' : ''}`} data-scrubbing={tipTime !== null || undefined}>
      <span className="scrubber-edge">{isLive ? `−${formatClock(span)}` : formatClock(current - start)}</span>

      <div
        className="scrubber-hit"
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        data-row="scrub"
        aria-label={isLive ? 'Live rewind window' : 'Recording position'}
        aria-valuemin={0}
        aria-valuemax={Math.round(span)}
        aria-valuenow={Math.round(shownPos - start)}
        aria-valuetext={valueText}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onFocus={() => setEngaged(true)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoverTime(null)}
        onBlur={() => pending !== null && commit(pending)}
        style={{ '--pos': frac(shownPos), '--tip': frac(tipTime ?? shownPos) } as CSSProperties}
      >
        <div className="scrubber-track">
          <div className="scrubber-fill" />
          {hoverTime !== null && pending === null && (
            <div className="scrubber-hover" style={{ '--hover': frac(hoverTime) } as CSSProperties} />
          )}
        </div>
        <div className="scrubber-knob" />

        <div className={`scrub-tip${tipTime !== null ? ' is-visible' : ''}`} aria-hidden="true">
          <div className={`scrub-frame${showFrameBox ? '' : ' is-absent'}${frameMatches ? ' is-ready' : ''}`}>
            {/* Real decoded frame from a hidden 360p copy of the stream. */}
            <video ref={previewRef} muted playsInline />
            {!frameMatches && <span className="spinner spinner-sm" />}
          </div>
          <div className="scrub-tip-text">
            {tipTime !== null && (
              <>
                <strong>
                  {isLive && wall !== null ? formatTimeSec(wall) : formatClock(tipTime - start)}
                </strong>
                {isLive && <span>{end - tipTime < 8 ? 'Live' : `−${formatClock(end - tipTime)}`}</span>}
              </>
            )}
          </div>
          {tipProgramme && <div className="scrub-tip-prog">{tipProgramme.title}</div>}
        </div>
      </div>

      <span className={`scrubber-edge scrubber-edge-end${isLive && behind < 8 ? ' is-live' : ''}`}>
        {isLive ? 'Live' : formatClock(span)}
      </span>
    </div>
  )
}
