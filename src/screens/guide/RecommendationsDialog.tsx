import { useEffect, useRef } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import Icon from '../../components/Icon'

// MOCK DATA. No recommendation service exists, so these are fixed placeholder picks, not
// personalised. Thumbnails are drawn with CSS gradients (no image files).
const RECOMMENDATIONS = [
  { title: 'Recommendation #1', art: 'rec-art-1' },
  { title: 'Recommendation #2', art: 'rec-art-2' },
  { title: 'Recommendation #3', art: 'rec-art-3' },
] as const

interface Props {
  /** Index of the chosen card, if any. */
  picked: number | null
  onPick: (index: number) => void
  /** Fired once the dialog has closed: Esc, Backspace, Close or a backdrop click. */
  onClose: () => void
}

export default function RecommendationsDialog({ picked, onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const pickedOnOpen = useRef(picked)

  // Native modal: the guide behind becomes inert. Focus starts on the chosen card, else
  // the first one (only on open; later picks leave focus where the user is).
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    d.querySelectorAll<HTMLElement>('.rec-card')[pickedOnOpen.current ?? 0]?.focus()
  }, [])

  const close = () => ref.current?.close()

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) return // see the guard in App
    const target = e.target as HTMLElement
    const cards = Array.from(ref.current?.querySelectorAll<HTMLElement>('.rec-card') ?? [])
    const closeBtn = ref.current?.querySelector<HTMLElement>('.rec-close')
    const i = cards.indexOf(target)
    if (e.key === 'Backspace' || e.key === 'BrowserBack') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (i >= 0) cards[Math.min(cards.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))]?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      closeBtn?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (target === closeBtn || i < 0) cards[picked ?? 0]?.focus()
    } else if (e.key === 'Tab') {
      // Tab cycles inside the dialog instead of escaping to the browser's own UI.
      const all = [...cards, ...(closeBtn ? [closeBtn] : [])]
      const at = all.indexOf(target)
      if (e.shiftKey ? at <= 0 : at === all.length - 1) {
        e.preventDefault()
        all[e.shiftKey ? all.length - 1 : 0].focus()
      }
    }
  }

  // Clicks on the backdrop land on the <dialog> element itself.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && e.detail === 1) close()
  }

  return (
    <dialog
      ref={ref}
      className="programme-dialog rec-dialog"
      aria-labelledby="rec-title"
      aria-describedby="rec-note"
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {/* Focusable so a click on plain text inside keeps focus in the dialog. */}
      <div className="state-card dialog-card rec-card-shell" tabIndex={-1}>
        <h2 className="state-title dialog-title" id="rec-title">
          <Icon name="sparkles" size="1.1em" />
          Recommendations
        </h2>
        <p className="dialog-note" id="rec-note">
          <Icon name="info" size="1.1em" />
          Demo picks — personalised recommendations aren't connected yet.
        </p>
        <div className="rec-row" role="group" aria-label="Recommendations">
          {RECOMMENDATIONS.map((r, i) => (
            <button
              key={r.title}
              type="button"
              className="rec-card"
              aria-pressed={picked === i}
              onClick={() => onPick(i)}
            >
              <span className={`rec-art ${r.art}`} aria-hidden="true">
                <Icon name="play" size="2.25rem" />
              </span>
              <span className="rec-title">{r.title}</span>
            </button>
          ))}
        </div>
        <div className="state-actions rec-actions">
          <button type="button" className="btn btn-secondary rec-close" onClick={close}>
            <Icon name="guide" />
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}
