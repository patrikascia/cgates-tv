// Only ONE channel has a real stream. Every other channel below is demo data used to
// make the guide look realistic; they have no stream and the UI says so.

export interface Channel {
  id: string
  number: number
  name: string
  /** Short text shown in the logo tile. No real logos were provided. */
  monogram: string
  genre: Genre
  /** Present only for channels with a real, provided stream. */
  streamUrl?: string
}

export type Genre = 'general' | 'news' | 'sport' | 'film' | 'docs' | 'kids' | 'music' | 'lifestyle'

export const LIVE_URL = 'https://tr.live.cdn.cgates.lt/live/dash/560407/index.mpd'

export const REAL_CHANNEL: Channel = {
  id: '560407',
  number: 1,
  name: 'TV 560407',
  monogram: '407',
  genre: 'general',
  streamUrl: LIVE_URL,
}

const DEMO_CHANNELS: Channel[] = [
  { id: 'demo-news', number: 2, name: 'Aurora News', monogram: 'AN', genre: 'news' },
  { id: 'demo-sport', number: 3, name: 'Arena Sport', monogram: 'AS', genre: 'sport' },
  { id: 'demo-film', number: 4, name: 'Cinema One', monogram: 'C1', genre: 'film' },
  { id: 'demo-docs', number: 5, name: 'Planet Docs', monogram: 'PD', genre: 'docs' },
  { id: 'demo-kids', number: 6, name: 'Kids Club', monogram: 'KC', genre: 'kids' },
  { id: 'demo-music', number: 7, name: 'Pulse Music', monogram: 'PM', genre: 'music' },
  { id: 'demo-life', number: 8, name: 'Home & Table', monogram: 'HT', genre: 'lifestyle' },
  { id: 'demo-series', number: 9, name: 'Series Now', monogram: 'SN', genre: 'film' },
  { id: 'demo-world', number: 10, name: 'World 24', monogram: 'W24', genre: 'news' },
  { id: 'demo-motor', number: 11, name: 'Motor TV', monogram: 'MT', genre: 'sport' },
  { id: 'demo-history', number: 12, name: 'History+', monogram: 'H+', genre: 'docs' },
]

export const CHANNELS: Channel[] = [REAL_CHANNEL, ...DEMO_CHANNELS]

export const hasStream = (c: Channel) => Boolean(c.streamUrl)
