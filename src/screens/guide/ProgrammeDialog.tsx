import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import Icon from '../../components/Icon'
import { REAL_CHANNEL } from '../../data/channels'
import type { Channel } from '../../data/channels'
import type { Programme } from '../../data/epg'
import { EMAIL_REMINDERS_CONNECTED, setReminder } from '../../data/reminders'
import { formatDay, formatRange, formatTime } from '../../lib/time'

/** `reminder`: not started yet. `no-recording`: aired on the real channel, nothing to play. */
export type DialogKind = 'reminder' | 'no-recording'

interface Props {
  kind: DialogKind
  programme: Programme
  channel: Channel
  reminderSet: boolean
  onReminderSet: (programmeId: string) => void
  onWatchLive: () => void
  /** Fired once the dialog has closed: Back to guide, Esc, Backspace or a backdrop click. */
  onClose: () => void
}

type Stage = 'ask' | 'saving' | 'set' | 'failed'

// "today", "tomorrow", "on Sun 12 Oct"
function dayPhrase(ms: number, now: number): string {
  const day = formatDay(ms, now)
  return day === 'Today' || day === 'Tomorrow' || day === 'Yesterday' ? day.toLowerCase() : `on ${day}`
}

export default function ProgrammeDialog({
  kind,
  programme: p,
  channel,
  reminderSet,
  onReminderSet,
  onWatchLive,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [now] = useState(() => Date.now())
  const [stage, setStage] = useState<Stage>(reminderSet ? 'set' : 'ask')

  // A native modal dialog makes the guide behind it inert, so focus cannot leave it.
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  // Focus the first action, or "Back to guide" once the reminder is confirmed.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(stage === 'set' ? '[data-back]' : 'button')?.focus()
  }, [stage])

  // Closing goes through the native dialog so its `close` event is the single exit path.
  const close = () => ref.current?.close()

  const confirmReminder = () => {
    if (stage === 'saving') return
    setStage('saving')
    setReminder(p).then(
      () => {
        onReminderSet(p.id)
        setStage('set')
      },
      () => setStage('failed'),
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Backspace' || e.key === 'BrowserBack') {
      e.preventDefault()
      close()
    } else if (e.key.startsWith('Arrow')) {
      // TV remote: any arrow moves between the actions.
      e.preventDefault()
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
      buttons[Math.min(buttons.length - 1, Math.max(0, i + step))]?.focus()
    }
  }

  // Clicks on the backdrop land on the <dialog> element itself.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) close()
  }

  const at = `${dayPhrase(p.start, now)} at ${formatTime(p.start)} on ${channel.name}`
  const liveLabel = channel.streamUrl ? 'Watch channel live' : `Watch ${REAL_CHANNEL.name} live`
  const reminder = kind === 'reminder'
  const confirmed = reminder && stage === 'set'

  const liveButton = (primary: boolean) => (
    <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`} onClick={onWatchLive}>
      <span className="status-dot" aria-hidden="true" />
      {liveLabel}
    </button>
  )

  return (
    <dialog
      ref={ref}
      className="programme-dialog"
      aria-labelledby="programme-dialog-title"
      aria-describedby="programme-dialog-text"
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div className="state-card state-card-wide dialog-card">
        <p className="state-eyebrow">
          {p.title} · {formatDay(p.start, now)}, {formatRange(p.start, p.end)} · {channel.name}
        </p>

        <div className="dialog-message" aria-live="polite">
          {confirmed ? (
            <>
              <h2 className="state-title dialog-title" id="programme-dialog-title">
                <Icon name="check" size="1.1em" />
                Reminder set
              </h2>
              <p className="state-text" id="programme-dialog-text">
                You set a reminder for “{p.title}”, {at}.
              </p>
              <p className="dialog-note">
                <Icon name="info" size="1.1em" />
                {EMAIL_REMINDERS_CONNECTED
                  ? 'An email reminder will be sent before the programme starts.'
                  : 'Prototype: the reminder service is not connected yet, so no email has been scheduled or sent, and this reminder is kept only until the page is reloaded. Once the real reminder service is connected, an email reminder will be sent before the programme starts.'}
              </p>
            </>
          ) : reminder ? (
            <>
              <h2 className="state-title" id="programme-dialog-title">
                This programme has not started yet.
              </h2>
              <p className="state-text" id="programme-dialog-text">
                “{p.title}” starts {at}.
                {!channel.streamUrl && ' This is a demo channel, so there will be no stream to watch when it airs.'}
              </p>
              {stage === 'failed' && (
                <p className="dialog-note" role="alert">
                  <Icon name="info" size="1.1em" />
                  The reminder could not be set. Please try again.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="state-title" id="programme-dialog-title">
                No recording available
              </h2>
              <p className="state-text" id="programme-dialog-text">
                “{p.title}” aired {dayPhrase(p.start, now)}, {formatRange(p.start, p.end)}. No recording exists for
                it, so it cannot be played. The live channel can only be rewound by about 3 minutes.
              </p>
            </>
          )}
        </div>

        <div className="state-actions">
          {reminder && !confirmed && (
            <button type="button" className="btn btn-primary" onClick={confirmReminder} aria-disabled={stage === 'saving'}>
              <Icon name="bell" />
              {stage === 'saving' ? 'Setting reminder…' : 'Set reminder'}
            </button>
          )}
          {liveButton(!reminder)}
          <button type="button" className={`btn ${reminder && !confirmed ? 'btn-ghost' : 'btn-secondary'}`} data-back onClick={close}>
            <Icon name="guide" />
            Back to guide
          </button>
        </div>
      </div>
    </dialog>
  )
}
