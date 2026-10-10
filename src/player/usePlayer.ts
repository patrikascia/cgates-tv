import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import shaka from 'shaka-player'

export type SourceKind = 'live' | 'recording'

export interface Source {
  kind: SourceKind
  url: string
  title: string
}

export type PlayerStatus = 'loading' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error'

export interface PlayerError {
  title: string
  detail: string
}

export interface PlayerState {
  status: PlayerStatus
  error: PlayerError | null
  currentTime: number
  rangeStart: number
  rangeEnd: number
  volume: number
  muted: boolean
  /** Wall-clock time (ms) of media time 0, when the stream exposes one (live DASH). */
  presentationStart: number | null
}

const INITIAL: PlayerState = {
  status: 'loading',
  error: null,
  currentTime: 0,
  rangeStart: 0,
  rangeEnd: 0,
  volume: 1,
  muted: false,
  presentationStart: null,
}

function describeError(err: unknown, kind: SourceKind): PlayerError {
  const e = err as shaka.util.Error
  const label = kind === 'live' ? 'live stream' : 'recording'
  if (e?.category === shaka.util.Error.Category.DRM) {
    return {
      title: 'This recording is copy-protected',
      detail:
        'The stream uses Widevine DRM. No licence server was provided for this prototype, ' +
        'or this browser cannot play Widevine (try Chrome or Edge). ' +
        `Technical code: ${e.code}.`,
    }
  }
  if (e?.category === shaka.util.Error.Category.NETWORK) {
    return {
      title: `Could not reach the ${label}`,
      detail: `Check your internet connection. The server may also be blocking this request. Technical code: ${e.code}.`,
    }
  }
  if (e?.category === shaka.util.Error.Category.MANIFEST) {
    return {
      title: `The ${label} could not be read`,
      detail: `The stream description is missing or invalid. Technical code: ${e.code}.`,
    }
  }
  return {
    title: `The ${label} could not be played`,
    detail: e?.code ? `Technical code: ${e.code}.` : String((err as Error)?.message ?? err),
  }
}

export function usePlayer(videoRef: RefObject<HTMLVideoElement | null>, source: Source) {
  const [state, setState] = useState<PlayerState>(INITIAL)
  const [attempt, setAttempt] = useState(0)
  const playerRef = useRef<shaka.Player | null>(null)
  // Destroying a Shaka player is async. The next player must wait for it, otherwise the
  // old player can detach the <video> after the new one has attached.
  const teardownRef = useRef<Promise<void>>(Promise.resolve())

  const patch = useCallback((p: Partial<PlayerState>) => setState((s) => ({ ...s, ...p })), [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let cancelled = false

    shaka.polyfill.installAll()
    if (!shaka.Player.isBrowserSupported()) {
      // deferred so we do not call setState synchronously inside the effect
      queueMicrotask(() =>
        patch({
          status: 'error',
          error: {
            title: 'This browser cannot play the stream',
            detail: 'Please use a recent version of Chrome, Edge or Firefox.',
          },
        }),
      )
      return
    }

    const player = new shaka.Player()
    playerRef.current = player
    queueMicrotask(() => {
      if (!cancelled) setState((s) => ({ ...INITIAL, volume: s.volume, muted: s.muted }))
    })

    const sync = () => {
      if (cancelled) return
      const range = player.seekRange()
      const start = player.isLive() ? player.getPresentationStartTimeAsDate() : null
      setState((s) => ({
        ...s,
        currentTime: video.currentTime,
        rangeStart: range.start,
        rangeEnd: range.end,
        volume: video.volume,
        muted: video.muted,
        presentationStart: start ? start.getTime() : null,
      }))
    }

    // A stream that neither plays nor fails must not leave the user on a spinner forever.
    const loadTimeout = window.setTimeout(() => {
      if (cancelled || video.readyState >= 3) return
      patch({
        status: 'error',
        error: {
          title: `The ${source.kind === 'live' ? 'live stream' : 'recording'} is not responding`,
          detail:
            source.kind === 'recording'
              ? 'Playback did not start within 20 seconds. Protected recordings need a DRM licence, which this prototype does not have.'
              : 'Playback did not start within 20 seconds. Check your connection and try again.',
        },
      })
    }, 20_000)

    const onPlaying = () => {
      window.clearTimeout(loadTimeout)
      patch({ status: 'playing' })
    }
    const onSeeked = () => sync()
    const onPause = () => !video.ended && patch({ status: 'paused' })
    const onWaiting = () => patch({ status: 'buffering' })
    const onEnded = () => patch({ status: 'ended' })
    const onShakaError = (e: Event) =>
      patch({ status: 'error', error: describeError((e as CustomEvent).detail, source.kind) })

    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('ended', onEnded)
    video.addEventListener('volumechange', sync)
    video.addEventListener('seeked', onSeeked)
    player.addEventListener('error', onShakaError)
    const timer = window.setInterval(sync, 500)

    teardownRef.current
      .then(() => (cancelled ? undefined : player.attach(video)))
      .then(() => (cancelled ? undefined : player.load(source.url)))
      .then(() => {
        if (cancelled) return
        sync()
        // Browsers may block autoplay with sound. If so we stay paused and say so.
        return video.play().catch(() => patch({ status: 'paused' }))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // 7000 = LOAD_INTERRUPTED (we switched source), not a real failure.
        if ((err as shaka.util.Error)?.code === 7000) return
        patch({ status: 'error', error: describeError(err, source.kind) })
      })

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.clearTimeout(loadTimeout)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('volumechange', sync)
      video.removeEventListener('seeked', onSeeked)
      player.removeEventListener('error', onShakaError)
      playerRef.current = null
      teardownRef.current = player.destroy().catch(() => {})
    }
  }, [source.url, source.kind, videoRef, patch, attempt])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play().catch(() => {})
    else v.pause()
  }, [videoRef])

  const seekBy = useCallback(
    (seconds: number) => {
      const v = videoRef.current
      const p = playerRef.current
      if (!v || !p) return
      const { start, end } = p.seekRange()
      v.currentTime = Math.min(end, Math.max(start, v.currentTime + seconds))
    },
    [videoRef],
  )

  const seekTo = useCallback(
    (time: number) => {
      const v = videoRef.current
      const p = playerRef.current
      if (!v || !p) return
      const { start, end } = p.seekRange()
      v.currentTime = Math.min(end, Math.max(start, time))
    },
    [videoRef],
  )

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const goToLiveEdge = useCallback(() => {
    playerRef.current?.goToLive()
  }, [])

  const changeVolume = useCallback(
    (delta: number) => {
      const v = videoRef.current
      if (!v) return
      v.volume = Math.min(1, Math.max(0, Math.round((v.volume + delta) * 10) / 10))
      if (v.volume > 0) v.muted = false
    },
    [videoRef],
  )

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (v) v.muted = !v.muted
  }, [videoRef])

  const setVolume = useCallback(
    (value: number) => {
      const v = videoRef.current
      if (!v) return
      v.volume = Math.min(1, Math.max(0, value))
      v.muted = v.volume === 0
    },
    [videoRef],
  )

  return { state, togglePlay, seekBy, seekTo, goToLiveEdge, changeVolume, setVolume, toggleMute, retry }
}
