import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, Ref } from 'react'
import ChannelLogo from '../../components/ChannelLogo'
import { MIN, availabilityOf, phaseOf } from '../../data/epg'
import type { Guide, Programme } from '../../data/epg'
import { formatDay, formatRange, formatTime } from '../../lib/time'

export interface EpgGridHandle {
  /** Focus the selected programme (or the one on air on the first channel). */
  focus: () => void
}

interface Props {
  ref?: Ref<EpgGridHandle>
  guide: Guide
  now: number
  selectedId: string | null
  onSelect: (p: Programme) => void
  onHover: (p: Programme | null) => void
  /** The programme's primary action: a second click, or OK on the selected programme. */
  onOpen: (p: Programme) => void
  onExitUp: () => void
}

const SLOT = 30 * MIN
const PAGE_ROWS = 5

type Pos = { row: number; col: number }

export default function EpgGrid({ ref, guide, now, selectedId, onSelect, onHover, onOpen, onExitUp }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const cornerRef = useRef<HTMLDivElement>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)
  // The time the user is "looking at". Up/Down picks the programme airing at this
  // time on the next channel, so vertical movement does not drift through the day.
  const anchor = useRef(now)
  const [viewDayTime, setViewDayTime] = useState(now)

  const { channels, programmes, windowStart, windowEnd } = guide
  const totalMin = (windowEnd - windowStart) / MIN
  const rows = useMemo(() => channels.map((c) => programmes[c.id] ?? []), [channels, programmes])

  const index = useMemo(() => {
    const m = new Map<string, Pos>()
    rows.forEach((list, row) => list.forEach((p, col) => m.set(p.id, { row, col })))
    return m
  }, [rows])

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

  const focusProgramme = useCallback(
    (p: Programme) => {
      onSelect(p)
      // Focus synchronously: the cell is already rendered, only its classes change.
      const el = cellEl(p.id)
      if (el) {
        el.focus({ preventScroll: true })
        reveal(el)
      }
    },
    [onSelect, reveal],
  )

  const pickAt = useCallback(
    (row: number, t: number): Programme | undefined => {
      const list = rows[row]
      if (!list?.length) return undefined
      return list.find((p) => t >= p.start && t < p.end) ?? (t < list[0].start ? list[0] : list[list.length - 1])
    },
    [rows],
  )

  const currentOnRow = useCallback((row: number) => pickAt(row, Date.now()), [pickAt])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const p = (selectedId && rows.flat().find((x) => x.id === selectedId)) || currentOnRow(0)
        if (p) focusProgramme(p)
      },
    }),
    [selectedId, rows, currentOnRow, focusProgramme],
  )

  // Initial position: "now" a little in from the left edge, then the selected programme.
  // Runs once; later selection changes come from the user and must not re-scroll.
  const initialised = useRef(false)
  useLayoutEffect(() => {
    const sc = scrollRef.current
    const line = nowLineRef.current
    if (initialised.current || !sc || !line) return
    initialised.current = true
    const { col, pxPerMin } = geometry()
    sc.scrollLeft = line.offsetLeft - col - 40 * pxPerMin
    const pos = selectedId ? index.get(selectedId) : undefined
    const p = pos ? rows[pos.row][pos.col] : currentOnRow(0)
    if (p) {
      anchor.current = Math.max(p.start, Date.now())
      focusProgramme(p)
    }
  }, [geometry, index, rows, selectedId, currentOnRow, focusProgramme])

  // Two-step activation: the first click selects (and previews) a programme, a click on
  // the already-selected one runs its action. Pressing the pointer focuses the cell, and
  // focus selects it, so "already selected" must be read before that, on pointerdown.
  const pressedWasSelected = useRef(false)
  const onCellClick = (e: MouseEvent<HTMLButtonElement>, p: Programme) => {
    // detail is 0 for keyboard clicks (Enter/Space), which go to the focused cell.
    const wasSelected = e.detail === 0 ? p.id === selectedId : pressedWasSelected.current
    pressedWasSelected.current = false
    if (wasSelected) {
      onOpen(p)
      return
    }
    focusProgramme(p)
    anchor.current = Math.max(p.start, Math.min(timeAtViewLeft(), p.end - MIN))
  }

  const onScroll = () => {
    const t = timeAtViewLeft()
    if (formatDay(t, now) !== formatDay(viewDayTime, now)) setViewDayTime(t)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const id = (e.target as HTMLElement).dataset.id
    const pos = id ? index.get(id) : undefined
    if (!pos) return
    let next: Programme | undefined
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        next = rows[pos.row][pos.col + (e.key === 'ArrowRight' ? 1 : -1)]
        if (next) {
          e.preventDefault()
          focusProgramme(next)
          // After scrolling: the visible start of the programme becomes the new anchor.
          anchor.current = Math.max(next.start, Math.min(timeAtViewLeft(), next.end - MIN))
          return
        }
        break
      }
      case 'ArrowDown':
      case 'ArrowUp':
      case 'PageDown':
      case 'PageUp': {
        const down = e.key === 'ArrowDown' || e.key === 'PageDown'
        const step = e.key.startsWith('Page') ? PAGE_ROWS : 1
        if (!down && pos.row === 0) {
          e.preventDefault()
          onExitUp()
          return
        }
        const row = Math.min(rows.length - 1, Math.max(0, pos.row + (down ? step : -step)))
        next = pickAt(row, anchor.current)
        break
      }
      case 'Escape':
      case 'Backspace': {
        // "Back" in the guide = return to what is on now, on the same channel.
        next = currentOnRow(pos.row)
        if (next) {
          anchor.current = Date.now()
          const { sc, col, pxPerMin } = geometry()
          sc.scrollLeft = (nowLineRef.current?.offsetLeft ?? 0) - col - 40 * pxPerMin
        }
        break
      }
      default:
        return
    }
    e.preventDefault()
    if (next) focusProgramme(next)
  }

  const minutesFrom = (t: number) => (Math.min(Math.max(t, windowStart), windowEnd) - windowStart) / MIN
  const nowMin = minutesFrom(now)
  const nowVisible = now >= windowStart && now < windowEnd

  return (
    <div className="epg" onPointerLeave={() => onHover(null)}>
      <div
        className="epg-scroll"
        ref={scrollRef}
        onKeyDown={onKeyDown}
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
            <section className="epg-row" key={c.id} aria-label={`${c.name}${c.streamUrl ? '' : ', demo channel'}`}>
              <div className="epg-channel">
                <span className="epg-channel-num">{c.number}</span>
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
                      tabIndex={p.id === selectedId ? 0 : -1}
                      aria-label={`${p.title}, ${formatRange(p.start, p.end)}, ${status}`}
                      onPointerEnter={() => onHover(p)}
                      onPointerDown={() => (pressedWasSelected.current = p.id === selectedId)}
                      onFocus={() => onSelect(p)}
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

          {nowVisible && (
            <div className="epg-now-line" ref={nowLineRef} style={{ '--x': nowMin } as CSSProperties} aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  )
}
