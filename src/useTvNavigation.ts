import { useEffect } from 'react'

// Remote-control style navigation, implemented with real DOM focus so that the
// browser's focus ring, Enter-to-click and screen readers all keep working.
//
//   EPG list:   Up/Down = move between programmes, Right = jump to player controls
//   Controls:   Left/Right = move between buttons, Left on first = back to guide
//   Enter       = activate the focused item (native button behaviour)
//   Esc/Back    = return to live
const buttons = (group: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(`[data-nav="${group}"]:not(:disabled)`))

export function useTvNavigation(onBack: () => void) {
  useEffect(() => {
    let lastEpg: HTMLElement | null = null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack') {
        e.preventDefault()
        onBack()
        return
      }
      if (!e.key.startsWith('Arrow')) return

      const active = document.activeElement as HTMLElement | null
      const group = active?.dataset.nav
      const epg = buttons('epg')
      const controls = buttons('controls')

      // Nothing focused yet: start in the guide on the programme that is on air now.
      if (!group) {
        e.preventDefault()
        const start = epg.find((b) => b.dataset.current) ?? epg[0] ?? controls[0]
        start?.focus()
        return
      }

      const list = group === 'epg' ? epg : controls
      const i = list.indexOf(active as HTMLButtonElement)
      let target: HTMLElement | undefined

      if (group === 'epg') {
        lastEpg = active
        if (e.key === 'ArrowDown') target = list[Math.min(list.length - 1, i + 1)]
        if (e.key === 'ArrowUp') target = list[Math.max(0, i - 1)]
        if (e.key === 'ArrowRight') target = controls[0]
      } else {
        if (e.key === 'ArrowRight') target = list[Math.min(list.length - 1, i + 1)]
        if (e.key === 'ArrowLeft') target = i === 0 ? (lastEpg ?? epg[0]) : list[i - 1]
        if (e.key === 'ArrowDown') target = lastEpg ?? epg[0]
      }

      e.preventDefault()
      target?.focus()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])
}
