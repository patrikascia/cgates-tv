// PROTOTYPE ONLY. No reminder backend or email service was provided, so setReminder()
// contacts no server and nothing is scheduled or sent. The app only remembers the
// reminder until the page is reloaded. To connect a real service, make setReminder()
// call its API and set EMAIL_REMINDERS_CONNECTED to true: the reminder dialog already
// handles the pending, success and failure states.

import type { Programme } from './epg'

export const EMAIL_REMINDERS_CONNECTED = false

export function setReminder(_programme: Programme): Promise<void> {
  return Promise.resolve()
}
