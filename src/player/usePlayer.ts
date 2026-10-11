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

// Licence server for Widevine-protected streams (the recordings). None was provided for
// this prototype, so it is empty and protected recordings cannot be decrypted. Set it in
// .env.local once CGates supplies one; see README.
const WIDEVINE_LICENSE_URL: string = import.meta.env.VITE_WIDEVINE_LICENSE_URL ?? ''

const { Code, Category } = shaka.util.Error

/** "Shaka error 6012 (NO_LICENSE_SERVER_GIVEN)" */
function technical(e: shaka.util.Error): string {
  const name = Object.entries(Code).find(([, v]) => v === e.code)?.[0]
  return `Shaka error ${e.code}${name ? ` (${name})` : ''}`
}

/** HTTP status from a network error, also when it is nested in a DRM licence error. */
function httpStatus(e: shaka.util.Error | undefined): number | null {
  if (!e) return null
  if (e.code === Code.BAD_HTTP_STATUS && typeof e.data?.[1] === 'number') return e.data[1]
  return e.data?.[0] instanceof shaka.util.Error ? httpStatus(e.data[0]) : null
}

/** Turns a Shaka error into a message that names the actual cause. */
function describeError(err: unknown, kind: SourceKind): PlayerError {
  const e = err as shaka.util.Error
  const label = kind === 'live' ? 'live stream' : 'recording'
  if (!(e instanceof shaka.util.Error)) {
    return { title: `The ${label} could not be played`, detail: String((err as Error)?.message ?? err) }
  }
  const tech = technical(e)
  const status = httpStatus(e)
  if (e.category === Category.DRM) {
    if (e.code === Code.NO_LICENSE_SERVER_GIVEN) {
      return {
        title: `This ${label} is copy-protected`,
        detail: `It is encrypted with Widevine DRM, and no licence server is configured for this app, so it cannot be decrypted. ${tech}.`,
      }
    }
    if (e.code === Code.REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE || e.code === Code.MISSING_EME_SUPPORT) {
      return {
        title: `This browser cannot decrypt the ${label}`,
        detail: `It is encrypted with Widevine DRM, which this browser does not offer (Chrome, Edge and Firefox do; Safari does not). A licence server is also required. ${tech}.`,
      }
    }
    if (e.code === Code.LICENSE_REQUEST_FAILED) {
      return {
        title: 'The licence server refused the request',
        detail: `The ${label} could not be decrypted${status ? ` (HTTP ${status})` : ''}. The licence server may require authorisation. ${tech}.`,
      }
    }
    return { title: `The ${label} could not be decrypted`, detail: `${tech}.` }
  }
  if (e.category === Category.NETWORK) {
    return {
      title: `Could not load the ${label}`,
      detail: `${status ? `The server answered HTTP ${status}. ` : 'Check your internet connection; the server may also be blocking this request. '}${tech}.`,
    }
  }
  if (e.category === Category.MANIFEST) {
    return { title: `The ${label} could not be read`, detail: `The stream description is missing or invalid. ${tech}.` }
  }
  return { title: `The ${label} could not be played`, detail: `${tech}.` }
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
    if (WIDEVINE_LICENSE_URL) player.configure({ drm: { servers: { 'com.widevine.alpha': WIDEVINE_LICENSE_URL } } })
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
    // This only covers silent stalls: any real error cancels it and is shown as is.
    const loadTimeout = window.setTimeout(() => {
      if (cancelled || video.readyState >= 3) return
      setState((s) =>
        s.status === 'error'
          ? s
          : {
              ...s,
              status: 'error',
              error: {
                title: `The ${source.kind === 'live' ? 'live stream' : 'recording'} is not responding`,
                detail: 'Playback did not start within 20 seconds and the player reported no error. Check your connection and try again.',
              },
            },
      )
    }, 20_000)
    const fail = (err: unknown) => {
      window.clearTimeout(loadTimeout)
      patch({ status: 'error', error: describeError(err, source.kind) })
    }

    const onPlaying = () => {
      window.clearTimeout(loadTimeout)
      patch({ status: 'playing' })
    }
    const onSeeked = () => sync()
    const onPause = () => !video.ended && patch({ status: 'paused' })
    const onWaiting = () => patch({ status: 'buffering' })
    const onEnded = () => patch({ status: 'ended' })
    const onShakaError = (e: Event) => fail((e as CustomEvent).detail)

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
        if ((err as shaka.util.Error)?.code === Code.LOAD_INTERRUPTED) return
        fail(err)
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
