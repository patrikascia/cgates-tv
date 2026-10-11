# CGates TV – Guide & Player (Prototype)

Local-only React + TypeScript + Vite prototype using Shaka Player for MPEG-DASH playback.
Two separate screens: a full-page **programme guide (EPG)** and a dedicated **player**.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge. Designed for 1920×1080 first; it scales with viewport width.

```bash
npm run lint
npm run build
```

## Structure

```
src/
  App.tsx                     screen switching (guide <-> player), guide loading
  data/channels.ts            1 real channel + demo channels (no streams)
  data/epg.ts                 demo schedules, availabilityOf() = what can actually play
  lib/time.ts                 formatting helpers, useNow()
  player/usePlayer.ts         main Shaka player (load, errors, seek range, retry)
  player/previewPlayers.ts    low-bitrate Shaka instances for guide preview + scrubber frames
  screens/guide/              GuideScreen, EpgGrid, DetailsPanel
  screens/player/             PlayerScreen, Scrubber
  components/                 AppHeader, ChannelLogo, Icon
```

## Keyboard / remote controls

**Guide**

- Arrows: move keyboard focus through programmes; the preview card follows the focused programme. Up/Down keep the same point in time across channels.
- Page Up / Page Down: jump 5 channels.
- Enter (or Space) on a programme selects it (green block) and moves focus to the preview card's action button (**Watch now** on air, **Watch recording** once aired, **Set reminder** / **Remove reminder** before it starts). Enter or Space there runs it, once, even if the key is held. Up from the first channel or Shift+Tab also reach the button.
- From the action button: Right = **Recommendations** (next to it), Up = the active category, Down = the selected programme. Recommendations is reached only this way (or with the mouse), not with Tab. From Recommendations: Left = action button; Enter/Space opens the popup. The preview thumbnail is not interactive.
- Recommendations popup: three mock picks (no personalisation service exists). Left/Right between cards, Enter/Space chooses one, Down = Close, Esc / Backspace closes and returns focus to Recommendations.
- Anything that cannot play explains why in a dialog instead of opening the player. Removing a reminder is only possible from the action button.
- In a dialog: focus starts on the main button; arrows or Tab / Shift+Tab move between the controls (Tab wraps around inside the dialog), Enter or Space toggles a checkbox, and Esc / Backspace closes it and returns focus to the button that opened it.
- Esc / Backspace in the grid: return to what's on now.
- Alt+Up / Alt+Down on a programme: move its channel one row up or down.
- Returning from the player or closing any dialog puts focus back on the programme that was selected.

Mouse: hovering previews a programme and never runs anything. A click selects the programme and runs its action: on now = live playback, already aired = the recording or the unavailable state, not started = reminder setup (for a programme with a reminder, its settings; removing is done with the action button). A double-click runs it only once. While the keyboard is in use, a resting mouse pointer is ignored.

States: hover = thin green outline, keyboard focus = green outline, selection = green block. Buttons stay dark: grey border at rest, green border on hover, the same single green border on hover and keyboard focus (also for every player control), green fill only while pressed. New reminders start with the delivery methods saved last time (Email if none yet), kept in memory while the app runs. The CGates green is `#21b14b`.

**Category filters**

