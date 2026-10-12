import { useCallback, useMemo, useState } from 'react'
import type { GuideLoad, Selection } from '../../App'
import AppHeader from '../../components/AppHeader'
import Icon from '../../components/Icon'
import type { Channel } from '../../data/channels'
import { availabilityOf, dayView, phaseOf, programmeAt } from '../../data/epg'
import type { Programme } from '../../data/epg'
import type { ReminderMethods } from '../../data/reminders'
import { mouseOnly } from '../../lib/mouseOnly'
import { startOfDay, useNow } from '../../lib/time'
import type { DayOffset } from '../../lib/time'
import CategoryFilters from './CategoryFilters'
import type { CategoryFilter } from './CategoryFilters'
import { useChannelOrders } from './channelOrder'
import DetailsPanel from './DetailsPanel'
import EpgGrid from './EpgGrid'
import ProgrammeDialog from './ProgrammeDialog'
import RecommendationsDialog from './RecommendationsDialog'
import ProgrammePanel from './ProgrammePanel'
import { pickPopular, pickRecommended } from './recommended'
import type { Recommended } from './recommended'
import type { DialogKind } from './ProgrammeDialog'
import './guide.css'

interface Props {
  load: GuideLoad
  /** Programme to select on arrival, e.g. the one just watched. */
  initialSelectedId: string | null
  onSelectionChange: (id: string | null) => void
  category: CategoryFilter
  onCategoryChange: (category: CategoryFilter) => void
  /** Day shown: yesterday (-1), today (0) or tomorrow (1). */
  day: DayOffset
  onDayChange: (day: DayOffset) => void
  /** Reminder delivery methods by programme id. */
  reminders: ReadonlyMap<string, ReminderMethods>
  /** Delivery methods pre-selected for a new reminder: the last ones saved, else Email. */
  preferredMethods: ReminderMethods
  onReminderSaved: (programmeId: string, methods: ReminderMethods) => void
  onReminderRemoved: (programmeId: string) => void
  onOpen: (selection: Selection, options?: { keepSelection?: boolean }) => void
  onWatchLive: () => void
  onRetry: () => void
}

type Dialog = { kind: DialogKind; programme: Programme; channel: Channel }

const NO_CHANNELS: Channel[] = []

