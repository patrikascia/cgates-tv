import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import shaka from 'shaka-player'

// Small, low-bitrate Shaka instances used only for previews. They never touch the
// main player and always use the lowest rendition (360p, ~450 kbit/s on the CGates
// live stream) so a preview costs little bandwidth and decode time.

let polyfilled = false
function supported(): boolean {
  if (!polyfilled) {
    shaka.polyfill.installAll()
    polyfilled = true
  }
  return shaka.Player.isBrowserSupported()
}

function createLowBitratePlayer(forFrames: boolean): shaka.Player {
  const player = new shaka.Player()
  player.configure({
    abr: { enabled: false },
    restrictions: { maxHeight: 360 },
    manifest: { dash: { ignoreMinBufferTime: true } },
    streaming: forFrames
      ? // Frame grabbing seeks around a paused video: fetch as little as possible.
        { bufferingGoal: 2, rebufferingGoal: 0.5, bufferBehind: 8 }
      : { bufferingGoal: 8, rebufferingGoal: 2, bufferBehind: 4 },
  })
  return player
}

type Teardown = Promise<void>

/** Muted, autoplaying live preview (guide details panel). `url` null = no preview. */
export function useMutedPreview(videoRef: RefObject<HTMLVideoElement | null>, url: string | null) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')
  const teardown = useRef<Teardown>(Promise.resolve())

  useEffect(() => {
    const video = videoRef.current
    if (!video || !url) {
      queueMicrotask(() => setStatus('idle'))
      return
    }
    if (!supported()) {
      queueMicrotask(() => setStatus('error'))
      return
    }
    let cancelled = false
    queueMicrotask(() => !cancelled && setStatus('loading'))
    video.muted = true
    const player = createLowBitratePlayer(false)
    const onPlaying = () => !cancelled && setStatus('playing')
    const onError = () => !cancelled && setStatus('error')
    video.addEventListener('playing', onPlaying)
    player.addEventListener('error', onError)

    teardown.current
      .then(() => (cancelled ? undefined : player.attach(video)))
      .then(() => (cancelled ? undefined : player.load(url)))
      .then(() => (cancelled ? undefined : video.play()))
      .catch((err: unknown) => {
        if ((err as shaka.util.Error)?.code === 7000 || cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
      video.removeEventListener('playing', onPlaying)
      player.removeEventListener('error', onError)
      teardown.current = player.destroy().catch(() => {})
    }
  }, [videoRef, url])

  return status
}

export type FrameStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

/**
 * Real frame previews for the scrubber.
 *
 * Neither provided stream carries a DASH thumbnail (image) track, so there are no
 * pre-rendered thumbnails to show. Instead a hidden, paused 360p copy of the same
 * stream is seeked to the hovered time; the <video> element itself then shows the
 * actual decoded frame. Both players load the same manifest, so media times match.
 *
 * Only started once `enabled` turns true (first hover/focus on the scrubber).
 * If the stream cannot be decoded (e.g. DRM without a licence) status becomes
 * 'unavailable' and the caller falls back to time + programme metadata.
 */
export function useFramePreview(
  videoRef: RefObject<HTMLVideoElement | null>,
  url: string | null,
  enabled: boolean,
) {
  const [status, setStatus] = useState<FrameStatus>('idle')
  const [frameTime, setFrameTime] = useState<number | null>(null)
  const playerRef = useRef<shaka.Player | null>(null)
  const target = useRef<number | null>(null)
  const seeking = useRef(false)
  const teardown = useRef<Teardown>(Promise.resolve())

  const seekNext = useCallback(() => {
    const video = videoRef.current
    const player = playerRef.current
    if (!video || !player || target.current === null || seeking.current) return
    const { start, end } = player.seekRange()
    const t = Math.min(end, Math.max(start, target.current))
    if (Math.abs(video.currentTime - t) < 0.5 && video.readyState >= 2) {
      setFrameTime(video.currentTime)
      return
    }
    seeking.current = true
    video.currentTime = t
  }, [videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!enabled || !url || !video) return
    if (!supported()) {
      queueMicrotask(() => setStatus('unavailable'))
      return
    }
    let cancelled = false
    queueMicrotask(() => !cancelled && setStatus('loading'))
    video.muted = true
    const player = createLowBitratePlayer(true)

    const onSeeked = () => {
      seeking.current = false
      if (cancelled) return
      setFrameTime(video.currentTime)
      // The pointer may have moved on while we were seeking: chase the latest target.
      seekNext()
    }
    const onError = () => !cancelled && setStatus('unavailable')
    video.addEventListener('seeked', onSeeked)
    player.addEventListener('error', onError)

    teardown.current
      .then(() => (cancelled ? undefined : player.attach(video)))
      .then(() => (cancelled ? undefined : player.load(url)))
      .then(() => {
        if (cancelled) return
        playerRef.current = player
        setStatus('ready')
        seekNext()
      })
      .catch((err: unknown) => {
        if ((err as shaka.util.Error)?.code === 7000 || cancelled) return
        setStatus('unavailable')
      })

    return () => {
      cancelled = true
      seeking.current = false
      playerRef.current = null
      video.removeEventListener('seeked', onSeeked)
      player.removeEventListener('error', onError)
      teardown.current = player.destroy().catch(() => {})
    }
  }, [videoRef, url, enabled, seekNext])

  const request = useCallback(
    (time: number) => {
      target.current = time
      seekNext()
    },
    [seekNext],
  )

  return { status, frameTime, request }
}
