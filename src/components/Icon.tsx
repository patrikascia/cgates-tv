const PATHS = {
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  back: 'M15.5 5 8.5 12l7 7',
  replay10: 'M12 5V2L7.5 6 12 10V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z',
  forward10: 'M12 5V2l4.5 4L12 10V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z',
  volume: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15 8.5a5 5 0 0 1 0 7M17.5 6a8.5 8.5 0 0 1 0 12',
  mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9.5l5 5M20.5 9.5l-5 5',
  guide: 'M4 5h16v3H4zM4 10.5h7v3H4zM13 10.5h7v3h-7zM4 16h11v3H4z',
  retry: 'M18.5 9A7 7 0 1 0 19 13M19 4v5h-5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 10.5V17M12 7v.5',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4',
  check: 'M5 12.5 9.5 17 19 7.5',
  bellOff: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4M4 4l16 16',
  sparkles: 'M10 3.5 11.6 8.4 16.5 10 11.6 11.6 10 16.5 8.4 11.6 3.5 10 8.4 8.4zM18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM17.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z',
  // Gear: 8 even teeth on a 24 grid (tips r 8.4, roots r 6.3) around a round hub.
  settings: 'M10.53 5.87L10.83 3.68A8.4 8.4 0 0 1 13.17 3.68L13.47 5.87A6.3 6.3 0 0 1 15.29 6.63L17.06 5.29A8.4 8.4 0 0 1 18.71 6.94L17.37 8.71A6.3 6.3 0 0 1 18.13 10.53L20.32 10.83A8.4 8.4 0 0 1 20.32 13.17L18.13 13.47A6.3 6.3 0 0 1 17.37 15.29L18.71 17.06A8.4 8.4 0 0 1 17.06 18.71L15.29 17.37A6.3 6.3 0 0 1 13.47 18.13L13.17 20.32A8.4 8.4 0 0 1 10.83 20.32L10.53 18.13A6.3 6.3 0 0 1 8.71 17.37L6.94 18.71A8.4 8.4 0 0 1 5.29 17.06L6.63 15.29A6.3 6.3 0 0 1 5.87 13.47L3.68 13.17A8.4 8.4 0 0 1 3.68 10.83L5.87 10.53A6.3 6.3 0 0 1 6.63 8.71L5.29 6.94A8.4 8.4 0 0 1 6.94 5.29L8.71 6.63A6.3 6.3 0 0 1 10.53 5.87ZM14.7 12a2.7 2.7 0 1 0 -5.4 0 2.7 2.7 0 1 0 5.4 0z',
  // Guide category filters
  all: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  music: 'M9 17.5V6l10-2v11.5M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  history: 'M3.5 9 12 4l8.5 5zM5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3.5 20h17',
  sport: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M3 12h18M5.6 5.6c2.6 2.6 2.6 10.2 0 12.8M18.4 5.6c-2.6 2.6-2.6 10.2 0 12.8',
  movies: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4',
} as const

export type IconName = keyof typeof PATHS

const STROKED: ReadonlySet<IconName> = new Set(['back', 'volume', 'mute', 'retry', 'info', 'bell', 'check', 'bellOff', 'all', 'music', 'history', 'sport', 'movies', 'sparkles', 'settings'])

export default function Icon({ name, size = '1.25em' }: { name: IconName; size?: string }) {
  const stroked = STROKED.has(name)
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill={stroked ? 'none' : 'currentColor'}
      stroke={stroked ? 'currentColor' : 'none'}
      strokeWidth={stroked ? 2 : 0}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
      {(name === 'replay10' || name === 'forward10') && (
        <text x="12" y="14.6" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="currentColor" stroke="none">
          10
        </text>
      )}
    </svg>
  )
}
