import type { MouseEvent } from 'react'

/**
 * Wraps a click handler so it runs only for real pointer clicks. Keyboard "clicks"
 * (Enter / Space on a focused button) have `detail === 0` and are ignored, which keeps
 * the guide mouse-only.
 */
export const mouseOnly =
  (handler: () => void) =>
  (e: MouseEvent<HTMLElement>): void => {
    if (e.detail !== 0) handler()
  }
