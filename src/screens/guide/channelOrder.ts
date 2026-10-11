import { useCallback, useEffect, useState } from 'react'
import type { Channel } from '../../data/channels'
import type { CategoryFilter } from './CategoryFilters'

// The user's channel orders, kept in this browser only. All and every category have their
// own independent order, stored as channel ids. Channels missing from a saved order (new
// ones, or a changed category) keep their default place after the rest.
const KEY = 'cgates-tv.channel-orders'
// Before per-category orders there was one shared order; it is migrated once (see below)
// and left in place, untouched.
const LEGACY_KEY = 'cgates-tv.channel-order'

type Orders = Partial<Record<CategoryFilter, string[]>>
interface Stored {
  version: 2
  orders: Orders
}

const FILTERS: CategoryFilter[] = ['all', 'music', 'history', 'sport', 'movies']

const idList = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : null

function parse<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null
  } catch {
    return null // storage blocked or corrupt
  }
}

/** Saved orders, plus whether they were just created from the legacy single order. */
function readOrders(): { orders: Orders; migrated: boolean } {
  const stored = parse<Stored>(KEY)
  if (stored?.version === 2 && stored.orders && typeof stored.orders === 'object') {
    const orders: Orders = {}
    for (const f of FILTERS) {
      const ids = idList(stored.orders[f])
      if (ids) orders[f] = ids
    }
    return { orders, migrated: false }
  }
  // First run with per-category orders: start every view from the old shared order, so
  // nothing visibly moves. A view only shows its own channels, so each category can take
  // the full list. From now on each view changes independently.
  const legacy = idList(parse<unknown>(LEGACY_KEY))
  if (!legacy?.length) return { orders: {}, migrated: false }
  const orders: Orders = {}
  for (const f of FILTERS) orders[f] = legacy
  return { orders, migrated: true }
}

function writeOrders(orders: Orders) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, orders } satisfies Stored))
  } catch {
    // Storage unavailable (private mode, quota): orders still apply until reload.
  }
}

export const inCategory = (channels: Channel[], filter: CategoryFilter) =>
  filter === 'all' ? channels : channels.filter((c) => c.category === filter)

export function applyOrder(channels: Channel[], order: string[]): Channel[] {
  const rank = new Map(order.map((id, i) => [id, i]))
  const rankOf = (c: Channel, i: number) => rank.get(c.id) ?? order.length + i
  return channels
    .map((c, i) => ({ c, r: rankOf(c, i) }))
    .sort((a, b) => a.r - b.r)
    .map(({ c }) => c)
}

/**
 * Per-view channel orders. `channelsFor(filter)` gives the channels shown in that view, in
 * its own order; `moveChannel(filter, id, to)` changes only that view's order.
 */
export function useChannelOrders(channels: Channel[]) {
  const [{ orders, migrated }, setState] = useState(readOrders)

  // Persist a migration straight away, so later changes to All cannot leak into
  // categories that have not been reordered yet.
  useEffect(() => {
    if (migrated) writeOrders(orders)
  }, [migrated, orders])

  const channelsFor = useCallback(
    (filter: CategoryFilter) => applyOrder(inCategory(channels, filter), orders[filter] ?? []),
    [channels, orders],
  )

  const moveChannel = useCallback(
    (filter: CategoryFilter, id: string, to: number) => {
      const ids = channelsFor(filter)
        .map((c) => c.id)
        .filter((x) => x !== id)
      ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id)
      const next = { ...orders, [filter]: ids }
      writeOrders(next)
      setState({ orders: next, migrated: false })
    },
    [channelsFor, orders],
  )

  return { channelsFor, moveChannel }
}
