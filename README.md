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

**Guide (mouse-only)**

The guide is operated with the mouse; it has no keyboard navigation (the player keeps its keyboard controls).

- Hover a programme to preview it in the card above; hovering never runs anything.
- The first click selects a programme (green block) and the preview card shows it. A click on the selected programme runs its action: on now = live playback, already aired = the recording or the unavailable state, not started = reminder setup (for a programme with a reminder, its settings), demo channel = a "no stream" popup. A double-click selects and runs it once.
- The preview card's buttons act on the programme it shows: **Watch now** (on air), **Watch recording** (aired), **Set reminder** / **Remove reminder** (not started), and **Similar to this** (three mock recommendations; no personalisation service exists). Removing a reminder is only possible from this button. The preview thumbnail is not interactive.
- **Recommended to you** (right end of the filter row) opens a side panel with up to 15 mock picks from the guide (not personalised): programmes on now (EPG button "Watch now") and already aired ("Watch recording"); never upcoming ones. Clicking a title does exactly what its EPG button does: it plays when it can (TV 560407 live, or the sample recording), otherwise the existing "no stream" / "No recording available" popup explains why. Selection, category and channel order are left as they were.
- **Popular now** (next to "Recommended to you") opens the same kind of side panel with up to 10 programmes in a **mock** popularity order (a fixed score per programme; not viewing figures), each with a #1–#10 badge, the top three in green. Only programmes on now or already aired *with* an actual recording are eligible; upcoming ones never are. Clicking does exactly what the programme's EPG button does.
- **Day:** click the day in the grid's top-left corner (e.g. "Today · Sun 11 Oct") to choose Yesterday, Today or Tomorrow. Each day is shown 00:00–24:00 at the same scale, so switching days keeps the time window you are looking at (18:30–22:00 today becomes 18:30–22:00 tomorrow); choosing Today returns to the current time. A programme running over midnight appears on both days. A selection that is not on the chosen day is cleared. The chosen day is kept while you visit the player and resets to Today on reload.
- Popups close with their buttons, a click outside, or Esc. Inside a popup the browser's own keyboard handling still works (Tab, Enter / Space on the focused control).

States: hover = thin green outline, selection = green block. Buttons stay dark: grey border at rest, green border on hover, green fill only while pressed. New reminders start with the delivery methods saved last time (Email if none yet), kept in memory while the app runs. The CGates green is `#21b14b`.

**Category filters**

The pills above the preview card show **All** (default), **Music**, **History**, **Sport** or **Movies**. Each channel belongs to exactly one category (`category` in `src/data/channels.ts`; a demo assignment based on channel names and mock schedules). All and each category keep their own channel order: reordering in one view never changes another. If a filter hides the selected programme, the programme on now on the first visible channel is selected instead. Click a pill to apply it. The filter is kept while you visit the player but resets to All on reload.

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
- **Demo data:** every schedule, including the real channel's, is generated locally. Demo channels have no stream. Opening one shows an explanation and offers the real live channel instead. The mock schedule covers yesterday, today and tomorrow (generated once when the guide loads).
- **Reminders (prototype only):** there is no reminder backend, email service or SMS provider. A reminder and its delivery methods (Email, SMS or both) are kept in the app's in-memory state until the page is reloaded; **no email or SMS is scheduled or sent**, and the dialog says "Demo only — notifications aren't connected yet." `src/data/reminders.ts` (`saveReminder` / `removeReminder`) is the single place to connect a real reminder API.
- Add `?epg=empty` or `?epg=error` to the URL to see the guide's empty and error states.

## Future improvements

- Real EPG API and channel logos.
- A Widevine licence server (or clear-key recording) for recordings.
- Server-side thumbnail tracks (DASH image AdaptationSet), which Shaka supports via `getThumbnails()`. These would be cheaper than decoding frames from a second stream.
