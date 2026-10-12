import { useEffect, useState } from 'react'

const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const hms = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const formatTime = (ms: number) => hm.format(ms)
export const formatTimeSec = (ms: number) => hms.format(ms)
export const formatRange = (start: number, end: number) => `${formatTime(start)} – ${formatTime(end)}`

export function formatDay(ms: number, now: number): string {
  const d = new Date(ms)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return dayFmt.format(d)
}

export const formatDate = (ms: number) => dayFmt.format(ms)

/** The guide's selectable days, relative to today. */
export type DayOffset = -1 | 0 | 1

/** Local midnight of the day `offset` days from `ms` (DST-safe). */
export function startOfDay(ms: number, offset = 0): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d.getTime()
}

/** "1 h 25 min", "40 min", "under 1 min" */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 60_000)
  if (total < 1) return 'under 1 min'
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Media clock: "0:07", "2:40", "1:02:03" */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Re-renders on a fixed interval and returns the current time in ms. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}
