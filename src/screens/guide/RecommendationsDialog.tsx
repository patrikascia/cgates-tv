import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
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

  // Native modal: the guide behind becomes inert.
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const close = () => ref.current?.close()

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
      onClick={onClick}
    >
      <div className="state-card dialog-card rec-card-shell">
        <h2 className="state-title dialog-title" id="rec-title">
          <Icon name="sparkles" size="1.1em" />
          Similar to this
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
