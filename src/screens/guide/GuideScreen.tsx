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
  /** Programme to select and focus on arrival, e.g. the one just watched. */
  initialSelectedId: string | null
  onSelectionChange: (id: string) => void
  /** Reminder delivery methods by programme id. */
  reminders: ReadonlyMap<string, ReminderMethods>
  /** Delivery methods pre-selected for a new reminder: the last ones saved, else Email. */
  preferredMethods: ReminderMethods
  onReminderSaved: (programmeId: string, methods: ReminderMethods) => void
  onReminderRemoved: (programmeId: string) => void
  onOpen: (selection: Selection) => void
  onWatchLive: () => void
  onRetry: () => void
}

type Dialog = { kind: DialogKind; programme: Programme; channel: Channel }

const navItems = (group: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-nav="${group}"]:not(:disabled)`))

// Arrow keys run one vertical path: header -> preview card action -> programme grid.
const focusAction = () => {
  const el = navItems('details')[0] ?? navItems('header')[0]
  el?.focus()
}

type Zone = 'grid' | 'details' | 'other'

export default function GuideScreen({
  load,
  initialSelectedId,
  onSelectionChange,
  reminders,
  preferredMethods,
  onReminderSaved,
  onReminderRemoved,
  onOpen,
  onWatchLive,
  onRetry,
}: Props) {
  const now = useNow(15_000)
  const gridRef = useRef<EpgGridHandle>(null)
  // Three separate targets: keyboard focus, mouse hover and the confirmed selection.
  const [focusedId, setFocusedId] = useState<string | null>(initialSelectedId)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId)
  const [hovered, setHovered] = useState<Programme | null>(null)
  // Which input the user is using right now, and where focus is. Together they decide
  // which programme the preview card shows.
  const [input, setInput] = useState<'keyboard' | 'pointer'>('keyboard')
  const [zone, setZone] = useState<Zone>('grid')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const dialogOpen = dialog !== null

  const guide = load.state === 'ready' ? load.guide : null
  const channelById = useMemo(() => new Map(guide?.channels.map((c) => [c.id, c])), [guide])
  const programmeById = useMemo(
    () => new Map(Object.values(guide?.programmes ?? {}).flatMap((list) => list.map((p) => [p.id, p]))),
    [guide],
  )

  const focusProgramme = useCallback((p: Programme) => setFocusedId(p.id), [])
  const select = useCallback(
    (p: Programme) => {
      setSelectedId(p.id)
      onSelectionChange(p.id)
    },
    [onSelectionChange],
  )

  useEffect(() => {
    const onKey = () => setInput('keyboard')
    // Only real pointer movement counts: browsers also send pointer events when the
    // grid scrolls under a resting cursor, which must not take over from the keyboard.
    let lastX = NaN
    let lastY = NaN
    const onMove = (e: PointerEvent) => {
      if (e.clientX === lastX && e.clientY === lastY) return
      lastX = e.clientX
      lastY = e.clientY
      setInput('pointer')
    }
    const onDown = () => setInput('pointer')
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement
      setZone(t.dataset?.id ? 'grid' : t.dataset?.nav === 'details' ? 'details' : 'other')
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerdown', onDown, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [])

  // A programme's primary action, from the preview card's button or a click on the
  // programme. Only what can really play opens the player; the rest explains itself here.
  // With a reminder already set, the button removes it while a click on the programme
  // reopens its settings, so a click never deletes anything.
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
  const confirm = useCallback(
    (p: Programme) => {
      select(p)
      focusAction()
    },
    [select],
  )

  // Closing a dialog returns focus to its programme in the grid (the selected one), which
  // also keeps that programme in the preview card.
  const closeDialog = useCallback((p: Programme) => {
    setDialog(null)
    gridRef.current?.focus(p.id)
  }, [])

  // Arrow keys outside the grid: header row <-> details actions <-> grid.
  // An open dialog handles its own keys.
  useEffect(() => {
    if (dialogOpen) return
    const onKey = (e: KeyboardEvent) => {
      // Already handled, e.g. by the grid, which may have just moved focus out of itself.
      if (e.defaultPrevented) return
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
        else if (group === 'header' && navItems('details').length) focusAction()
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

  // The preview card shows, in order: the hovered programme (only while the mouse is in
  // use and the card's own button is not focused), the keyboard-focused programme while
  // focus is in the grid, then the confirmed selection. Its button always acts on it.
  const focused = focusedId ? programmeById.get(focusedId) : undefined
  const selected = selectedId ? programmeById.get(selectedId) : undefined
  const hover = input === 'pointer' && zone !== 'details' ? hovered : null
  const shown = hover ?? (zone === 'grid' ? focused : undefined) ?? selected ?? focused ?? null
  const shownChannel = shown ? channelById.get(shown.channelId) : undefined

  return (
    <div className="guide-screen" data-input={input}>
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
            focusedId={focusedId}
            selectedId={selectedId}
            onFocusProgramme={focusProgramme}
            onSelect={select}
            onHover={setHovered}
            onOpen={activateFromGrid}
            onConfirm={confirm}
            onExitUp={focusAction}
          />
          <footer className="guide-footer">
            Schedules are demo data. Only {guide.channels[0].name} has a real stream.
          </footer>
          {dialog && (
            <ProgrammeDialog
              key={dialog.programme.id}
              kind={dialog.kind}
              programme={dialog.programme}
              channel={dialog.channel}
              reminder={reminders.get(dialog.programme.id) ?? null}
              preferredMethods={preferredMethods}
              onReminderSaved={onReminderSaved}
              onReminderRemoved={onReminderRemoved}
              onWatchLive={onWatchLive}
              onClose={() => closeDialog(dialog.programme)}
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
