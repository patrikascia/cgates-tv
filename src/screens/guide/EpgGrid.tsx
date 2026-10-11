import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, Ref } from 'react'
import ChannelLogo from '../../components/ChannelLogo'
import { MIN, availabilityOf, phaseOf } from '../../data/epg'
import type { Guide, Programme } from '../../data/epg'
import { formatDay, formatRange, formatTime } from '../../lib/time'
import { rowShift, useChannelDrag } from './useChannelDrag'

export interface EpgGridHandle {
  /** Focus a programme: the given one, else the focused one, else the selected one, else what is on air on the first channel. */
  focus: (id?: string) => void
}

interface Props {
  ref?: Ref<EpgGridHandle>
  guide: Guide
  now: number
  /** Keyboard target (roving tabindex). Moves with the arrow keys. */
  focusedId: string | null
  /** Confirmed selection. Changes only on click or Enter. */
  selectedId: string | null
  onFocusProgramme: (p: Programme) => void
  onSelect: (p: Programme) => void
  onHover: (p: Programme | null) => void
  /** Mouse click: run the programme's action (play, explain or set up a reminder). */
  onOpen: (p: Programme) => void
  /** Enter / OK: confirm the programme and move on to the preview card's action button. */
  onConfirm: (p: Programme) => void
  onExitUp: () => void
  /** Move a channel row to a new index (drag and drop, or Alt+Up/Down). */
  onReorder: (channelId: string, to: number) => void
}

const SLOT = 30 * MIN
const PAGE_ROWS = 5

type Pos = { row: number; col: number }

export default function EpgGrid({
  ref,
  guide,
  now,
  focusedId,
  selectedId,
  onFocusProgramme,
  onSelect,
  onHover,
  onOpen,
  onConfirm,
  onExitUp,
  onReorder,
}: Props) {
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
      onFocusProgramme(p)
      // Focus synchronously: the cell is already rendered, only its classes change.
      const el = cellEl(p.id)
      if (el) {
        el.focus({ preventScroll: true })
        reveal(el)
      }
    },
    [onFocusProgramme, reveal],
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

  // Focus a programme: the given one, else the focus target, else the selection, else
  // what is on now on the first row. Only visible programmes qualify.
  const focusBest = useCallback(
    (id?: string) => {
      const target = id ?? focusedId ?? selectedId
      const p = (target && rows.flat().find((x) => x.id === target)) || currentOnRow(0)
      if (p) focusProgramme(p)
    },
    [focusedId, selectedId, rows, currentOnRow, focusProgramme],
  )
  useImperativeHandle(ref, () => ({ focus: focusBest }), [focusBest])

  // Reordering re-renders the rows; keyboard focus is put back on the same programme.
  const restoreFocus = useRef<{ id: string; reveal: boolean } | null>(null)
  // The cell that last had keyboard focus, to notice when a re-render removes it.
  const lastCell = useRef<HTMLElement | null>(null)
  const reorder = useCallback(
    (channelId: string, to: number, reveal = false) => {
      const active = document.activeElement as HTMLElement | null
      const id = scrollRef.current?.contains(active) ? active?.dataset.id : undefined
      restoreFocus.current = id ? { id, reveal } : null
      onReorder(channelId, to)
    },
    [onReorder],
  )
  useLayoutEffect(() => {
    const r = restoreFocus.current
    restoreFocus.current = null
    const el = r && cellEl(r.id)
    if (el) {
      if (document.activeElement !== el) el.focus({ preventScroll: true })
      if (r.reveal) reveal(el)
      return
    }
    // A filter can remove the focused cell (in browsers that do not move focus to a
    // clicked button, focus is still on it). Never let focus drop to the page.
    const removed = lastCell.current !== null && !lastCell.current.isConnected
    const idle = !document.activeElement || document.activeElement === document.body
    if (removed && idle) focusBest()
  }, [channels, reveal, focusBest])

  // The one cell reachable with Tab: the focus target, else the selection, else what is
  // on now on the first row, so the grid can always be entered from the keyboard.
  const tabStopId = focusedId ?? selectedId ?? currentOnRow(0)?.id ?? null

  const channelIds = useMemo(() => channels.map((c) => c.id), [channels])
  const { drag, bind: dragHandle, onScroll: onDragScroll } = useChannelDrag(scrollRef, channelIds, reorder)


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
    const startId = focusedId ?? selectedId
    const pos = startId ? index.get(startId) : undefined
    const p = pos ? rows[pos.row][pos.col] : currentOnRow(0)
    if (p) {
      anchor.current = Math.max(p.start, Date.now())
      focusProgramme(p)
    }
  }, [geometry, index, rows, focusedId, selectedId, currentOnRow, focusProgramme])

  // Mouse: a click selects the programme and runs its action straight away.
  const onCellClick = (e: MouseEvent<HTMLButtonElement>, p: Programme) => {
    // Keyboard "clicks" are handled in onKeyDown. The second click of a double-click
    // must not run the action again.
    if (e.detail !== 1) return
    onSelect(p)
    focusProgramme(p)
    anchor.current = Math.max(p.start, Math.min(timeAtViewLeft(), p.end - MIN))
    onOpen(p)
  }

  const onScroll = () => {
    onDragScroll()
    const t = timeAtViewLeft()
    if (formatDay(t, now) !== formatDay(viewDayTime, now)) setViewDayTime(t)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const id = (e.target as HTMLElement).dataset.id
    const pos = id ? index.get(id) : undefined
    if (!pos) return
    // Alt+Up / Alt+Down: keyboard alternative to dragging the focused programme's channel.
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const to = pos.row + (e.key === 'ArrowDown' ? 1 : -1)
      if (to >= 0 && to < channels.length) reorder(channels[pos.row].id, to, true)
      return
    }
    let next: Programme | undefined
    switch (e.key) {
      case 'Enter':
      case ' ': {
        // Enter confirms the programme and moves focus to the preview card's action
        // button; Enter or Space there runs it. preventDefault stops the native click,
        // so the programme itself never runs an action from the keyboard.
        e.preventDefault()
        if (!e.repeat) onConfirm(rows[pos.row][pos.col])
        return
      }
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
    <div className="epg" data-dragging={drag ? '' : undefined} onPointerLeave={() => onHover(null)}>
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
              <div className="epg-channel" title="Drag to reorder (or Alt+↑/↓ on a programme)" {...dragHandle(row)}>
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
                      tabIndex={p.id === tabStopId ? 0 : -1}
                      aria-label={`${p.title}, ${formatRange(p.start, p.end)}, ${status}`}
                      aria-pressed={p.id === selectedId}
                      onPointerEnter={() => onHover(p)}
                      onFocus={(e) => {
                        lastCell.current = e.currentTarget
                        onFocusProgramme(p)
                      }}
                      onBlur={(e) => {
                        // Focus moved on to something else on purpose: stop tracking.
                        if (e.relatedTarget && !(e.relatedTarget as HTMLElement).dataset.id) lastCell.current = null
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
