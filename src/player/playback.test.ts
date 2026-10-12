// @vitest-environment jsdom
import shaka from 'shaka-player'
import { describe, expect, it } from 'vitest'
import { CHANNELS, LIVE_URL, REAL_CHANNEL } from '../data/channels'
import { MIN, SAMPLE_RECORDING_URL } from '../data/epg'
import type { Programme } from '../data/epg'
import { describeError, playbackFor } from './usePlayer'

const NOW = new Date(2026, 9, 12, 20, 0).getTime()
const DEMO = CHANNELS.find((c) => !c.streamUrl)!
const { Category, Code, Severity } = shaka.util.Error

const programme = (start: number, end: number, recordingUrl?: string): Programme => ({
  id: `p-${start}`,
  channelId: REAL_CHANNEL.id,
  title: 'Feature Film',
  description: '',
  category: 'Film',
  start,
  end,
  recordingUrl,
})

describe('playback availability and errors', () => {
  it('plays only what really exists, and says why everything else cannot play', () => {
    const live = { kind: 'live', url: LIVE_URL, title: REAL_CHANNEL.name }
    expect(playbackFor(REAL_CHANNEL, null, NOW)).toEqual({ source: live })
    expect(playbackFor(REAL_CHANNEL, programme(NOW - 30 * MIN, NOW + 30 * MIN), NOW)).toEqual({ source: live })

    const recorded = programme(NOW - 3 * 60 * MIN, NOW - 2 * 60 * MIN, SAMPLE_RECORDING_URL)
    expect(playbackFor(REAL_CHANNEL, recorded, NOW)).toEqual({
      source: { kind: 'recording', url: SAMPLE_RECORDING_URL, title: 'Feature Film' },
    })

    expect(playbackFor(REAL_CHANNEL, programme(NOW - 3 * 60 * MIN, NOW - 2 * 60 * MIN), NOW)).toEqual({
      unavailable: 'no-recording',
    })
    expect(playbackFor(REAL_CHANNEL, programme(NOW + MIN, NOW + 60 * MIN), NOW)).toEqual({ unavailable: 'upcoming' })
    expect(playbackFor(DEMO, null, NOW)).toEqual({ unavailable: 'demo' })
    expect(playbackFor(DEMO, recorded, NOW)).toEqual({ unavailable: 'demo' })
  })

  it('names the real cause of a playback error', () => {
    const httpError = (status: number) =>
      new shaka.util.Error(Severity.CRITICAL, Category.NETWORK, Code.BAD_HTTP_STATUS, 'https://example.test', status)

    const noLicence = describeError(
      new shaka.util.Error(Severity.CRITICAL, Category.DRM, Code.NO_LICENSE_SERVER_GIVEN),
      'recording',
    )
    expect(noLicence.title).toBe('This recording is copy-protected')
    expect(noLicence.detail).toContain('no licence server is configured')
    expect(noLicence.detail).toContain(`Shaka error ${Code.NO_LICENSE_SERVER_GIVEN} (NO_LICENSE_SERVER_GIVEN)`)

    const refused = describeError(
      new shaka.util.Error(Severity.CRITICAL, Category.DRM, Code.LICENSE_REQUEST_FAILED, httpError(403)),
      'recording',
    )
    expect(refused.title).toBe('The licence server refused the request')
    expect(refused.detail).toContain('(HTTP 403)')

    const network = describeError(httpError(404), 'live')
    expect(network.title).toBe('Could not load the live stream')
    expect(network.detail).toContain('The server answered HTTP 404.')

    expect(describeError(new Error('Video element missing'), 'live')).toEqual({
      title: 'The live stream could not be played',
      detail: 'Video element missing',
    })
  })
})
