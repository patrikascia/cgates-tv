import { useEffect, useRef } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import Icon from '../../components/Icon'
import type { AudioOption, TextOption } from '../../player/usePlayer'

interface Props {
  /** Tracks exactly as the stream reports them (see usePlayer). */
  audio: AudioOption[]
  text: TextOption[]
  textVisible: boolean
  onSelectAudio: (option: AudioOption) => void
  onSubtitles: (on: boolean) => void
  onSelectSubtitle: (option: TextOption) => void
  /** Fired once the dialog has closed: Esc, Backspace, Close or a backdrop click. */
  onClose: () => void
}

const names = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' })
  } catch {
    return null
  }
})()

/** "English", "English (Commentary)", "Unknown language" */
function languageName(language: string, label: string | null): string {
  let name = 'Unknown language'
  if (language && language !== 'und') {
    try {
      name = names?.of(language) ?? language
    } catch {
      name = language
    }
  }
  return label && label !== name ? `${name} (${label})` : name
}

export default function PlayerSettingsDialog({
  audio,
  text,
  textVisible,
  onSelectAudio,
  onSubtitles,
  onSelectSubtitle,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  // Native modal: the player behind becomes inert. Focus starts on the first choice that
  // is currently selected, else the first control.
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    ;(d.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? d.querySelector<HTMLElement>('button'))?.focus()
  }, [])

  const close = () => ref.current?.close()

  // Rows of controls, top to bottom: audio choices, subtitles Off/On, subtitle languages,
  // Close. Up/Down move between rows (to the selected choice), Left/Right within a row.
  const rows = () =>
    Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-setting-row]') ?? []).map((row) =>
      Array.from(row.querySelectorAll<HTMLElement>('button')),
    )

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) return // see the guard in App
    const target = e.target as HTMLElement
    const all = rows()
    const r = all.findIndex((row) => row.includes(target))
    if (e.key === 'Backspace' || e.key === 'BrowserBack') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (r < 0) return
      const row = all[r]
      row[Math.min(row.length - 1, Math.max(0, row.indexOf(target) + (e.key === 'ArrowRight' ? 1 : -1)))]?.focus()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next = all[r < 0 ? 0 : Math.min(all.length - 1, Math.max(0, r + (e.key === 'ArrowDown' ? 1 : -1)))]
      ;(next?.find((b) => b.getAttribute('aria-checked') === 'true') ?? next?.[0])?.focus()
    } else if (e.key === 'Tab') {
      // Tab cycles inside the dialog instead of escaping to the browser's own UI.
      const flat = all.flat()
      const at = flat.indexOf(target)
      if (e.shiftKey ? at <= 0 : at === flat.length - 1) {
        e.preventDefault()
        flat[e.shiftKey ? flat.length - 1 : 0]?.focus()
      }
    }
  }

  // Clicks on the backdrop land on the <dialog> element itself.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && e.detail === 1) close()
  }

  const activeAudio = audio.find((a) => a.active) ?? audio[0]

  return (
    <dialog
      ref={ref}
      className="programme-dialog settings-dialog"
      aria-labelledby="settings-title"
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {/* Focusable so a click on plain text inside keeps focus in the dialog. */}
      <div className="state-card dialog-card settings-card" tabIndex={-1}>
        <h2 className="state-title dialog-title" id="settings-title">
          <Icon name="settings" size="1.1em" />
          Settings
        </h2>

        <section className="setting" aria-labelledby="setting-audio">
          <p className="setting-label" id="setting-audio">
            Audio language
          </p>
          {audio.length > 1 ? (
            <div className="setting-options" role="radiogroup" aria-labelledby="setting-audio" data-setting-row>
              {audio.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  role="radio"
                  aria-checked={a.active}
                  className="setting-option"
                  onClick={() => onSelectAudio(a)}
                >
                  {languageName(a.language, a.label)}
                </button>
              ))}
            </div>
          ) : (
            <p className="setting-value">
              {activeAudio ? languageName(activeAudio.language, activeAudio.label) : 'Not reported by this stream'}
              {audio.length === 1 && <span className="setting-hint">Only audio track</span>}
            </p>
          )}
        </section>

        <section className="setting" aria-labelledby="setting-subs">
          <p className="setting-label" id="setting-subs">
            Subtitles
          </p>
          {text.length === 0 ? (
            <p className="setting-value setting-none">No subtitles available for this channel</p>
          ) : (
            <>
              <div className="setting-options" role="radiogroup" aria-labelledby="setting-subs" data-setting-row>
                {[false, true].map((on) => (
                  <button
                    key={String(on)}
                    type="button"
                    role="radio"
                    aria-checked={textVisible === on}
                    className="setting-option"
                    onClick={() => onSubtitles(on)}
                  >
                    {on ? 'On' : 'Off'}
                  </button>
                ))}
              </div>
              {textVisible && (
                <div className="setting-options" role="radiogroup" aria-label="Subtitle language" data-setting-row>
                  {text.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={t.active}
                      className="setting-option"
                      onClick={() => onSelectSubtitle(t)}
                    >
                      {languageName(t.language, t.label)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <div className="state-actions settings-actions" data-setting-row>
          <button type="button" className="btn btn-secondary" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}
