# TV 560407 – Live & Recordings (prototype)

Local-only React + TypeScript + Vite prototype with Shaka Player (MPEG-DASH).

## Run
    npm install
    npm run dev        # open http://localhost:5173 in Chrome or Edge
    npm run lint && npm run build

## Keyboard
- ↑/↓ browse the guide, → jump to player controls, ← back to the guide
- Enter selects, Esc / Backspace returns to live

## Assumptions and limits
- The programme guide is **mock data** generated locally (`src/data/epg.ts`). Add `?epg=empty` or `?epg=error` to the URL to see those states.
- The provided recording URL is a relative 30-second clip from ~2h44m ago. It is attached to the mock programme that was on air then, and labelled "Sample recording". It does not show that programme's real content.
- The recording manifest is Widevine-protected and no licence server was provided, so it is expected to fail with an error message. Live playback is clear DASH.
