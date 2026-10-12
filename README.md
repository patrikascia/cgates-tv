# CGates TV — Guide & Player

A small React + TypeScript prototype for browsing a TV guide and watching live TV. Built with Vite and Shaka Player.

## Getting started

You'll need Node.js and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in Chrome or Edge.

To check the project:

```bash
npm run lint
npm run build
```

## What works

- **TV guide:** Browse programmes, switch between yesterday, today and tomorrow, and filter by category.
- **Channel management:** Drag and drop channels to reorder them.
- **Programme actions:** Select programmes, watch live TV, set reminders and explore recommendations.
- **Live player:** Watch the real TV 560407 stream, with playback controls, a time-shift scrubber and frame previews.
- **Player settings:** View available audio and subtitle options.
- **Demo features:** Recommendations, popularity rankings and reminders are simulated locally.

## What doesn't work yet

**Recording playback is blocked by DRM.** The supplied recording is encrypted with Widevine, but no licence server or authorisation credentials were provided. To enable playback, CGates needs to provide a compatible recording stream, the Widevine licence server URL and any required authorisation details. The app can then be configured to request the licence through Shaka Player.

Reminders aren't connected to a real notification service, and the guide currently uses mock programme schedules. Only TV 560407 has a working live stream.

## What I'd improve next

1. **Fix recording playback** by integrating the required DRM licence service and testing it with a proper recording.
2. **Polish the design** with more consistent styling and improved visual details.
3. **Improve the day selector** so it's more visible and easier to discover, since switching between days is a key part of the guide.
4. **Add a welcome wizard** for first-time users, briefly explaining the main features and helping them discover programme selection, reminders and recommendations.
5. **Add an in-player EPG** so users can browse the TV guide, see what's currently playing and navigate to other programmes without leaving the player.

## Tech stack

React · TypeScript · Vite · Shaka Player · MPEG-DASH
