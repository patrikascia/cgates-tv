import type { ReactNode } from 'react'
import Icon from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import type { Category } from '../../data/channels'
import { mouseOnly } from '../../lib/mouseOnly'

export type CategoryFilter = 'all' | Category

// Display order, as specified: All first, then the categories.
const FILTERS: { id: CategoryFilter; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'all' },
  { id: 'music', label: 'Music', icon: 'music' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'sport', label: 'Sport', icon: 'sport' },
  { id: 'movies', label: 'Movies', icon: 'movies' },
]

interface Props {
  value: CategoryFilter
  onChange: (value: CategoryFilter) => void
  /** Extra controls at the right end of the row. */
  end?: ReactNode
}

/** Pill-shaped channel category filters above the preview card. */
export default function CategoryFilters({ value, onChange, end }: Props) {
  return (
    <div className="category-filters">
      <div className="filter-group" role="group" aria-label="Channel categories">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          tabIndex={-1}
          className="filter-pill"
          aria-pressed={f.id === value}
          onClick={mouseOnly(() => onChange(f.id))}
        >
          <Icon name={f.icon} size="1.05em" />
          {f.label}
        </button>
      ))}
      </div>
      {end}
    </div>
  )
}
