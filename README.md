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

- Arrows: move through programmes. Up/Down keep the same point in time across channels.
- Page Up / Page Down: jump 5 channels.
- Up from the first channel: header navigation.
- Enter: **Watch now** for programmes on now or already aired, or the reminder settings for programmes that have not started. Anything that cannot play explains why in a dialog instead of opening the player.
- The details panel button is **Watch now**, **Set reminder** or **Remove reminder**. Removing is only possible from this button, so a stray Enter in the grid never deletes a reminder.
- In a dialog: arrows move between the controls, Enter or Space toggles a checkbox, and Esc / Backspace returns to the guide.
- Esc / Backspace: return to what's on now.

Hovering with the mouse updates the details panel but never leaves the guide.

**Player**

- Arrows move between the top bar, the scrubber and the control row.
- On the scrubber: Left/Right moves a preview marker by 10 s; it is applied after a short pause, or straight away with Enter. Esc cancels it.
- Space or K: play/pause. M: mute.
- Esc / Backspace: back to the guide.
- While the controls are hidden, the first key press only shows them again.

## What is real and what is demo

- **Live stream (real):** `TV 560407` uses the provided live URL. It is unencrypted and has a **3-minute time-shift buffer**, of which roughly 2:20 can be seeked. The scrubber shows only this window, not the whole programme.
- **Scrubber frame previews (real):** neither stream has a DASH thumbnail track. Instead, a hidden 360p (~450 kbit/s) copy of the live stream is seeked to the hovered time, so the tooltip shows a real decoded frame. This copy loads only after the first interaction with the scrubber and is destroyed when you leave the player. If frames can't be decoded, the tooltip shows only the time and programme.
- **Guide preview (real, live only):** a muted 360p live preview appears only for the programme that is on air on the real channel. Every other programme gets an explicit "no preview" message.
- **Recording:** the provided recording URL is a relative 30-second window from about 2 h 44 min ago. It is attached to whichever demo programme was on air at that time and labelled as a sample. It is **Widevine-encrypted** and no licence server was provided, so playback fails with a clear "copy-protected" message (Shaka error 6001 in Chrome).
- **Demo data:** every schedule, including the real channel's, is generated locally. Demo channels have no stream. Opening one shows an explanation and offers the real live channel instead.
- **Reminders (prototype only):** there is no reminder backend, email service or SMS provider. A reminder and its delivery methods (Email, SMS or both) are kept in the app's in-memory state until the page is reloaded; **no email or SMS is scheduled or sent**, and the dialog says "Demo only — notifications aren't connected yet." `src/data/reminders.ts` (`saveReminder` / `removeReminder`) is the single place to connect a real reminder API.
- Add `?epg=empty` or `?epg=error` to the URL to see the guide's empty and error states.

## Future improvements

- Real EPG API and channel logos.
- A Widevine licence server (or clear-key recording) for recordings.
- Server-side thumbnail tracks (DASH image AdaptationSet), which Shaka supports via `getThumbnails()`. These would be cheaper than decoding frames from a second stream.
