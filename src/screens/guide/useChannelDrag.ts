import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent, RefObject } from 'react'

/** Live state of a channel row being dragged, for rendering. */
export interface ChannelDrag {
  from: number // row index the channel started at
  to: number // row index it will land on
  dy: number // px the dragged row has moved, including any scrolling
  rowH: number
  firstTop: number // offsetTop of the first row inside the grid canvas
}

interface Session {
  id: string
  from: number
  startY: number
  startScroll: number
  lastY: number
  rowH: number
  firstTop: number
  started: boolean
  raf: number
}

const THRESHOLD = 4 // px of movement before a press becomes a drag
const EDGE = 56 // px from the grid's top/bottom edge where auto-scroll starts
const MAX_SPEED = 14 // auto-scroll px per frame

/**
 * Pointer-based drag and drop for channel rows. Pointer events (rather than the HTML5
 * drag API) give a smooth custom preview, work with touch and pens, and let the grid
 * auto-scroll. Rows all have the same height, so the drop index follows from the
 * dragged row's centre.
 */
export function useChannelDrag(
  scrollRef: RefObject<HTMLDivElement | null>,
  channelIds: string[],
  onDrop: (id: string, to: number) => void,
) {
  const [drag, setDrag] = useState<ChannelDrag | null>(null)
  const session = useRef<Session | null>(null)
  const count = channelIds.length

  const measure = useCallback(
    (s: Session) => {
      const sc = scrollRef.current
      const dy = s.lastY - s.startY + ((sc?.scrollTop ?? 0) - s.startScroll)
      const centre = s.from * s.rowH + dy + s.rowH / 2
      const to = Math.max(0, Math.min(count - 1, Math.floor(centre / s.rowH)))
      return { dy, to }
    },
    [scrollRef, count],
  )

  const update = useCallback(() => {
    const s = session.current
    if (!s?.started) return
    const { dy, to } = measure(s)
    setDrag({ from: s.from, to, dy, rowH: s.rowH, firstTop: s.firstTop })
  }, [measure])

  // Scroll the grid while the pointer is held near its top or bottom edge.
  const startAutoScroll = useCallback(() => {
    const step = () => {
      const s = session.current
      const sc = scrollRef.current
      if (!s?.started || !sc) return
      const r = sc.getBoundingClientRect()
      const top = r.top + ((sc.querySelector('.epg-axis') as HTMLElement | null)?.offsetHeight ?? 0)
      let v = 0
      if (s.lastY < top + EDGE) v = -MAX_SPEED * Math.min(1, (top + EDGE - s.lastY) / EDGE)
      else if (s.lastY > r.bottom - EDGE) v = MAX_SPEED * Math.min(1, (s.lastY - (r.bottom - EDGE)) / EDGE)
      if (v) {
        sc.scrollTop += v
        update()
      }
      s.raf = requestAnimationFrame(step)
    }
    if (session.current) session.current.raf = requestAnimationFrame(step)
  }, [scrollRef, update])

  const finish = useCallback(
    (commit: boolean) => {
      const s = session.current
      session.current = null
      if (!s) return
      cancelAnimationFrame(s.raf)
      if (commit && s.started) {
        const { to } = measure(s)
        if (to !== s.from) onDrop(s.id, to)
      }
      setDrag(null)
    },
    [measure, onDrop],
  )

  const bind = (row: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      const sc = scrollRef.current
      const rowEl = e.currentTarget.closest<HTMLElement>('.epg-row')
      if (e.button !== 0 || !e.isPrimary || count < 2 || !sc || !rowEl) return
      e.preventDefault() // no text selection, and keyboard focus stays where it is
      e.currentTarget.setPointerCapture(e.pointerId)
      session.current = {
        id: channelIds[row],
        from: row,
        startY: e.clientY,
        startScroll: sc.scrollTop,
        lastY: e.clientY,
        rowH: rowEl.offsetHeight,
        firstTop: rowEl.offsetTop - row * rowEl.offsetHeight,
        started: false,
        raf: 0,
      }
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = session.current
      if (!s) return
      s.lastY = e.clientY
      if (!s.started) {
        if (Math.abs(e.clientY - s.startY) < THRESHOLD) return
        s.started = true
        startAutoScroll()
      }
      update()
    },
    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(false),
  })

  // A different set of rows (a category switch mid-drag) makes the drag's indices stale:
  // cancel it rather than drop a channel at a wrong place.
  const rowsKey = channelIds.join()
  const lastRowsKey = useRef(rowsKey)
  useEffect(() => {
    if (lastRowsKey.current === rowsKey) return
    lastRowsKey.current = rowsKey
    if (session.current) finish(false)
  }, [rowsKey, finish])

  // Esc cancels a drag. Capture phase, so the grid's own Esc ("back to now") does not run.
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      finish(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [dragging, finish])

  return { drag, bind, onScroll: update }
}

/** Vertical offset for a non-dragged row while another row is dragged over it. */
export function rowShift(drag: ChannelDrag | null, row: number): number {
  if (!drag || row === drag.from) return 0
  if (drag.from < drag.to && row > drag.from && row <= drag.to) return -drag.rowH
  if (drag.to < drag.from && row >= drag.to && row < drag.from) return drag.rowH
  return 0
}
