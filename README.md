# TV 560407 – Live & Recordings (Prototype)

Local-only React + TypeScript + Vite prototype using Shaka Player for MPEG-DASH playback.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge.

To run checks:

```bash
npm run lint
npm run build
```

## Keyboard controls

- ↑ / ↓ — browse the programme guide
- → — move to player controls
- ← — return to the programme guide
- Enter — select an item
- Esc / Backspace — return to live TV

## Assumptions and limitations

- **Mock EPG:** The programme guide is generated locally in `src/data/epg.ts`. No real EPG API was provided. Add `?epg=empty` or `?epg=error` to the URL to test the empty and error states.
- **Sample recording:** The provided recording URL represents a relative 30-second time window from approximately 2 hours and 44 minutes earlier. It is attached to a mock programme and does not represent that programme's actual content.
- **DRM:** The recording stream may require a Widevine licence server, which was not provided. Playback may therefore fail. The error state should communicate this limitation clearly.
- **Playback verification:** Live and recording playback should be tested in the target browser. Do not assume successful playback without verification.

## Future improvements

- Obtain a suitable recording URL and, if required, the Widevine licence server details from CGates.
- Connect the programme guide to a real EPG API.
- Test keyboard navigation and playback on different screen sizes.
