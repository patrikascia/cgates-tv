// Only ONE channel has a real stream. Every other channel below is demo data used to
// make the guide look realistic; they have no stream and the UI says so.

export interface Channel {
  id: string
  number: number
  name: string
  /** Short text shown in the logo tile. No real logos were provided. */
  monogram: string
  genre: Genre
  /** Filter category in the guide. Every channel has exactly one. */
  category: Category
  /** Present only for channels with a real, provided stream. */
  streamUrl?: string
}

export type Genre = 'general' | 'news' | 'sport' | 'film' | 'docs' | 'kids' | 'music' | 'lifestyle'

// Guide filter categories, in display order. Demo assignment based on each channel's
// name and mock schedule: factual channels (documentaries, news) are History; the real
// channel's general schedule with feature films is Movies.
export type Category = 'music' | 'history' | 'sport' | 'movies'
export const CATEGORIES: Category[] = ['music', 'history', 'sport', 'movies']

export const LIVE_URL = 'https://tr.live.cdn.cgates.lt/live/dash/560407/index.mpd'

export const REAL_CHANNEL: Channel = {
  id: '560407',
  number: 1,
  name: 'TV 560407',
  monogram: '407',
  genre: 'general',
  category: 'movies',
  streamUrl: LIVE_URL,
}

const DEMO_CHANNELS: Channel[] = [
  { id: 'demo-news', number: 2, name: 'Aurora News', monogram: 'AN', genre: 'news', category: 'history' },
  { id: 'demo-sport', number: 3, name: 'Arena Sport', monogram: 'AS', genre: 'sport', category: 'sport' },
  { id: 'demo-film', number: 4, name: 'Cinema One', monogram: 'C1', genre: 'film', category: 'movies' },
  { id: 'demo-docs', number: 5, name: 'Planet Docs', monogram: 'PD', genre: 'docs', category: 'history' },
  { id: 'demo-kids', number: 6, name: 'Kids Club', monogram: 'KC', genre: 'kids', category: 'music' },
  { id: 'demo-music', number: 7, name: 'Pulse Music', monogram: 'PM', genre: 'music', category: 'music' },
  { id: 'demo-life', number: 8, name: 'Home & Table', monogram: 'HT', genre: 'lifestyle', category: 'music' },
  { id: 'demo-series', number: 9, name: 'Series Now', monogram: 'SN', genre: 'film', category: 'movies' },
  { id: 'demo-world', number: 10, name: 'World 24', monogram: 'W24', genre: 'news', category: 'history' },
  { id: 'demo-motor', number: 11, name: 'Motor TV', monogram: 'MT', genre: 'sport', category: 'sport' },
  { id: 'demo-history', number: 12, name: 'History+', monogram: 'H+', genre: 'docs', category: 'history' },
]

export const CHANNELS: Channel[] = [REAL_CHANNEL, ...DEMO_CHANNELS]

export const hasStream = (c: Channel) => Boolean(c.streamUrl)
