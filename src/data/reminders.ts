// PROTOTYPE ONLY. No reminder backend, email service or SMS provider was provided, so
// these functions contact no server and nothing is scheduled or sent. Reminders live in
// the app's state until the page is reloaded. To connect a real service, implement
// saveReminder() / removeReminder() as API calls: the reminder dialog already handles
// the pending, success and failure states.

import type { Programme } from './epg'

/** How the user wants to be reminded. At least one must be true. */
export interface ReminderMethods {
  email: boolean
  sms: boolean
}

export const DEFAULT_METHODS: ReminderMethods = { email: true, sms: false }

export const NOTIFICATIONS_DISCLAIMER = "Demo only — notifications aren't connected yet."

/** "Email", "SMS" or "Email + SMS" */
export const methodsLabel = (m: ReminderMethods) =>
  [m.email && 'Email', m.sms && 'SMS'].filter(Boolean).join(' + ')

export function saveReminder(_programme: Programme, _methods: ReminderMethods): Promise<void> {
  return Promise.resolve()
}

export function removeReminder(_programme: Programme): Promise<void> {
  return Promise.resolve()
}
