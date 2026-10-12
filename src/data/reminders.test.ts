// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_METHODS, methodsLabel, useReminders } from './reminders'

const EMAIL_SMS = { email: true, sms: true }
const SMS = { email: false, sms: true }

describe('reminders', () => {
  it('adds, updates and removes reminders with their delivery methods', () => {
    const { result } = renderHook(() => useReminders())
    expect(result.current.reminders.size).toBe(0)
    expect(result.current.preferredMethods).toEqual(DEFAULT_METHODS)

    act(() => result.current.reminderSaved('news-20:00', EMAIL_SMS))
    act(() => result.current.reminderSaved('film-21:00', SMS))
    expect(result.current.reminders.get('news-20:00')).toEqual(EMAIL_SMS)
    expect(result.current.reminders.get('film-21:00')).toEqual(SMS)
    // The last saved methods are preselected for the next new reminder.
    expect(result.current.preferredMethods).toEqual(SMS)

    // Saving again changes that reminder's methods instead of adding another.
    act(() => result.current.reminderSaved('news-20:00', DEFAULT_METHODS))
    expect(result.current.reminders.size).toBe(2)
    expect(result.current.reminders.get('news-20:00')).toEqual(DEFAULT_METHODS)

    // Removing one leaves the others and the preferred methods alone.
    const before = result.current.reminders
    act(() => result.current.reminderRemoved('news-20:00'))
    expect(result.current.reminders).not.toBe(before) // a new map, so the guide re-renders
    expect(result.current.reminders.has('news-20:00')).toBe(false)
    expect(result.current.reminders.get('film-21:00')).toEqual(SMS)
    expect(result.current.preferredMethods).toEqual(DEFAULT_METHODS)

    expect(methodsLabel(DEFAULT_METHODS)).toBe('Email')
    expect(methodsLabel(SMS)).toBe('SMS')
    expect(methodsLabel(EMAIL_SMS)).toBe('Email + SMS')
  })
})
