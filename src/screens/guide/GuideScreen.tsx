import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GuideLoad, Selection } from '../../App'
import AppHeader from '../../components/AppHeader'
import Icon from '../../components/Icon'
import type { Channel } from '../../data/channels'
import { availabilityOf, phaseOf } from '../../data/epg'
import type { Programme } from '../../data/epg'
import type { ReminderMethods } from '../../data/reminders'
import { useNow } from '../../lib/time'
import DetailsPanel from './DetailsPanel'
import EpgGrid from './EpgGrid'
import type { EpgGridHandle } from './EpgGrid'
import ProgrammeDialog from './ProgrammeDialog'
import type { DialogKind } from './ProgrammeDialog'
import './guide.css'

interface Props {
  load: GuideLoad
  initialFocusId: string | null
  onFocusChange: (id: string) => void
  /** Reminder delivery methods by programme id. */
  reminders: ReadonlyMap<string, ReminderMethods>
  onReminderSaved: (programmeId: string, methods: ReminderMethods) => void
  onReminderRemoved: (programmeId: string) => void
  onOpen: (selection: Selection) => void
  onWatchLive: () => void
  onRetry: () => void
}

type Dialog = { kind: DialogKind; programme: Programme; channel: Channel }

const navItems = (group: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-nav="${group}"]:not(:disabled)`))

export default function GuideScreen({
  load,
  initialFocusId,
  onFocusChange,
  reminders,
  onReminderSaved,
  onReminderRemoved,
  onOpen,
  onWatchLive,
  onRetry,
}: Props) {
  const now = useNow(15_000)
  const gridRef = useRef<EpgGridHandle>(null)
  const [selected, setSelected] = useState<Programme | null>(null)
  const [hovered, setHovered] = useState<Programme | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const dialogOpen = dialog !== null

  const guide = load.state === 'ready' ? load.guide : null
  const channelById = useMemo(() => new Map(guide?.channels.map((c) => [c.id, c])), [guide])

  const select = useCallback(
    (p: Programme) => {
      setSelected(p)
      onFocusChange(p.id)
    },
    [onFocusChange],
  )

  // The details panel's primary action, and OK on a programme. Only what can really play
  // opens the player; the rest explains itself here, without leaving the guide.
  // For a programme that already has a reminder, the button removes it while OK on the
  // grid reopens its settings, so a stray OK never deletes anything.
  const activate = useCallback(
    (p: Programme, from: 'button' | 'grid') => {
      const channel = channelById.get(p.channelId)
      if (!channel) return
      const t = Date.now()
      const show = (kind: DialogKind) => setDialog({ kind, programme: p, channel })
      if (phaseOf(p, t) === 'upcoming') show(from === 'button' && reminders.has(p.id) ? 'remove-reminder' : 'reminder')
      else if (!channel.streamUrl) show('no-stream')
      else if (availabilityOf(p, channel, t) === 'no-recording') show('no-recording')
      else onOpen({ channel, programme: p })
    },
    [channelById, reminders, onOpen],
  )
  const activateFromGrid = useCallback((p: Programme) => activate(p, 'grid'), [activate])

  const closeDialog = useCallback(() => {
    setDialog(null)
    gridRef.current?.focus()
  }, [])

  // Arrow keys outside the grid: header row <-> details actions <-> grid.
  // An open dialog handles its own keys.
  useEffect(() => {
    if (dialogOpen) return
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
  }, [dialogOpen])

  // Without a grid (loading / error / empty) start focus in the header.
  useEffect(() => {
    if (load.state === 'error') navItems('state')[0]?.focus()
  }, [load.state])

  const shown = hovered ?? selected
  const shownChannel = shown ? channelById.get(shown.channelId) : undefined

  return (
    <div className="guide-screen">
      <AppHeader onGuide={() => gridRef.current?.focus()} />

      {guide && guide.channels.length > 0 ? (
        <>
          <div className="details-slot">
            {shown && shownChannel && (
              <DetailsPanel
                programme={shown}
                channel={shownChannel}
                now={now}
                hasReminder={reminders.has(shown.id)}
                onActivate={() => activate(shown, 'button')}
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
            onOpen={activateFromGrid}
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
          {dialog && (
            <ProgrammeDialog
              key={dialog.programme.id}
              kind={dialog.kind}
              programme={dialog.programme}
              channel={dialog.channel}
              reminder={reminders.get(dialog.programme.id) ?? null}
              onReminderSaved={onReminderSaved}
              onReminderRemoved={onReminderRemoved}
              onWatchLive={onWatchLive}
              onClose={closeDialog}
            />
          )}
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
