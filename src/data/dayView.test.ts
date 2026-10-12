import { describe, expect, it } from 'vitest'
import { startOfDay } from '../lib/time'
import { REAL_CHANNEL } from './channels'
import { buildGuide, dayView, MIN } from './epg'
import type { Guide, Programme } from './epg'

const HOUR = 60 * MIN
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime()

const programme = (title: string, start: number, end: number): Programme => ({
  id: title,
  channelId: REAL_CHANNEL.id,
  title,
  description: '',
  category: 'Film',
  start,
  end,
})

const titles = (g: Guide) => g.programmes[REAL_CHANNEL.id].map((p) => p.title)

describe('day switching and midnight', () => {
  it('computes each selectable day as local midnight to midnight, also across a DST change', () => {
    const now = at(12, 15, 30)
    expect(startOfDay(now, -1)).toBe(at(11, 0))
    expect(startOfDay(now, 0)).toBe(at(12, 0))
    expect(startOfDay(now, 1)).toBe(at(13, 0))

    // Clocks go back on 25 October 2026 in Vilnius: that day has 25 hours.
    const dstDay = at(25, 12)
    expect(startOfDay(dstDay, 1) - startOfDay(dstDay, 0)).toBe(25 * HOUR)
    expect(new Date(startOfDay(dstDay, 1)).getHours()).toBe(0)
  })

  it('shows a programme crossing midnight on both days, and nothing that only touches midnight', () => {
    const midnight = at(13, 0)
    const guide: Guide = {
      channels: [REAL_CHANNEL],
      programmes: {
        [REAL_CHANNEL.id]: [
          programme('Ends at midnight', midnight - HOUR, midnight),
          programme('Late Film', midnight - 30 * MIN, midnight + 90 * MIN),
          programme('Starts at midnight', midnight, midnight + HOUR),
        ].sort((a, b) => a.start - b.start),
      },
      windowStart: at(11, 0),
      windowEnd: at(14, 0),
    }

    const today = dayView(guide, at(12, 0), midnight)
    const tomorrow = dayView(guide, midnight, at(14, 0))
    expect(titles(today)).toEqual(['Ends at midnight', 'Late Film'])
    expect(titles(tomorrow)).toEqual(['Late Film', 'Starts at midnight'])
    expect(tomorrow.windowStart).toBe(midnight)
    expect(tomorrow.windowEnd).toBe(at(14, 0))
  })

  it('builds one continuous schedule, so every channel fills each day with the same programme at midnight', () => {
    const now = at(12, 15, 30)
    const guide = buildGuide(now)
    expect(guide.windowStart).toBe(startOfDay(now, -1))
    expect(guide.windowEnd).toBe(startOfDay(now, 2))

    let crossings = 0
    for (const offset of [-1, 0] as const) {
      const midnight = startOfDay(now, offset + 1)
      const day = dayView(guide, startOfDay(now, offset), midnight)
      const next = dayView(guide, midnight, startOfDay(now, offset + 2))
      for (const c of guide.channels) {
        const last = day.programmes[c.id].at(-1)!
        const first = next.programmes[c.id][0]
        expect(day.programmes[c.id][0].start).toBeLessThanOrEqual(day.windowStart)
        expect(last.end).toBeGreaterThanOrEqual(midnight)
        expect(first.start).toBeLessThanOrEqual(midnight)
        if (last.end > midnight) {
          expect(first).toBe(last)
          crossings++
        }
      }
    }
    expect(crossings).toBeGreaterThan(0)
  })
})
