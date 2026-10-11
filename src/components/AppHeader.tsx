import { formatDate, formatTime, useNow } from '../lib/time'

export default function AppHeader() {
  const now = useNow(5_000)
  return (
    <header className="app-header">
      <div className="brand" aria-label="CGates TV">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">CGates</span>
        <span className="brand-product">TV</span>
      </div>

      <nav className="app-nav" aria-label="Main">
        {/* The current (and only) page: an indicator, not a control. */}
        <span className="nav-item" aria-current="page">
          Guide
        </span>
      </nav>

      <div className="app-header-end">
        <time className="clock" dateTime={new Date(now).toISOString()}>
          <span className="clock-time">{formatTime(now)}</span>
          <span className="clock-date">{formatDate(now)}</span>
        </time>
      </div>
    </header>
  )
}
