// MOCK DATA. No real EPG API was provided, so the schedule is generated locally.
// Titles, times and descriptions are invented and do not describe the real channel.

export const CHANNEL = {
  id: '560407',
  name: 'TV 560407',
  logoText: '407',
}

export const LIVE_URL = 'https://tr.live.cdn.cgates.lt/live/dash/560407/index.mpd'

// The provided recording URL is relative: it always points at a 30s clip that aired
// 9873s (~2h44m) ago. It is not tied to any particular programme, so we attach it to
// whichever mock programme was on air at that moment (see buildSchedule).
const SAMPLE_RECORDING_OFFSET_SEC = 9858 // middle of the 9873s..9843s window
const SAMPLE_RECORDING_URL =
  'https://tr.cdvr.cdn.cgates.lt/dash-wv/cdvr-jitp-enc/eid/560407/rid-TID~560407~now-9873s~now-9843s~dynamic__variant-default.mpd'

export interface Program {
  id: string
  title: string
  description: string
  start: number // ms since epoch
  end: number
  recordingUrl?: string
  isSampleRecording?: boolean
}

const TEMPLATES = [
  { title: 'Morning News', minutes: 60, description: 'Mock programme: headlines and weather.' },
  { title: 'Nature Documentary', minutes: 90, description: 'Mock programme: wildlife around the world.' },
  { title: 'Cooking Hour', minutes: 60, description: 'Mock programme: seasonal recipes.' },
  { title: 'Sports Review', minutes: 30, description: 'Mock programme: results and highlights.' },
  { title: 'Evening Movie', minutes: 120, description: 'Mock programme: a feature film.' },
  { title: 'Travel Stories', minutes: 60, description: 'Mock programme: city guides.' },
  { title: 'Late News', minutes: 30, description: 'Mock programme: the day in summary.' },
]

const MIN = 60_000

export function buildSchedule(now: number): Program[] {
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)

  const from = now - 5 * 60 * MIN
  const to = now + 8 * 60 * MIN
  const sampleMoment = now - SAMPLE_RECORDING_OFFSET_SEC * 1000

  const programs: Program[] = []
  let t = midnight.getTime() - 24 * 60 * MIN
  let i = 0
  while (t < to) {
    const tpl = TEMPLATES[i % TEMPLATES.length]
    const end = t + tpl.minutes * MIN
    if (end > from) {
      const hasSample = sampleMoment >= t && sampleMoment < end
      programs.push({
        id: `p-${t}`,
        title: tpl.title,
        description: tpl.description,
        start: t,
        end,
        recordingUrl: hasSample ? SAMPLE_RECORDING_URL : undefined,
        isSampleRecording: hasSample,
      })
    }
    t = end
    i++
  }
  return programs
}

// Simulates a network call so the loading, empty and error states are real code paths.
// Try ?epg=empty or ?epg=error in the URL to see them.
export function fetchSchedule(): Promise<Program[]> {
  const mode = new URLSearchParams(window.location.search).get('epg')
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (mode === 'error') reject(new Error('Mock EPG service is unavailable.'))
      else if (mode === 'empty') resolve([])
      else resolve(buildSchedule(Date.now()))
    }, 600)
  })
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })
}
