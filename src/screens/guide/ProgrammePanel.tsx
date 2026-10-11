import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import ChannelLogo from '../../components/ChannelLogo'
import Icon from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { formatDay, formatDuration, formatRange } from '../../lib/time'
import type { Recommended } from './recommended'

interface Props {
  title: string
  icon: IconName
  /** Short honesty note under the title (e.g. that the picks are mock data). */
  note: string
  items: Recommended[]
  now: number
  /** Show #1, #2, … badges on the thumbnails (in list order). */
  ranked?: boolean
  /** A title was clicked; the panel has already started closing. */
  onChoose: (item: Recommended) => void
  /** Fired once the panel has closed (Close, click outside, Esc, or a chosen title). */
  onClose: () => void
}

/** Right-hand side panel listing programmes (used by "Recommended to you" and "Popular now"). */
export default function ProgrammePanel({ title, icon, note, items, now, ranked = false, onChoose, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = `panel-title-${icon}`

  // Native modal: the guide behind becomes inert while the panel is open.
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const close = () => ref.current?.close()

  // Clicks on the backdrop land on the <dialog> element itself.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && e.detail === 1) close()
  }

  const choose = (item: Recommended) => {
    close()
    onChoose(item)
  }

  return (
    <dialog ref={ref} className="side-panel" aria-labelledby={titleId} onClose={onClose} onClick={onClick}>
      <div className="panel-head">
        <h2 className="panel-title" id={titleId}>
          <Icon name={icon} size="1.1em" />
          {title}
        </h2>
        <button type="button" className="btn btn-secondary panel-close" onClick={close}>
          Close
        </button>
      </div>
      <p className="dialog-note panel-note">
        <Icon name="info" size="1.1em" />
        {note}
      </p>
      {items.length === 0 ? (
        <p className="panel-empty">Nothing to show right now.</p>
      ) : (
        <ol className="panel-list" aria-label={title}>
          {items.map((item, i) => {
            const { programme: p, channel, onNow } = item
            const rank = i + 1
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`panel-item${ranked && rank <= 3 ? ' is-top' : ''}`}
                  aria-label={`${ranked ? `#${rank}: ` : ''}${p.title}, ${channel.name}`}
                  onClick={() => choose(item)}
                >
                  <span className={`panel-thumb thumb-${channel.category}${ranked ? ' is-ranked' : ''}`} aria-hidden="true">
                    <ChannelLogo channel={channel} size="sm" />
                    {ranked && <span className={`rank-badge${rank <= 3 ? ' is-top' : ''}`}>#{rank}</span>}
                    {onNow && <span className="tag tag-live">Live</span>}
                    {!onNow && p.recordingUrl && <span className="tag tag-rec">{ranked ? 'Rec.' : 'Sample rec.'}</span>}
                  </span>
                  <span className="panel-item-text">
                    <span className="panel-item-title">{p.title}</span>
                    <span className="panel-item-meta">
                      {channel.name}
                      {!channel.streamUrl && <span className="stream-tag">Demo</span>}
                    </span>
                    <span className="panel-item-meta">
                      {formatDay(p.start, now)}, {formatRange(p.start, p.end)}
                    </span>
                    <span className={`panel-item-when${onNow ? ' is-now' : ''}`}>
                      {onNow ? `On now · ${formatDuration(p.end - now)} left` : `Ended ${formatDuration(now - p.end)} ago`}
                    </span>
                  </span>
                  {/* Same wording as the EPG button for this programme. */}
                  <span className="panel-item-action">
                    <Icon name="play" />
                    {onNow ? 'Watch now' : 'Watch recording'}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </dialog>
  )
}
