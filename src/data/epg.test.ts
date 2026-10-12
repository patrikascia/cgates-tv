import { describe, expect, it } from 'vitest'
import { CHANNELS, REAL_CHANNEL } from './channels'
import { availabilityOf, MIN, phaseOf, SAMPLE_RECORDING_URL } from './epg'
import type { Programme } from './epg'

const NOW = new Date(2026, 9, 12, 20, 0).getTime()
const DEMO = CHANNELS.find((c) => !c.streamUrl)!

const programme = (start: number, end: number, recordingUrl?: string): Programme => ({
  id: `p-${start}`,
  channelId: REAL_CHANNEL.id,
  title: 'Evening News',
  description: '',
  category: 'News',
  start,
  end,
  recordingUrl,
})

describe('programme availability', () => {
  it.each([
    ['on air', 'current', 'live', programme(NOW - 30 * MIN, NOW + 30 * MIN)],
    ['starting this instant', 'current', 'live', programme(NOW, NOW + 30 * MIN)],
    ['ending this instant', 'past', 'no-recording', programme(NOW - 30 * MIN, NOW)],
    ['aired, with the sample recording', 'past', 'recording', programme(NOW - 3 * 60 * MIN, NOW - 2 * 60 * MIN, SAMPLE_RECORDING_URL)],
    ['aired, nothing recorded', 'past', 'no-recording', programme(NOW - 3 * 60 * MIN, NOW - 2 * 60 * MIN)],
    ['not aired yet', 'upcoming', 'upcoming', programme(NOW + MIN, NOW + 60 * MIN)],
  ] as const)('real channel, %s: %s / %s', (_, phase, availability, p) => {
    expect(phaseOf(p, NOW)).toBe(phase)
    expect(availabilityOf(p, REAL_CHANNEL, NOW)).toBe(availability)
  })

  it('never offers playback on a demo channel, but keeps its phase for reminders', () => {
    const current = programme(NOW - 30 * MIN, NOW + 30 * MIN)
    const past = programme(NOW - 3 * 60 * MIN, NOW - 2 * 60 * MIN, SAMPLE_RECORDING_URL)
    const upcoming = programme(NOW + MIN, NOW + 60 * MIN)
    for (const p of [current, past, upcoming]) expect(availabilityOf(p, DEMO, NOW)).toBe('demo')
    expect(phaseOf(upcoming, NOW)).toBe('upcoming')
  })
})
