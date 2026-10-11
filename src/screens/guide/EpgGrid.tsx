import { useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import ChannelLogo from '../../components/ChannelLogo'
import { MIN, availabilityOf, phaseOf } from '../../data/epg'
import type { Guide, Programme } from '../../data/epg'
import { formatDay, formatRange, formatTime } from '../../lib/time'
import { rowShift, useChannelDrag } from './useChannelDrag'

interface Props {
  guide: Guide
  now: number
  /** Selected programme (green). Changes on click. */
  selectedId: string | null
  onSelect: (p: Programme) => void
  onHover: (p: Programme | null) => void
  /** Click on the already-selected programme: run its action. */
  onOpen: (p: Programme) => void
  /** Move a channel row to a new index (drag and drop). */
  onReorder: (channelId: string, to: number) => void
}

const SLOT = 30 * MIN

export default function EpgGrid({ guide, now, selectedId, onSelect, onHover, onOpen, onReorder }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const cornerRef = useRef<HTMLDivElement>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)
  const [viewDayTime, setViewDayTime] = useState(now)

  const { channels, programmes, windowStart, windowEnd } = guide
  const totalMin = (windowEnd - windowStart) / MIN
  const rows = useMemo(() => channels.map((c) => programmes[c.id] ?? []), [channels, programmes])

  const ticks = useMemo(() => {
    const out: number[] = []
    for (let t = windowStart; t < windowEnd; t += SLOT) out.push(t)
    return out
  }, [windowStart, windowEnd])

  const cellEl = (id: string) => scrollRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)

  // Pixel geometry is read from the DOM so CSS (rem-based) stays the single source of truth.
  const geometry = useCallback(() => {
    const sc = scrollRef.current!
    const col = cornerRef.current?.offsetWidth ?? 0
    const pxPerMin = (sc.scrollWidth - col) / totalMin
    return { sc, col, pxPerMin }
  }, [totalMin])

  const timeAtViewLeft = useCallback(() => {
    const { sc, pxPerMin } = geometry()
    return windowStart + (sc.scrollLeft / pxPerMin) * MIN
  }, [geometry, windowStart])

  const reveal = useCallback(
    (el: HTMLElement) => {
      const { sc, col } = geometry()
      const s = sc.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      const axisH = (sc.querySelector('.epg-axis') as HTMLElement | null)?.offsetHeight ?? 0
      const viewLeft = s.left + col
      const viewW = s.right - viewLeft
      const visible = Math.min(r.right, s.right) - Math.max(r.left, viewLeft)
      if (visible < Math.min(r.width, viewW * 0.5) - 1) sc.scrollLeft += r.left - viewLeft - 24
      if (r.top < s.top + axisH) sc.scrollTop -= s.top + axisH - r.top + 8
      else if (r.bottom > s.bottom) sc.scrollTop += r.bottom - s.bottom + 8
    },
    [geometry],
  )

  const channelIds = useMemo(() => channels.map((c) => c.id), [channels])
  const { drag, bind: dragHandle, onScroll: onDragScroll } = useChannelDrag(scrollRef, channelIds, onReorder)

  // Initial position: "now" a little in from the left edge, then the selected programme
  // (e.g. the one just watched) scrolled into view. Runs once.
  const initialised = useRef(false)
  useLayoutEffect(() => {
    const sc = scrollRef.current
    const line = nowLineRef.current
    if (initialised.current || !sc || !line) return
    initialised.current = true
    const { col, pxPerMin } = geometry()
    sc.scrollLeft = line.offsetLeft - col - 40 * pxPerMin
    const el = selectedId ? cellEl(selectedId) : null
    if (el) reveal(el)
  }, [geometry, selectedId, reveal])

  // The first click selects a programme (the preview card follows it); a click on the
  // programme that is already selected runs its action. A double-click therefore selects
  // and then runs it once. selectedId is the selection from before this click. Clicks
  // made with the keyboard (detail 0) do nothing: the guide is mouse-only.
  const onCellClick = (e: MouseEvent<HTMLButtonElement>, p: Programme) => {
    if (e.detail === 0) return
    if (p.id === selectedId) onOpen(p)
    else onSelect(p)
  }

  const onScroll = () => {
    onDragScroll()
    const t = timeAtViewLeft()
    if (formatDay(t, now) !== formatDay(viewDayTime, now)) setViewDayTime(t)
  }

  const minutesFrom = (t: number) => (Math.min(Math.max(t, windowStart), windowEnd) - windowStart) / MIN
  const nowMin = minutesFrom(now)
  const nowVisible = now >= windowStart && now < windowEnd

  return (
    <div className="epg" data-dragging={drag ? '' : undefined} onPointerLeave={() => onHover(null)}>
      <div
        className="epg-scroll"
        ref={scrollRef}
        onScroll={onScroll}
        style={{ '--total': totalMin } as CSSProperties}
      >
        <div className="epg-canvas">
          <div className="epg-axis">
            <div className="epg-corner" ref={cornerRef}>
              <span className="epg-day">{formatDay(viewDayTime, now)}</span>
            </div>
            <div className="epg-ticks" aria-hidden="true">
              {ticks.map((t) => (
                <span
                  key={t}
                  className={`epg-tick${now - t > -4 * MIN && now - t < 11 * MIN ? ' is-covered' : ''}`}
                  style={{ '--x': minutesFrom(t) } as CSSProperties}
                >
                  {new Date(t).getHours() === 0 && new Date(t).getMinutes() === 0 ? (
                    <strong>{formatDay(t, now)}</strong>
                  ) : (
                    formatTime(t)
                  )}
                </span>
              ))}
              {nowVisible && (
                <span className="epg-now-label" style={{ '--x': nowMin } as CSSProperties}>
                  {formatTime(now)}
                </span>
              )}
            </div>
          </div>

          {channels.map((c, row) => (
            <section
              className={`epg-row${drag?.from === row ? ' is-dragging' : ''}`}
              key={c.id}
              aria-label={`${c.name}${c.streamUrl ? '' : ', demo channel'}`}
              style={
                drag
                  ? ({ '--shift': `${rowShift(drag, row)}px`, '--dy': `${drag.dy}px` } as CSSProperties)
                  : undefined
              }
            >
              <div className="epg-channel" title="Drag to reorder" {...dragHandle(row)}>
                <span className="epg-grip" aria-hidden="true" />
                <ChannelLogo channel={c} />
                <span className="epg-channel-text">
                  <span className="epg-channel-name">{c.name}</span>
                  {c.streamUrl ? (
                    <span className="stream-tag stream-tag-real">Live stream</span>
                  ) : (
                    <span className="stream-tag">Demo</span>
                  )}
                </span>
              </div>
              <div className="epg-track">
                {rows[row].map((p) => {
                  const phase = phaseOf(p, now)
                  const avail = availabilityOf(p, c, now)
                  const x = minutesFrom(p.start)
                  const w = minutesFrom(p.end) - x
                  const progress = phase === 'current' ? (now - p.start) / (p.end - p.start) : 0
                  const status =
                    phase === 'current' ? 'On now' : phase === 'past' ? 'Ended' : `Starts ${formatTime(p.start)}`
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-id={p.id}
                      className={`cell phase-${phase}${p.id === selectedId ? ' is-selected' : ''}`}
                      style={{ '--x': x, '--w': w, '--progress': progress } as CSSProperties}
                      tabIndex={-1}
                      aria-label={`${p.title}, ${formatRange(p.start, p.end)}, ${status}`}
                      aria-pressed={p.id === selectedId}
                      onPointerEnter={() => onHover(p)}
                      onClick={(e) => onCellClick(e, p)}
                    >
                      <span className="cell-inner">
                        <span className="cell-title">{p.title}</span>
                        <span className="cell-meta">
                          {avail === 'live' && <span className="tag tag-live">Live</span>}
                          {avail === 'recording' && <span className="tag tag-rec">Sample rec.</span>}
                          <span className="cell-time">{formatRange(p.start, p.end)}</span>
                        </span>
                      </span>
                      {phase === 'current' && <span className="cell-progress" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}

          {drag && (
            <div
              className="epg-drop-slot"
              style={{ '--slot-top': `${drag.firstTop + drag.to * drag.rowH}px` } as CSSProperties}
              aria-hidden="true"
            />
          )}

          {nowVisible && (
            <div className="epg-now-line" ref={nowLineRef} style={{ '--x': nowMin } as CSSProperties} aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  )
}
