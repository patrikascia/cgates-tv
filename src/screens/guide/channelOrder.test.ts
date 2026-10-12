// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CATEGORIES, CHANNELS } from '../../data/channels'
import type { Channel } from '../../data/channels'
import { applyOrder, inCategory, useChannelOrders } from './channelOrder'

const ids = (channels: Channel[]) => channels.map((c) => c.id)
const defaultIds = (filter: Parameters<typeof inCategory>[1]) => ids(inCategory(CHANNELS, filter))

beforeEach(() => localStorage.clear())

describe('channel filtering and ordering', () => {
  it('shows every channel in All and only matching channels in each category, in default order', () => {
    expect(ids(inCategory(CHANNELS, 'all'))).toEqual(ids(CHANNELS))
    for (const category of CATEGORIES) {
      const shown = inCategory(CHANNELS, category)
      expect(shown.length).toBeGreaterThan(0)
      expect(shown.every((c) => c.category === category)).toBe(true)
      expect(ids(shown)).toEqual(ids(CHANNELS.filter((c) => c.category === category)))
    }
    // Every channel is in exactly one category.
    expect(CATEGORIES.flatMap((c) => inCategory(CHANNELS, c)).sort((a, b) => a.number - b.number)).toEqual(CHANNELS)
  })

  it('keeps unknown or missing channels in their default place after a saved order', () => {
    const [a, b, c, d] = CHANNELS
    expect(ids(applyOrder([a, b, c, d], [c.id, 'gone', a.id]))).toEqual([c.id, a.id, b.id, d.id])
  })

  it('reorders each view independently and restores every order after a reload', () => {
    const { result, unmount } = renderHook(() => useChannelOrders(CHANNELS))
    const music = defaultIds('music')
    const lastMusic = music.at(-1)!
    const lastAll = CHANNELS.at(-1)!.id

    act(() => result.current.moveChannel('music', lastMusic, 0))
    act(() => result.current.moveChannel('all', lastAll, 0))

    const musicOrder = [lastMusic, ...music.slice(0, -1)]
    const allOrder = [lastAll, ...ids(CHANNELS).slice(0, -1)]
    expect(ids(result.current.channelsFor('music'))).toEqual(musicOrder)
    expect(ids(result.current.channelsFor('all'))).toEqual(allOrder)
    for (const untouched of ['history', 'sport', 'movies'] as const) {
      expect(ids(result.current.channelsFor(untouched))).toEqual(defaultIds(untouched))
    }

    unmount()
    const reloaded = renderHook(() => useChannelOrders(CHANNELS)).result
    expect(ids(reloaded.current.channelsFor('music'))).toEqual(musicOrder)
    expect(ids(reloaded.current.channelsFor('all'))).toEqual(allOrder)
    expect(ids(reloaded.current.channelsFor('sport'))).toEqual(defaultIds('sport'))
  })
})
