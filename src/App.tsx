import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import Epg from './components/Epg'
import type { EpgLoad } from './components/Epg'
import Player from './components/Player'
import { CHANNEL, LIVE_URL, fetchSchedule } from './data/epg'
import type { Program } from './data/epg'
import type { Source } from './player/usePlayer'
import { useTvNavigation } from './useTvNavigation'

const LIVE: Source = { kind: 'live', url: LIVE_URL, title: `${CHANNEL.name} · Live` }

export default function App() {
  const [source, setSource] = useState<Source>(LIVE)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [load, setLoad] = useState<EpgLoad>({ state: 'loading' })
  const [now, setNow] = useState(() => Date.now())

  const fetchEpg = useCallback(() => {
    fetchSchedule().then(
      (programs) => setLoad({ state: 'ready', programs }),
      (err: Error) => setLoad({ state: 'error', message: err.message }),
    )
  }, [])

  const retryEpg = useCallback(() => {
    setLoad({ state: 'loading' })
    fetchEpg()
  }, [fetchEpg])

  useEffect(fetchEpg, [fetchEpg])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  // Put focus on the programme that is on air as soon as the guide is ready.
  useEffect(() => {
    if (load.state !== 'ready') return
    const row = document.querySelector<HTMLElement>('[data-nav="epg"][data-current]')
    ;(row ?? document.querySelector<HTMLElement>('[data-nav="epg"]'))?.focus()
  }, [load.state])

  const backToLive = useCallback(() => {
    setSource(LIVE)
    setPlayingId(null)
    setNotice(null)
  }, [])

  useTvNavigation(backToLive)

  const onSelect = useCallback(
    (p: Program) => {
      if (now >= p.start && now < p.end) {
        backToLive()
        setNotice(`Playing "${p.title}" live.`)
      } else if (p.recordingUrl) {
        setSource({ kind: 'recording', url: p.recordingUrl, title: `${p.title} · Sample recording` })
        setPlayingId(p.id)
        setNotice(
          'Prototype note: the provided recording is a 30-second clip. It is not the real content of this mock programme.',
        )
      } else if (p.start > now) {
        setNotice(`"${p.title}" has not started yet.`)
      } else {
        setNotice(`No recording is available for "${p.title}".`)
      }
    },
    [now, backToLive],
  )

  const current = useMemo(
    () => (load.state === 'ready' ? load.programs.find((p) => now >= p.start && now < p.end) : undefined),
    [load, now],
  )

  return (
    <div className="app">
      <header className="header">
        <div className="logo" aria-hidden="true">{CHANNEL.logoText}</div>
        <div>
          <h1>{CHANNEL.name}</h1>
          <p className="sub">{current ? `On air (mock): ${current.title}` : 'Live channel'}</p>
        </div>
      </header>

      <main className="main">
        <div className="left">
          <Player source={source} onBackToLive={backToLive} />
          <p className="notice" role="status">{notice}</p>
        </div>
        <Epg load={load} now={now} playingId={playingId} onSelect={onSelect} onRetry={retryEpg} />
      </main>

      <footer className="hints">
        <span>↑ ↓ Browse guide</span>
        <span>→ Player controls</span>
        <span>← Back to guide</span>
        <span>Enter Select</span>
        <span>Esc Back to live</span>
      </footer>
    </div>
  )
}
