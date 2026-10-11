import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import Icon from '../../components/Icon'
import { REAL_CHANNEL } from '../../data/channels'
import type { Channel } from '../../data/channels'
import type { Programme } from '../../data/epg'
import {
  NOTIFICATIONS_DISCLAIMER,
  methodsLabel,
  removeReminder,
  saveReminder,
} from '../../data/reminders'
import type { ReminderMethods } from '../../data/reminders'
import { formatDay, formatRange } from '../../lib/time'

/**
 * `reminder`: set up (or change) a reminder for a programme that has not started.
 * `remove-reminder`: remove the existing reminder, then confirm.
 * `no-recording` / `no-stream`: explain why "Watch now" cannot play.
 */
export type DialogKind = 'reminder' | 'remove-reminder' | 'no-recording' | 'no-stream'

interface Props {
  kind: DialogKind
  programme: Programme
  channel: Channel
  /** The programme's current reminder, if any. */
  reminder: ReminderMethods | null
  /** Pre-selected methods for a new reminder. */
  preferredMethods: ReminderMethods
  onReminderSaved: (programmeId: string, methods: ReminderMethods) => void
  onReminderRemoved: (programmeId: string) => void
  onWatchLive: () => void
  /** Fired once the dialog has closed: Back to guide, Esc, Backspace or a backdrop click. */
  onClose: () => void
}

type Stage = 'setup' | 'saving' | 'saved' | 'removing' | 'removed' | 'remove-failed' | 'info'

const initialStage = (kind: DialogKind): Stage =>
  kind === 'reminder' ? 'setup' : kind === 'remove-reminder' ? 'removing' : 'info'

export default function ProgrammeDialog({
  kind,
  programme: p,
  channel,
  reminder,
  preferredMethods,
  onReminderSaved,
  onReminderRemoved,
  onWatchLive,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [now] = useState(() => Date.now())
  const [stage, setStage] = useState<Stage>(() => initialStage(kind))
  // Reopening an existing reminder keeps its methods; a new one starts with the methods
  // saved last time (Email if none yet).
  const [methods, setMethods] = useState<ReminderMethods>(reminder ?? preferredMethods)
  const [failed, setFailed] = useState(false)
  const noMethod = !methods.email && !methods.sms

  // A native modal dialog makes the guide behind it inert, so focus cannot leave it.
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  // Remove once on open. The ref guards against StrictMode running this effect twice.
  const removeStarted = useRef(false)
  useEffect(() => {
    if (kind !== 'remove-reminder' || removeStarted.current) return
    removeStarted.current = true
    removeReminder(p).then(
      () => {
        onReminderRemoved(p.id)
        setStage('removed')
      },
      () => setStage('remove-failed'),
    )
  }, [kind, p, onReminderRemoved])

  // Closing goes through the native dialog so its `close` event is the single exit path.
  const close = () => ref.current?.close()

  const save = () => {
    if (stage === 'saving') return
    if (noMethod) return // the inline message asks for a choice
    setStage('saving')
    setFailed(false)
    saveReminder(p, methods).then(
      () => {
        onReminderSaved(p.id, methods)
        setStage('saved')
      },
      () => {
        setFailed(true)
        setStage('setup')
      },
    )
  }

  const setUpAgain = () => {
    setMethods(preferredMethods)
    setFailed(false)
    setStage('setup')
  }

  // Clicks on the backdrop land on the <dialog> element itself. Only a single click
  // closes: the second click of a double-click on a programme lands here too.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && e.detail === 1) close()
  }

  const liveLabel = channel.streamUrl ? 'Watch channel live' : `Watch ${REAL_CHANNEL.name} live`
  const reminderFlow = kind === 'reminder' || kind === 'remove-reminder'

  const disclaimer = (
    <p className="dialog-note">
      <Icon name="info" size="1.1em" />
      {NOTIFICATIONS_DISCLAIMER}
    </p>
  )

  const methodOption = (key: keyof ReminderMethods, label: string) => (
    <label className="method">
      <input
        type="checkbox"
        checked={methods[key]}
        onChange={(e) => setMethods((m) => ({ ...m, [key]: e.target.checked }))}
      />
      <span className="method-box" aria-hidden="true">
        {methods[key] && <Icon name="check" size="0.8125rem" />}
      </span>
      {label}
    </label>
  )

  // The eyebrow line above already names the programme, time and channel, so most states
  // need only a title.
  let title: string
  let text = ''
  if (stage === 'saved') {
    title = `Reminder set · ${methodsLabel(methods)}`
  } else if (stage === 'remove-failed') {
    title = 'The reminder could not be removed'
    text = 'Please try again.'
  } else if (stage === 'removed' || stage === 'removing') {
    title = stage === 'removed' ? 'Reminder removed.' : 'Removing reminder…'
  } else if (kind === 'no-recording') {
    title = 'No recording available'
  } else if (kind === 'no-stream') {
    title = `${channel.name} has no stream`
  } else {
    title = 'This programme has not started yet.'
  }

  return (
    <dialog
      ref={ref}
      className="programme-dialog"
      aria-labelledby="programme-dialog-title"
      aria-describedby={text ? 'programme-dialog-text' : undefined}
      onClose={onClose}
      onClick={onClick}
    >
      <div className="state-card state-card-wide dialog-card">
        <p className="state-eyebrow">
          {p.title} · {formatDay(p.start, now)}, {formatRange(p.start, p.end)} · {channel.name}
        </p>

        <div className="dialog-message" aria-live="polite">
          <h2 className="state-title dialog-title" id="programme-dialog-title">
            {stage === 'saved' && <Icon name="check" size="1.1em" />}
            {title}
          </h2>
          {text && (
            <p className="state-text" id="programme-dialog-text">
              {text}
            </p>
          )}
        </div>

        {(stage === 'setup' || stage === 'saving') && (
          <fieldset className="dialog-methods">
            <legend>Remind me via</legend>
            <div className="method-options">
              {methodOption('email', 'Email')}
              {methodOption('sms', 'SMS')}
            </div>
            {noMethod && (
              <p className="dialog-error" role="alert">
                Choose Email, SMS or both.
              </p>
            )}
            {failed && (
              <p className="dialog-error" role="alert">
                The reminder could not be saved. Please try again.
              </p>
            )}
          </fieldset>
        )}

        {reminderFlow && (stage === 'setup' || stage === 'saving' || stage === 'saved') && disclaimer}

        <div className="state-actions">
          {(stage === 'setup' || stage === 'saving') && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              aria-disabled={noMethod || stage === 'saving'}
            >
              <Icon name="bell" />
              {stage === 'saving' ? 'Saving…' : 'Save reminder'}
            </button>
          )}
          {stage === 'removed' && (
            <button type="button" className="btn btn-primary" onClick={setUpAgain}>
              <Icon name="bell" />
              Set reminder
            </button>
          )}
          <button
            type="button"
            className={`btn ${stage === 'info' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onWatchLive}
          >
            <span className="status-dot" aria-hidden="true" />
            {liveLabel}
          </button>
          <button
            type="button"
            className={`btn ${reminderFlow && stage !== 'saved' ? 'btn-ghost' : 'btn-secondary'}`}
            onClick={close}
          >
            <Icon name="guide" />
            Back to guide
          </button>
        </div>
      </div>
    </dialog>
  )
}
