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
} as const

export type IconName = keyof typeof PATHS

const STROKED: ReadonlySet<IconName> = new Set(['back', 'volume', 'mute', 'retry', 'info', 'bell', 'check'])

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
