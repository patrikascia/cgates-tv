import type { Channel } from '../../data/channels'
import { phaseOf } from '../../data/epg'
import type { Guide, Programme } from '../../data/epg'

// MOCK PICKS for the "Recommended to you" and "Popular now" panels. There is no
// personalisation service and no viewing data: both are fixed picks from the guide's own
// (demo) schedule, chosen by simple rules, not by anything about the user or audiences.

export interface Recommended {
  programme: Programme
  channel: Channel
  /** On now ("Watch now" in the EPG); otherwise already aired ("Watch recording"). */
  onNow: boolean
}

const MAX_ON_NOW = 7 // leave room for aired programmes
const PER_CHANNEL = 2 // aired picks per channel, to keep the list varied

/**
 * Up to `count` programmes whose EPG button is "Watch now" (on now) or "Watch recording"
 * (already aired); never upcoming ones. On now comes first, in channel order (real
 * stream first). Then aired programmes: those with an actual recording first, then the
 * most recently ended, at most two per channel.
 */
export function pickRecommended(guide: Guide, now: number, count = 15): Recommended[] {
  const onNow: Recommended[] = []
  const aired: Recommended[] = []
  for (const channel of guide.channels) {
    for (const programme of guide.programmes[channel.id] ?? []) {
      const phase = phaseOf(programme, now)
      if (phase === 'current') onNow.push({ programme, channel, onNow: true })
      else if (phase === 'past') aired.push({ programme, channel, onNow: false })
    }
  }
  onNow.sort((a, b) => Number(!a.channel.streamUrl) - Number(!b.channel.streamUrl) || a.channel.number - b.channel.number)
  aired.sort(
    (a, b) =>
      Number(!a.programme.recordingUrl) - Number(!b.programme.recordingUrl) || b.programme.end - a.programme.end,
  )
  const picks = onNow.slice(0, Math.min(MAX_ON_NOW, count))
  const perChannel = new Map<string, number>()
  for (const r of aired) {
    if (picks.length >= count) break
    const n = perChannel.get(r.channel.id) ?? 0
    if (n >= PER_CHANNEL) continue
    perChannel.set(r.channel.id, n + 1)
    picks.push(r)
  }
  return picks
}

// Stable pseudo-random score in [0, 1) from a string (FNV-1a). Same programme, same score.
function mockScore(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}

/**
 * Up to `count` eligible programmes in a MOCK popularity order. Eligible: on now (EPG
 * button "Watch now"), or already aired with an actual recording (EPG "Watch recording"
 * that plays). Upcoming programmes and aired ones without a recording are excluded. The
 * order is a deterministic score per programme, not viewing figures.
 */
export function pickPopular(guide: Guide, now: number, count = 10): Recommended[] {
  const eligible: Recommended[] = []
  for (const channel of guide.channels) {
    for (const programme of guide.programmes[channel.id] ?? []) {
      const phase = phaseOf(programme, now)
      if (phase === 'current') eligible.push({ programme, channel, onNow: true })
      else if (phase === 'past' && programme.recordingUrl) eligible.push({ programme, channel, onNow: false })
    }
  }
  return eligible
    .map((r) => ({ r, score: mockScore(r.programme.id) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ r }) => r)
}
