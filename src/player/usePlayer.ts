import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import shaka from 'shaka-player'
import type { Channel } from '../data/channels'
import { availabilityOf } from '../data/epg'
import type { Availability, Programme } from '../data/epg'

export type SourceKind = 'live' | 'recording'

export interface Source {
  kind: SourceKind
  url: string
  title: string
}

/** What the player can do for a channel or programme: play a source, or say why it can't. */
export type PlaybackPlan = { source: Source } | { unavailable: Availability }

/** Decides playback for a selection (`programme` null = the channel's live feed). */
export function playbackFor(channel: Channel, programme: Programme | null, now: number): PlaybackPlan {
  const mode = programme ? availabilityOf(programme, channel, now) : channel.streamUrl ? 'live' : 'demo'
  if (mode === 'live' && channel.streamUrl) {
    return { source: { kind: 'live', url: channel.streamUrl, title: channel.name } }
  }
  if (mode === 'recording' && programme?.recordingUrl) {
    return { source: { kind: 'recording', url: programme.recordingUrl, title: programme.title } }
  }
  return { unavailable: mode }
}

export type PlayerStatus = 'loading' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error'

export interface PlayerError {
  title: string
  detail: string
}

/** An audio language the stream offers (one per language + role). */
export interface AudioOption {
  key: string
  language: string
  role: string
  label: string | null
  active: boolean
}

/** A subtitle / caption track the stream offers. */
export interface TextOption {
  id: number
  language: string
  label: string | null
  active: boolean
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
  /** Tracks as reported by Shaka for the current stream (empty until it has loaded). */
  audio: AudioOption[]
  text: TextOption[]
  textVisible: boolean
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
  audio: [],
  text: [],
  textVisible: false,
}

const audioKey = (t: shaka.extern.AudioTrack) => `${t.language}|${t.label ?? ''}`

/**
 * Audio and subtitle options exactly as the stream (Shaka) reports them right now. A
 * language offered in several codecs or channel layouts is one option for the user.
 */
function readTracks(player: shaka.Player) {
  const byKey = new Map<string, AudioOption>()
  for (const t of player.getAudioTracks()) {
    const key = audioKey(t)
    const option = byKey.get(key) ?? { key, language: t.language, role: t.roles[0] ?? '', label: t.label, active: false }
    option.active ||= t.active
    byKey.set(key, option)
  }
  const text: TextOption[] = player.getTextTracks().map((t) => ({
    id: t.id,
    language: t.language,
    label: t.label,
    active: t.active,
  }))
  return { audio: [...byKey.values()], text, textVisible: text.some((t) => t.active) }
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
export function describeError(err: unknown, kind: SourceKind): PlayerError {
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

    // Track lists and the active selections, refreshed whenever Shaka reports a change.
    const syncTracks = () => {
      if (!cancelled) setState((s) => ({ ...s, ...readTracks(player) }))
    }
    const trackEvents = ['trackschanged', 'variantchanged', 'audiotrackschanged', 'audiotrackchanged', 'textchanged', 'adaptation']
    for (const ev of trackEvents) player.addEventListener(ev, syncTracks)

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
        syncTracks()
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
      for (const ev of trackEvents) player.removeEventListener(ev, syncTracks)
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

  // Track selection. The UI reflects what Shaka reports afterwards (its track events), so a
  // change the stream does not support is never shown as applied.
  // Subtitle language chosen last, so switching subtitles back on restores it.
  const lastTextId = useRef<number | null>(null)

  const selectAudio = useCallback((option: AudioOption) => {
    const p = playerRef.current
    if (!p) return
    const tracks = p.getAudioTracks()
    const current = tracks.find((t) => t.active)
    const candidates = tracks.filter((t) => audioKey(t) === option.key)
    // Prefer the same codec as now, so only the language changes.
    const track = candidates.find((t) => t.codecs === current?.codecs) ?? candidates[0]
    if (track && !track.active) p.selectAudioTrack(track)
  }, [])

  // Shaka 5: a selected text track is shown; selecting none turns subtitles off.
  const setSubtitles = useCallback((on: boolean) => {
    const p = playerRef.current
    if (!p) return
    if (!on) {
      p.selectTextTrack(null)
      return
    }
    const tracks = p.getTextTracks()
    const track = tracks.find((t) => t.id === lastTextId.current) ?? tracks[0]
    if (track) p.selectTextTrack(track)
  }, [])

  const selectSubtitle = useCallback((option: TextOption) => {
    const p = playerRef.current
    const track = p?.getTextTracks().find((t) => t.id === option.id)
    if (!p || !track) return
    lastTextId.current = track.id
    p.selectTextTrack(track)
  }, [])

  return {
    state,
    togglePlay,
    seekBy,
    seekTo,
    goToLiveEdge,
    changeVolume,
    setVolume,
    toggleMute,
    retry,
    selectAudio,
    setSubtitles,
    selectSubtitle,
  }
}
