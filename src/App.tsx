import { useCallback, useEffect, useState } from 'react'
import { REAL_CHANNEL } from './data/channels'
import type { Channel } from './data/channels'
import { fetchGuide } from './data/epg'
import type { Guide, Programme } from './data/epg'
import { DEFAULT_METHODS } from './data/reminders'
import type { ReminderMethods } from './data/reminders'
import type { CategoryFilter } from './screens/guide/CategoryFilters'
import GuideScreen from './screens/guide/GuideScreen'
import PlayerScreen from './screens/player/PlayerScreen'

export type GuideLoad = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; guide: Guide }

/** What the player screen was opened for. `programme` null = the channel's live feed. */
export interface Selection {
  channel: Channel
  programme: Programme | null
}

type Screen = { name: 'guide' } | { name: 'player'; selection: Selection }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'guide' })
  const [load, setLoad] = useState<GuideLoad>({ state: 'loading' })
  // Remembered so the guide restores the selection (and focus) to where the user left it.
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  // Guide category filter, kept here so it survives a trip to the player.
  const [category, setCategory] = useState<CategoryFilter>('all')
  // Reminder delivery methods by programme id. Prototype: kept in memory only, see data/reminders.ts.
  const [reminders, setReminders] = useState<ReadonlyMap<string, ReminderMethods>>(() => new Map())
  // The last saved delivery methods become the default for the next new reminder.
  const [preferredMethods, setPreferredMethods] = useState<ReminderMethods>(DEFAULT_METHODS)
  const saveReminder = useCallback((id: string, methods: ReminderMethods) => {
    setReminders((prev) => new Map(prev).set(id, methods))
    setPreferredMethods(methods)
  }, [])
  const removeReminder = useCallback(
    (id: string) =>
      setReminders((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      }),
    [],
  )

  const loadGuide = useCallback(() => {
    fetchGuide().then(
      (guide) => setLoad({ state: 'ready', guide }),
      (err: Error) => setLoad({ state: 'error', message: err.message }),
    )
  }, [])

  const retryGuide = useCallback(() => {
    setLoad({ state: 'loading' })
    loadGuide()
  }, [loadGuide])

  useEffect(loadGuide, [loadGuide])

  // A held Enter / Space auto-repeats. Only the first press may activate anything, or one
  // long press would open a dialog and then also press the button that receives focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // keepSelection: play without making it the guide's selection (e.g. from the
  // "Recommended to you" panel), so the guide is unchanged on return.
  const openPlayer = useCallback((selection: Selection, options?: { keepSelection?: boolean }) => {
    if (selection.programme && !options?.keepSelection) setLastSelectedId(selection.programme.id)
    setScreen({ name: 'player', selection })
  }, [])

  const openLive = useCallback(() => openPlayer({ channel: REAL_CHANNEL, programme: null }), [openPlayer])
  const backToGuide = useCallback(() => setScreen({ name: 'guide' }), [])

  if (screen.name === 'player') {
    return (
      <PlayerScreen
        // A new selection is a new playback session.
        key={`${screen.selection.channel.id}:${screen.selection.programme?.id ?? 'live'}`}
        selection={screen.selection}
        guide={load.state === 'ready' ? load.guide : null}
        onBack={backToGuide}
        onWatchLive={openLive}
      />
    )
  }

  return (
    <GuideScreen
      load={load}
      initialSelectedId={lastSelectedId}
      onSelectionChange={setLastSelectedId}
      category={category}
      onCategoryChange={setCategory}
      reminders={reminders}
      preferredMethods={preferredMethods}
      onReminderSaved={saveReminder}
      onReminderRemoved={removeReminder}
      onOpen={openPlayer}
      onWatchLive={openLive}
      onRetry={retryGuide}
    />
  )
}
