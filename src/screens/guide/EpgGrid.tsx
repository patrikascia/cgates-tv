import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import ChannelLogo from '../../components/ChannelLogo'
import Icon from '../../components/Icon'
import { MIN, availabilityOf, phaseOf } from '../../data/epg'
import type { Guide, Programme } from '../../data/epg'
import { mouseOnly } from '../../lib/mouseOnly'
import { formatDate, formatDay, formatRange, formatTime, startOfDay } from '../../lib/time'
import type { DayOffset } from '../../lib/time'
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
  /** Day shown (the guide passed in is already that day, 00:00 to 24:00). */
  day: DayOffset
  onDayChange: (day: DayOffset) => void
  /** Changes when the user picks Today: scroll back to the current time. */
  nowRequest: number
}

const SLOT = 30 * MIN
const DAYS: { day: DayOffset; label: string }[] = [
  { day: -1, label: 'Yesterday' },
  { day: 0, label: 'Today' },
  { day: 1, label: 'Tomorrow' },
]

export default function EpgGrid({
  guide,
  now,
  selectedId,
  onSelect,
  onHover,
  onOpen,
  onReorder,
  day,
  onDayChange,
  nowRequest,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const cornerRef = useRef<HTMLDivElement>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)
  const dayMenuRef = useRef<HTMLDivElement>(null)
  const [dayMenuOpen, setDayMenuOpen] = useState(false)

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

  // Every day is laid out 00:00 to 24:00 at the same scale, so a scroll position is a time
  // of day: switching days keeps the window. This puts the current time of day a little
  // in from the left edge (on Today, that is "now").
  const scrollToNow = useCallback(() => {
    const sc = scrollRef.current
    if (!sc) return
    const { pxPerMin } = geometry()
    const t = Date.now()
    sc.scrollLeft = ((t - startOfDay(t)) / MIN - 40) * pxPerMin
  }, [geometry])

  // Initial position: the current time, then the selected programme (e.g. the one just
  // watched) scrolled into view. Runs once.
  const initialised = useRef(false)
  useLayoutEffect(() => {
    if (initialised.current || !scrollRef.current) return
    initialised.current = true
    scrollToNow()
    const el = selectedId ? cellEl(selectedId) : null
    if (el) reveal(el)
  }, [scrollToNow, selectedId, reveal])

  // Picking Today returns to the current time (after the day's rows have rendered).
  useLayoutEffect(() => {
    if (nowRequest) scrollToNow()
  }, [nowRequest, scrollToNow])

  // The day menu closes on a choice or on any click outside it.
  useEffect(() => {
    if (!dayMenuOpen) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!dayMenuRef.current?.contains(t) && !cornerRef.current?.contains(t)) setDayMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [dayMenuOpen])

  // The first click selects a programme (the preview card follows it); a click on the
  // programme that is already selected runs its action. A double-click therefore selects
  // and then runs it once. selectedId is the selection from before this click. Clicks
  // made with the keyboard (detail 0) do nothing: the guide is mouse-only.
  const onCellClick = (e: MouseEvent<HTMLButtonElement>, p: Programme) => {
    if (e.detail === 0) return
    if (p.id === selectedId) onOpen(p)
    else onSelect(p)
  }

  const onScroll = () => onDragScroll()

  const minutesFrom = (t: number) => (Math.min(Math.max(t, windowStart), windowEnd) - windowStart) / MIN
  const nowMin = minutesFrom(now)
  const nowVisible = now >= windowStart && now < windowEnd

  return (
    <div className="epg" data-dragging={drag ? '' : undefined} onPointerLeave={() => onHover(null)}>
      {dayMenuOpen && (
        <div className="day-menu" role="menu" aria-label="Day" ref={dayMenuRef}>
          {DAYS.map((d) => (
            <button
              key={d.day}
              type="button"
              tabIndex={-1}
              role="menuitemradio"
              aria-checked={d.day === day}
              className="day-option"
              onClick={mouseOnly(() => {
                setDayMenuOpen(false)
                onDayChange(d.day)
              })}
            >
              <span className="day-option-label">{d.label}</span>
              <span className="day-date">{formatDate(startOfDay(now, d.day))}</span>
              {d.day === day ? <Icon name="check" size="1.1em" /> : <span className="icon-space" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      <div
        className="epg-scroll"
        ref={scrollRef}
        onScroll={onScroll}
        style={{ '--total': totalMin } as CSSProperties}
      >
        <div className="epg-canvas">
          <div className="epg-axis">
            <div className="epg-corner" ref={cornerRef}>
              <button
                type="button"
                tabIndex={-1}
                className={`day-button${dayMenuOpen ? ' is-open' : ''}`}
                aria-haspopup="menu"
                aria-expanded={dayMenuOpen}
                onClick={mouseOnly(() => setDayMenuOpen((o) => !o))}
              >
                <span className="epg-day">{DAYS.find((d) => d.day === day)?.label}</span>
                <span className="day-date">{formatDate(windowStart)}</span>
                <Icon name="chevronDown" size="1em" />
              </button>
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
                      // Hover previews are for mice: a finger swiping the grid leaves the details alone.
                      onPointerEnter={(e) => {
                        if (e.pointerType !== 'touch') onHover(p)
                      }}
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