export default function GuideScreen({
  load,
  initialSelectedId,
  onSelectionChange,
  category,
  onCategoryChange,
  day,
  onDayChange,
  reminders,
  preferredMethods,
  onReminderSaved,
  onReminderRemoved,
  onOpen,
  onWatchLive,
  onRetry,
}: Props) {
  const now = useNow(15_000)
  // The guide is mouse-only: hover previews a programme, a click selects it, and a click
  // on the selected programme runs its action.
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId)
  const [hovered, setHovered] = useState<Programme | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  // Recommendations popup (mock picks) and the card chosen in it.
  const [recsOpen, setRecsOpen] = useState(false)
  const [pickedRec, setPickedRec] = useState<number | null>(null)
  // Side panels with mock picks from the guide: "Recommended to you" and "Popular now".
  const [panel, setPanel] = useState<'recommended' | 'popular' | null>(null)

  const guide = load.state === 'ready' ? load.guide : null
  // All and each category have their own saved channel order (drag and drop).
  const { channelsFor, moveChannel } = useChannelOrders(guide?.channels ?? NO_CHANNELS)
  const visibleChannels = useMemo(() => channelsFor(category), [channelsFor, category])
  // The chosen day, 00:00 to 24:00 local time. The grid shows only that day.
  const dayStart = startOfDay(now, day)
  const dayEnd = startOfDay(now, day + 1)
  const orderedGuide = useMemo(
    () => guide && dayView({ ...guide, channels: visibleChannels }, dayStart, dayEnd),
    [guide, visibleChannels, dayStart, dayEnd],
  )
  // Bumped when the user picks Today: the grid scrolls back to the current time.
  const [nowRequest, setNowRequest] = useState(0)
  const reorderVisible = useCallback((id: string, to: number) => moveChannel(category, id, to), [moveChannel, category])
  const channelById = useMemo(() => new Map(guide?.channels.map((c) => [c.id, c])), [guide])
  const programmeById = useMemo(
    () => new Map(Object.values(guide?.programmes ?? {}).flatMap((list) => list.map((p) => [p.id, p]))),
    [guide],
  )

  const select = useCallback(
    (p: Programme) => {
      setSelectedId(p.id)
      onSelectionChange(p.id)
    },
    [onSelectionChange],
  )

  // What is on on the first visible channel at the current time of day, on the given day.
  const firstVisible = useCallback(
    (channels: Channel[], onDay: DayOffset) => {
      const list = guide && channels[0] ? guide.programmes[channels[0].id] : undefined
      const t = Date.now()
      return programmeAt(list, startOfDay(t, onDay) + (t - startOfDay(t)))
    },
    [guide],
  )

  // A category change that hides the selection selects what is on now on the first
  // visible channel instead.
  const changeCategory = useCallback(
    (next: CategoryFilter) => {
      onCategoryChange(next)
      if (!selectedId) return
      const visible = channelsFor(next)
      const channelId = programmeById.get(selectedId)?.channelId
      if (visible.some((c) => c.id === channelId)) return
      const first = firstVisible(visible, day)
      if (first) select(first)
    },
    [onCategoryChange, selectedId, channelsFor, programmeById, firstVisible, select, day],
  )

  // Switching days keeps the time window (the grid keeps its scroll position); picking
  // Today returns to the current time. A selection that is not on the new day is cleared.
  const changeDay = useCallback(
    (next: DayOffset) => {
      onDayChange(next)
      if (next === 0) setNowRequest((n) => n + 1)
      const p = selectedId ? programmeById.get(selectedId) : undefined
      const t = Date.now()
      if (selectedId && !(p && p.end > startOfDay(t, next) && p.start < startOfDay(t, next + 1))) {
        setSelectedId(null)
        onSelectionChange(null)
      }
    },
    [onDayChange, selectedId, programmeById, onSelectionChange],
  )

  // A programme's primary action, from the preview card's button, a click on the selected
  // programme, or the "Recommended to you" panel. Only what can really play opens the
  // player; the rest explains itself here. With a reminder already set, the button removes
  // it while a click on the programme reopens its settings, so a click never deletes
  // anything. From the panel, playing does not change the guide's selection.
  const activate = useCallback(
    (p: Programme, from: 'button' | 'grid' | 'panel') => {
      const channel = channelById.get(p.channelId)
      if (!channel) return
      const t = Date.now()
      const show = (kind: DialogKind) => setDialog({ kind, programme: p, channel })
      if (phaseOf(p, t) === 'upcoming') show(from === 'button' && reminders.has(p.id) ? 'remove-reminder' : 'reminder')
      else if (!channel.streamUrl) show('no-stream')
      else if (availabilityOf(p, channel, t) === 'no-recording') show('no-recording')
      else onOpen({ channel, programme: p }, { keepSelection: from === 'panel' })
    },
    [channelById, reminders, onOpen],
  )
  const activateFromGrid = useCallback((p: Programme) => activate(p, 'grid'), [activate])

  // Panel picks: on now or already aired, never upcoming (see recommended.ts). Recomputed
  // with the guide clock. A chosen title does exactly what its EPG button ("Watch now" /
  // "Watch recording") does, without changing the guide's selection, category or order.
  const recommended = useMemo(() => (guide ? pickRecommended(guide, now) : []), [guide, now])
  const popular = useMemo(() => (guide ? pickPopular(guide, now) : []), [guide, now])
  const choosePanelItem = useCallback((item: Recommended) => activate(item.programme, 'panel'), [activate])

  // The preview card shows the hovered programme, else the selection, else what is on now
  // on the first visible channel. Its button always acts on the programme it shows. A
  // selection or hover on a channel that is not shown counts as absent.
  const visibleIds = new Set(visibleChannels.map((c) => c.id))
  const onScreen = (p: Programme | undefined | null) =>
    p && visibleIds.has(p.channelId) && p.end > dayStart && p.start < dayEnd ? p : null
  const selected = onScreen(selectedId ? programmeById.get(selectedId) : undefined)
  const shown = onScreen(hovered) ?? selected ?? firstVisible(visibleChannels, day) ?? null
  const shownChannel = shown ? channelById.get(shown.channelId) : undefined

  return (
    <div className="guide-screen">
      <AppHeader />

      {guide && guide.channels.length > 0 ? (
        <>
          <CategoryFilters
            value={category}
            onChange={changeCategory}
            end={
              <div className="filter-actions">
                <button
                  type="button"
                  tabIndex={-1}
                  className="btn btn-primary panel-btn popular-btn"
                  aria-haspopup="dialog"
                  onClick={mouseOnly(() => setPanel('popular'))}
                >
                  <Icon name="trending" />
                  Popular now
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  className="btn btn-primary panel-btn recommended-btn"
                  aria-haspopup="dialog"
                  onClick={mouseOnly(() => setPanel('recommended'))}
                >
                  <Icon name="star" />
                  Recommended to you
                </button>
              </div>
            }
          />
          <div className="details-slot">
            {shown && shownChannel && (
              <DetailsPanel
                programme={shown}
                channel={shownChannel}
                now={now}
                hasReminder={reminders.has(shown.id)}
                onActivate={() => activate(shown, 'button')}
                onRecommendations={() => setRecsOpen(true)}
              />
            )}
          </div>
          <EpgGrid
            guide={orderedGuide ?? guide}
            now={now}
            selectedId={selected?.id ?? null}
            onSelect={select}
            onHover={setHovered}
            onOpen={activateFromGrid}
            onReorder={reorderVisible}
            day={day}
            onDayChange={changeDay}
            nowRequest={nowRequest}
          />
          {panel === 'recommended' && (
            <ProgrammePanel
              title="Recommended to you"
              icon="star"
              note="Demo picks from the guide — not personalised."
              items={recommended}
              now={now}
              onChoose={choosePanelItem}
              onClose={() => setPanel(null)}
            />
          )}
          {panel === 'popular' && (
            <ProgrammePanel
              title="Popular now"
              icon="trending"
              note="Mock ranking — not based on real viewing figures."
              items={popular}
              now={now}
              ranked
              onChoose={choosePanelItem}
              onClose={() => setPanel(null)}
            />
          )}
          {recsOpen && (
            <RecommendationsDialog
              picked={pickedRec}
              onPick={setPickedRec}
              onClose={() => setRecsOpen(false)}
            />
          )}
          {dialog && (
            <ProgrammeDialog
              key={dialog.programme.id}
              kind={dialog.kind}
              programme={dialog.programme}
              channel={dialog.channel}
              reminder={reminders.get(dialog.programme.id) ?? null}
              preferredMethods={preferredMethods}
              onReminderSaved={onReminderSaved}
              onReminderRemoved={onReminderRemoved}
              onWatchLive={onWatchLive}
              onClose={() => setDialog(null)}
            />
          )}
        </>
      ) : (
        <div className="guide-state">
          {load.state === 'loading' && (
            <div className="state-card" role="status">
              <span className="spinner" aria-hidden="true" />
              <p className="state-title">Loading the guide</p>
            </div>
          )}
          {load.state === 'error' && (
            <div className="state-card" role="alert">
              <p className="state-title">The guide could not be loaded</p>
              <p className="state-text">{load.message}</p>
              <div className="state-actions">
                <button type="button" className="btn btn-primary" onClick={onRetry}>
                  <Icon name="retry" />
                  Try again
                </button>
                <button type="button" className="btn btn-secondary" onClick={onWatchLive}>
                  <span className="status-dot" aria-hidden="true" />
                  Watch live TV
                </button>
              </div>
            </div>
          )}
          {load.state === 'ready' && (
            <div className="state-card">
              <p className="state-title">No programmes scheduled</p>
              <p className="state-text">There is nothing in the guide right now. Live TV is still available.</p>
              <div className="state-actions">
                <button type="button" className="btn btn-primary" onClick={onWatchLive}>
                  <span className="status-dot" aria-hidden="true" />
                  Watch live TV
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
