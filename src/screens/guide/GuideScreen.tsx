import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GuideLoad, Selection } from '../../App'
import AppHeader from '../../components/AppHeader'
import Icon from '../../components/Icon'
import type { Programme } from '../../data/epg'
import { useNow } from '../../lib/time'
import DetailsPanel from './DetailsPanel'
import EpgGrid from './EpgGrid'
import type { EpgGridHandle } from './EpgGrid'
import './guide.css'

interface Props {
  load: GuideLoad
  initialFocusId: string | null
  onFocusChange: (id: string) => void
  onOpen: (selection: Selection) => void
  onWatchLive: () => void
  onRetry: () => void
}

const navItems = (group: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-nav="${group}"]:not(:disabled)`))

export default function GuideScreen({ load, initialFocusId, onFocusChange, onOpen, onWatchLive, onRetry }: Props) {
  const now = useNow(15_000)
  const gridRef = useRef<EpgGridHandle>(null)
  const [selected, setSelected] = useState<Programme | null>(null)
  const [hovered, setHovered] = useState<Programme | null>(null)

  const guide = load.state === 'ready' ? load.guide : null
  const channelById = useMemo(() => new Map(guide?.channels.map((c) => [c.id, c])), [guide])

  const select = useCallback(
    (p: Programme) => {
      setSelected(p)
      onFocusChange(p.id)
    },
    [onFocusChange],
  )

  const open = useCallback(
    (p: Programme) => {
      const channel = channelById.get(p.channelId)
      if (channel) onOpen({ channel, programme: p })
    },
    [channelById, onOpen],
  )

  // Arrow keys outside the grid: header row <-> details actions <-> grid.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null
      const group = active?.dataset.nav
      if (active?.dataset.id) return // grid cells handle their own keys

      if (!group) {
        if (e.key.startsWith('Arrow')) {
          e.preventDefault()
          if (gridRef.current) gridRef.current.focus()
          else navItems('header')[0]?.focus()
        }
        return
      }
      const list = navItems(group)
      const i = list.indexOf(active!)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        list[Math.min(list.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))]?.focus()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (group === 'header' && !gridRef.current) navItems('state')[0]?.focus()
        else gridRef.current?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (group !== 'header') navItems('header')[0]?.focus()
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        gridRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Without a grid (loading / error / empty) start focus in the header.
  useEffect(() => {
    if (load.state === 'error') navItems('state')[0]?.focus()
  }, [load.state])

  const shown = hovered ?? selected
  const shownChannel = shown ? channelById.get(shown.channelId) : undefined

  return (
    <div className="guide-screen">
      <AppHeader onGuide={() => gridRef.current?.focus()} onLive={onWatchLive} />

      {guide && guide.channels.length > 0 ? (
        <>
          <div className="details-slot">
            {shown && shownChannel && (
              <DetailsPanel
                programme={shown}
                channel={shownChannel}
                now={now}
                onOpen={() => open(shown)}
                onWatchLive={onWatchLive}
              />
            )}
          </div>
          <EpgGrid
            ref={gridRef}
            guide={guide}
            now={now}
            selectedId={selected?.id ?? initialFocusId}
            onSelect={select}
            onHover={setHovered}
            onOpen={open}
            onExitUp={() => navItems('header')[0]?.focus()}
          />
          <footer className="key-hints" aria-hidden="true">
            <span>
              <kbd>←</kbd>
              <kbd>→</kbd>
              <kbd>↑</kbd>
              <kbd>↓</kbd> Browse
            </span>
            <span>
              <kbd>OK</kbd> Open
            </span>
            <span>
              <kbd>Back</kbd> Return to now
            </span>
            <span className="key-hints-note">
              Schedules are demo data. Only {guide.channels[0].name} has a real stream.
            </span>
          </footer>
        </>
      ) : (
        <div className="guide-state">
          {load.state === 'loading' && (
            <div className="state-card" role="status">
              <span className="spinner" aria-hidden="true" />
              <p className="state-title">Loading the guide</p>
            </div>
          )}
          {load.state === 'error' && (
            <div className="state-card" role="alert">
              <p className="state-title">The guide could not be loaded</p>
              <p className="state-text">{load.message}</p>
              <div className="state-actions">
                <button type="button" data-nav="state" className="btn btn-primary" onClick={onRetry}>
                  <Icon name="retry" />
                  Try again
                </button>
                <button type="button" data-nav="state" className="btn btn-secondary" onClick={onWatchLive}>
                  <span className="status-dot" aria-hidden="true" />
                  Watch live TV
                </button>
              </div>
            </div>
          )}
          {load.state === 'ready' && (
            <div className="state-card">
              <p className="state-title">No programmes scheduled</p>
              <p className="state-text">There is nothing in the guide right now. Live TV is still available.</p>
              <div className="state-actions">
                <button type="button" data-nav="state" className="btn btn-primary" onClick={onWatchLive}>
                  <span className="status-dot" aria-hidden="true" />
                  Watch live TV
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
