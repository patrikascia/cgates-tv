import { useCallback, useEffect, useState } from 'react'
import { REAL_CHANNEL } from './data/channels'
import type { Channel } from './data/channels'
import { fetchGuide } from './data/epg'
import type { Guide, Programme } from './data/epg'
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
  // Remembered so the guide restores focus to where the user left it.
  const [lastFocusId, setLastFocusId] = useState<string | null>(null)

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

  const openPlayer = useCallback((selection: Selection) => {
    if (selection.programme) setLastFocusId(selection.programme.id)
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
      initialFocusId={lastFocusId}
      onFocusChange={setLastFocusId}
      onOpen={openPlayer}
      onWatchLive={openLive}
      onRetry={retryGuide}
    />
  )
}