The pills above the preview card show **All** (default), **Music**, **History**, **Sport** or **Movies**. Each channel belongs to exactly one category (`category` in `src/data/channels.ts`; a demo assignment based on channel names and mock schedules). All and each category keep their own channel order: reordering in one view never changes another. If a filter hides the selected programme, the programme on now on the first visible channel is selected instead. Keyboard: Down from the header (or Up from the preview card's button) reaches the active pill, Left/Right move between pills, Enter applies one. The filter is kept while you visit the player but resets to All on reload.

**Channel order**

Drag a channel by its logo, name or grip (the dotted handle at the far left) to move the whole row, timeline included. Rows slide aside and a dashed green slot shows where it will land; dragging near the top or bottom edge scrolls the guide, and Esc cancels. Programme blocks are never drag handles. Each view (All, Music, History, Sport, Movies) has its own order, saved together in this browser's `localStorage` (`cgates-tv.channel-orders`), so it survives a reload. An order saved by an earlier version (`cgates-tv.channel-order`, one shared order) is migrated once: every view starts from it, and the old entry is left untouched. Invalid or unavailable storage falls back to the default order. There is no backend.

**Player**

- Focus starts on Play/Pause. Left/Right move through the enabled controls (rewind, forward, Go live, mute). Up goes to the Guide button at the top left; Down returns to Play/Pause.
- **Settings** (gear, after Mute) opens audio language and subtitle options, read from the stream's actual tracks via Shaka. Inside: Up/Down between rows, Left/Right within a row, Enter/Space to choose, Esc / Backspace to close (focus returns to Settings). Choices are applied with Shaka and the popup shows what Shaka reports afterwards. The provided live stream has one audio track (labelled `eng` in its manifest) and no subtitles, so it shows that language and "No subtitles available for this channel"; switching was verified with Shaka's public multi-language demo stream.
- The volume slider and the scrubber are mouse controls and are skipped by the arrow keys, so arrows never change the volume or seek by accident. After using either with the mouse, focus moves to Mute or Play/Pause.
- The scrubber can still be reached with Tab: Left/Right then moves a preview marker by 10 s; it is applied after a short pause, or straight away with Enter. Esc cancels it.
- Space or K: play/pause. M: mute.
- Esc / Backspace: back to the guide.
- While the controls are hidden, the first key press only shows them again.

## What is real and what is demo

- **Live stream (real):** `TV 560407` uses the provided live URL. It is unencrypted and has a **3-minute time-shift buffer**, of which roughly 2:20 can be seeked. The scrubber shows only this window, not the whole programme.
- **Scrubber frame previews (real):** neither stream has a DASH thumbnail track. Instead, a hidden 360p (~450 kbit/s) copy of the live stream is seeked to the hovered time, so the tooltip shows a real decoded frame. This copy loads only after the first interaction with the scrubber and is destroyed when you leave the player. If frames can't be decoded, the tooltip shows only the time and programme.
- **Guide preview (real, live only):** a muted 360p live preview appears only for the programme that is on air on the real channel. Every other programme gets an explicit "no preview" message.
- **Recording (blocked by DRM):** the provided recording URL is a relative 30-second window from about 2 h 44 min ago (a `dynamic` manifest with a 32 s time-shift window). It is attached to whichever demo programme was on air at that time and labelled as a sample. Its manifest declares **Widevine** only (`urn:uuid:edef8ba9-…`, PSSH provider `movidone`), and the init and media segments really are encrypted (`cenc`, `encv`/`enca`, `tenc isProtected=1`, per-sample `senc`). No licence server or credentials were provided, so it cannot be decrypted: in a browser with Widevine the player stops with Shaka error **6012** (`NO_LICENSE_SERVER_GIVEN`), and in one without Widevine (Safari, automated Chrome) with **6001** (`REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE`). The app shows the actual error and code.
- **Enabling recordings:** set `VITE_WIDEVINE_LICENSE_URL` in `.env.local` (not committed) to a licence server URL supplied by CGates and rebuild. If CGates' licence proxy also needs authorisation (a token header, cookie or wrapped request), that has to be added as a Shaka request filter once the scheme is known; nothing is guessed.
- **Demo data:** every schedule, including the real channel's, is generated locally. Demo channels have no stream. Opening one shows an explanation and offers the real live channel instead.
- **Reminders (prototype only):** there is no reminder backend, email service or SMS provider. A reminder and its delivery methods (Email, SMS or both) are kept in the app's in-memory state until the page is reloaded; **no email or SMS is scheduled or sent**, and the dialog says "Demo only — notifications aren't connected yet." `src/data/reminders.ts` (`saveReminder` / `removeReminder`) is the single place to connect a real reminder API.
- Add `?epg=empty` or `?epg=error` to the URL to see the guide's empty and error states.

## Future improvements

- Real EPG API and channel logos.
- A Widevine licence server (or clear-key recording) for recordings.
- Server-side thumbnail tracks (DASH image AdaptationSet), which Shaka supports via `getThumbnails()`. These would be cheaper than decoding frames from a second stream.
