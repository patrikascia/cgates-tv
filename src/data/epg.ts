// MOCK DATA. No real EPG API was provided, so every schedule is generated locally.
// Titles, times and descriptions are invented — including for the one real channel,
// whose actual programming is unknown.

import { CHANNELS, REAL_CHANNEL } from './channels'
import type { Channel, Genre } from './channels'

// The provided recording URL is relative: it always points at a 30s window that aired
// 9873s..9843s (~2h44m) ago. It is not tied to any programme, so we attach it to
// whichever mock programme of the real channel was on air at that moment.
const SAMPLE_RECORDING_OFFSET_SEC = 9858 // middle of the window
export const SAMPLE_RECORDING_URL =
  'https://tr.cdvr.cdn.cgates.lt/dash-wv/cdvr-jitp-enc/eid/560407/rid-TID~560407~now-9873s~now-9843s~dynamic__variant-default.mpd'

export interface Programme {
  id: string
  channelId: string
  title: string
  description: string
  category: string
  start: number // ms since epoch
  end: number
  recordingUrl?: string
}

export interface Guide {
  channels: Channel[]
  programmes: Record<string, Programme[]> // by channel id, sorted by start
  windowStart: number
  windowEnd: number
}

export const MIN = 60_000
const HOUR = 60 * MIN

interface Template {
  title: string
  category: string
  minutes: number[]
  description: string
}

const POOLS: Record<Genre, Template[]> = {
  general: [
    { title: 'Morning Edition', category: 'Magazine', minutes: [60, 90], description: 'Conversation, guests and the day ahead.' },
    { title: 'Nature Hour', category: 'Documentary', minutes: [60], description: 'Wildlife and landscapes from around the world.' },
    { title: 'The Kitchen Table', category: 'Lifestyle', minutes: [30, 60], description: 'Seasonal recipes cooked from scratch.' },
    { title: 'Sports Review', category: 'Sport', minutes: [30], description: 'Results, highlights and analysis.' },
    { title: 'Feature Film', category: 'Film', minutes: [120], description: 'An evening feature presentation.' },
    { title: 'City Stories', category: 'Travel', minutes: [60], description: 'Neighbourhood guides from European cities.' },
    { title: 'Evening News', category: 'News', minutes: [30], description: 'The day in summary, with weather.' },
  ],
  news: [
    { title: 'News Hour', category: 'News', minutes: [60], description: 'National and international headlines.' },
    { title: 'Headlines', category: 'News', minutes: [30], description: 'The latest stories in half an hour.' },
    { title: 'Business Today', category: 'Business', minutes: [30], description: 'Markets, companies and the economy.' },
    { title: 'The Interview', category: 'Current affairs', minutes: [30, 60], description: 'One guest, one long conversation.' },
    { title: 'Weather Outlook', category: 'Weather', minutes: [15, 30], description: 'Regional forecast for the next days.' },
  ],
  sport: [
    { title: 'Football Live', category: 'Football', minutes: [120], description: 'Live league match with studio coverage.' },
    { title: 'Basketball Tonight', category: 'Basketball', minutes: [120], description: 'Full game coverage and post-match analysis.' },
    { title: 'Match Highlights', category: 'Sport', minutes: [30, 60], description: 'The best moments from the weekend.' },
    { title: 'Tennis Classics', category: 'Tennis', minutes: [90], description: 'Memorable finals, replayed in full.' },
    { title: 'Sport Desk', category: 'Sport news', minutes: [30], description: 'Results, transfers and interviews.' },
  ],
  film: [
    { title: 'The Long Road North', category: 'Drama', minutes: [120], description: 'Two strangers share a winter journey.' },
    { title: 'Night Shift', category: 'Thriller', minutes: [105, 120], description: 'A dispatcher takes one call too many.' },
    { title: 'Small Harbour', category: 'Comedy', minutes: [90], description: 'A fishing town plans an unlikely festival.' },
    { title: 'Glass Houses', category: 'Series', minutes: [45, 60], description: 'Family secrets surface after an inheritance.' },
    { title: 'Station Eleven', category: 'Series', minutes: [45, 60], description: 'Episode of the ongoing drama series.' },
  ],
  docs: [
    { title: 'Deep Water', category: 'Nature', minutes: [60], description: 'Life in the cold currents of the North Sea.' },
    { title: 'Engineering Giants', category: 'Science', minutes: [60], description: 'How the largest structures are built.' },
    { title: 'Lost Cities', category: 'History', minutes: [60, 90], description: 'Archaeologists revisit forgotten capitals.' },
    { title: 'Wild Baltics', category: 'Nature', minutes: [30, 60], description: 'Forests, dunes and wetlands of the region.' },
  ],
  kids: [
    { title: 'Puzzle Pals', category: 'Animation', minutes: [15, 30], description: 'Friends solve a new puzzle each episode.' },
    { title: 'Little Explorers', category: 'Education', minutes: [30], description: 'Curious questions, simple experiments.' },
    { title: 'Robo Garage', category: 'Animation', minutes: [30], description: 'Robots fix things — mostly.' },
  ],
  music: [
    { title: 'Top 20', category: 'Charts', minutes: [60], description: 'This week’s most-played videos.' },
    { title: 'Live Session', category: 'Concert', minutes: [60, 90], description: 'A full set recorded in the studio.' },
    { title: 'Non-stop Hits', category: 'Music', minutes: [60, 120], description: 'Back-to-back music videos.' },
  ],
  lifestyle: [
    { title: 'Weekend Kitchen', category: 'Cooking', minutes: [30, 60], description: 'Simple dishes for slow weekends.' },
    { title: 'Room by Room', category: 'Home', minutes: [30, 60], description: 'Small renovations with big results.' },
    { title: 'Garden Year', category: 'Garden', minutes: [30], description: 'What to plant, prune and harvest now.' },
    { title: 'On the Road', category: 'Travel', minutes: [60], description: 'Slow travel through small towns.' },
  ],
}

