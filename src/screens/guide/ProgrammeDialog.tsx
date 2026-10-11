import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import Icon from '../../components/Icon'
import { REAL_CHANNEL } from '../../data/channels'
import type { Channel } from '../../data/channels'
import type { Programme } from '../../data/epg'
import {
  DEFAULT_METHODS,
  NOTIFICATIONS_DISCLAIMER,
  methodsLabel,
  removeReminder,
  saveReminder,
} from '../../data/reminders'
import type { ReminderMethods } from '../../data/reminders'
import { formatDay, formatRange, formatTime } from '../../lib/time'

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
  onReminderSaved: (programmeId: string, methods: ReminderMethods) => void
  onReminderRemoved: (programmeId: string) => void
  onWatchLive: () => void
  /** Fired once the dialog has closed: Back to guide, Esc, Backspace or a backdrop click. */
  onClose: () => void
}

type Stage = 'setup' | 'saving' | 'saved' | 'removing' | 'removed' | 'remove-failed' | 'info'

// "today", "tomorrow", "on Sun 12 Oct"
function dayPhrase(ms: number, now: number): string {
  const day = formatDay(ms, now)
  return day === 'Today' || day === 'Tomorrow' || day === 'Yesterday' ? day.toLowerCase() : `on ${day}`
}

const initialStage = (kind: DialogKind): Stage =>
  kind === 'reminder' ? 'setup' : kind === 'remove-reminder' ? 'removing' : 'info'

export default function ProgrammeDialog({
  kind,
  programme: p,
  channel,
  reminder,
  onReminderSaved,
  onReminderRemoved,
  onWatchLive,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [now] = useState(() => Date.now())
  const [stage, setStage] = useState<Stage>(() => initialStage(kind))
  // Reopening an existing reminder keeps its methods; a new one starts with Email.
  const [methods, setMethods] = useState<ReminderMethods>(reminder ?? DEFAULT_METHODS)
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

  // Each stage puts focus on its most likely next action.
  useEffect(() => {
    const d = ref.current
    ;(d?.querySelector<HTMLElement>('[data-initial]') ?? d?.querySelector<HTMLElement>('button'))?.focus()
  }, [stage])

  // Closing goes through the native dialog so its `close` event is the single exit path.
  const close = () => ref.current?.close()

  const save = () => {
    if (stage === 'saving') return
    if (noMethod) {
      ref.current?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus()
      return
    }
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
    setMethods(DEFAULT_METHODS)
    setFailed(false)
    setStage('setup')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    const target = e.target as HTMLElement
    if (e.key === 'Backspace' || e.key === 'BrowserBack') {
      e.preventDefault()
      close()
    } else if (e.key === 'Enter' && target instanceof HTMLInputElement && target.type === 'checkbox') {
      // OK on a remote toggles the checkbox, like Space does.
      e.preventDefault()
      target.click()
    } else if (e.key.startsWith('Arrow')) {
      // TV remote: arrows move through the controls in reading order.
      e.preventDefault()
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button, input') ?? [])
      const i = controls.indexOf(target)
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
      controls[Math.min(controls.length - 1, Math.max(0, i + step))]?.focus()
    }
  }

  // Clicks on the backdrop land on the <dialog> element itself.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) close()
  }

  const at = `${dayPhrase(p.start, now)} at ${formatTime(p.start)} on ${channel.name}`
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

  let title: string
  let text: string
  if (stage === 'saved') {
    title = `Reminder set · ${methodsLabel(methods)}`
    text = `“${p.title}” starts ${at}.`
  } else if (stage === 'remove-failed') {
    title = 'The reminder could not be removed'
    text = 'Please try again.'
  } else if (stage === 'removed' || stage === 'removing') {
    title = stage === 'removed' ? 'Reminder removed.' : 'Removing reminder…'
    text = `“${p.title}” starts ${at}.`
  } else if (kind === 'no-recording') {
    title = 'No recording available'
    text = `“${p.title}” aired ${dayPhrase(p.start, now)}, ${formatRange(p.start, p.end)}. No recording exists for it, so it cannot be played. The live channel can only be rewound by about 3 minutes.`
  } else if (kind === 'no-stream') {
    title = `${channel.name} has no stream`
    text = `This is a demo channel used to fill the guide. Only ${REAL_CHANNEL.name} has a real live stream.`
  } else {
    title = 'This programme has not started yet.'
    text = `“${p.title}” starts ${at}.`
  }

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
          <h2 className="state-title dialog-title" id="programme-dialog-title">
            {stage === 'saved' && <Icon name="check" size="1.1em" />}
            {title}
          </h2>
          <p className="state-text" id="programme-dialog-text">
            {text}
          </p>
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
              data-initial
              onClick={save}
              aria-disabled={noMethod || stage === 'saving'}
            >
              <Icon name="bell" />
              {stage === 'saving' ? 'Saving…' : 'Save reminder'}
            </button>
          )}
          {stage === 'removed' && (
            <button type="button" className="btn btn-primary" data-initial onClick={setUpAgain}>
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
            data-initial={stage === 'saved' || stage === 'remove-failed' ? true : undefined}
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