// Deterministic PRNG so a given time slot always gets the same mock programme.
function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const floorTo = (t: number, step: number) => Math.floor(t / step) * step

function scheduleFor(channel: Channel, from: number, to: number, sampleMoment: number): Programme[] {
  const pool = POOLS[channel.genre]
  const dayStart = new Date(from)
  dayStart.setHours(0, 0, 0, 0)

  const out: Programme[] = []
  let t = dayStart.getTime()
  while (t < to) {
    const rnd = seeded(`${channel.id}:${t}`)
    const tpl = pool[Math.floor(rnd() * pool.length)]
    const minutes = tpl.minutes[Math.floor(rnd() * tpl.minutes.length)]
    const end = t + minutes * MIN
    if (end > from) {
      const isSample = channel.id === REAL_CHANNEL.id && sampleMoment >= t && sampleMoment < end
      out.push({
        id: `${channel.id}-${t}`,
        channelId: channel.id,
        title: tpl.title,
        description: tpl.description,
        category: tpl.category,
        start: t,
        end,
        recordingUrl: isSample ? SAMPLE_RECORDING_URL : undefined,
      })
    }
    t = end
  }
  return out
}

export function buildGuide(now: number): Guide {
  const windowStart = floorTo(now, 30 * MIN) - 4 * HOUR
  const windowEnd = windowStart + 24 * HOUR
  const sampleMoment = now - SAMPLE_RECORDING_OFFSET_SEC * 1000
  const programmes: Record<string, Programme[]> = {}
  for (const c of CHANNELS) programmes[c.id] = scheduleFor(c, windowStart, windowEnd, sampleMoment)
  return { channels: CHANNELS, programmes, windowStart, windowEnd }
}

// Simulates a network call so the loading, empty and error states are real code paths.
// Try ?epg=empty or ?epg=error in the URL to see them.
export function fetchGuide(): Promise<Guide> {
  const mode = new URLSearchParams(window.location.search).get('epg')
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (mode === 'error') reject(new Error('The demo guide service is unavailable.'))
      else if (mode === 'empty') resolve({ ...buildGuide(Date.now()), channels: [], programmes: {} })
      else resolve(buildGuide(Date.now()))
    }, 500)
  })
}

export function programmeAt(list: Programme[] | undefined, t: number): Programme | undefined {
  return list?.find((p) => t >= p.start && t < p.end)
}

// What the user can actually do with a programme. This is the single source of truth
// for labels, actions and the player screen, so the UI never promises playback that
// does not exist.
export type Availability =
  | 'live' // real stream, on air now
  | 'recording' // the provided sample recording is attached
  | 'demo' // demo channel: no stream at all
  | 'no-recording' // real channel, already aired, nothing to play
  | 'upcoming' // real channel, not aired yet

export function availabilityOf(p: Programme, channel: Channel, now: number): Availability {
  if (!channel.streamUrl) return 'demo'
  if (now >= p.start && now < p.end) return 'live'
  if (p.start > now) return 'upcoming'
  return p.recordingUrl ? 'recording' : 'no-recording'
}

export type Phase = 'past' | 'current' | 'upcoming'
export const phaseOf = (p: Programme, now: number): Phase =>
  p.end <= now ? 'past' : p.start > now ? 'upcoming' : 'current'
