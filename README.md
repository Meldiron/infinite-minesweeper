# Infinite Minesweeper

Minesweeper on a grid with no edges. Reveal cells, flag mines, and turn 8×8 sectors green by clearing them completely. Your board is saved to your account, so the territory keeps growing between sessions.

**Play it at [minesweeper.almostapps.eu](https://minesweeper.almostapps.eu/)**

![Finishing a sector, zooming out to the sector map, and jumping back in](docs/demo.gif)

## How it plays

- **The grid never ends.** Mines are placed by a hash of each cell's coordinates and a per-game seed, so any part of the board can be generated on demand and it is the same every time you come back.
- **Your first click is always safe.** It clears the mines in a 5×5 area around the cell, which guarantees an opening to start from.
- **Sectors.** The board is split into 8×8 sectors. A sector is finished when every safe cell is revealed and every mine is flagged (or was hit), and it turns green.
- **Five lives.** Hitting a mine costs a life instead of ending the game. A life comes back every 3 minutes, including while you are away. At zero lives you wait for the next one.
- **Zoom from 10% to 200%.** At 50% and below the board switches to a sector map: grey for untouched, lighter grey for in progress, green for finished. Clicking a sector flies you back in to it.
- **Map export.** At 10% zoom you can download your territory as a PNG: 100×100 sectors around the start, with your nickname, tiles cleared, sectors finished, and the percentage explored.
- **Auto-save and multiple devices.** Progress saves one second after your last move. If another device saved in the meantime, the game asks which save to keep.
- **Leaderboard** ranked by tiles opened.
- **Guest play.** Play without an account under a generated nickname, then add an email and password later to keep the progress.
- **Phones.** Tap to reveal, long-press to flag, and a switch at the bottom swaps the two. Pinch to zoom.

## Screenshots

| | |
| --- | --- |
| ![Gameplay at 70% zoom with finished sectors on the left and the unexplored edge on the right](docs/screenshots/gameplay.png) | ![Two lives lost, with the countdown to the next life in the top bar](docs/screenshots/gameplay-lives.png) |
| The edge of a finished area. Green sectors are done; the grey ones on the right are still being worked on. | Lost lives regenerate one at a time, with the countdown next to the hearts. |
| ![Sector map at 20% zoom](docs/screenshots/sector-map.png) | ![Sector map at 10% zoom with the export button](docs/screenshots/sector-map-export.png) |
| Zoomed out, every sector becomes one block. | At 10% the whole territory fits on screen and the PNG export appears. |
| ![Out of lives overlay with a timer](docs/screenshots/out-of-lives.png) | ![Save conflict dialog comparing the server save and this device](docs/screenshots/save-conflict.png) |
| Out of lives: the board locks until a life comes back. | Played on two devices? Pick which save wins. |
| ![Leaderboard with the signed-in player's rank](docs/screenshots/leaderboard.png) | ![Landing page](docs/screenshots/landing-hero.png) |
| Leaderboard, with your own rank pinned on top. | Landing page with sign up, sign in, and guest play. |
| ![Sign up form with a guest option](docs/screenshots/sign-up.png) | ![Choosing a nickname, with an availability check](docs/screenshots/onboarding.png) |
| Sign up with email and password, or skip it. | New accounts pick a unique nickname for the leaderboard. |
| ![Guest banner and the claim account dialog](docs/screenshots/guest-claim.png) | <img src="docs/screenshots/map-export.png" alt="Exported territory map PNG" width="360"> |
| Guests can claim their account at any time without losing progress. | An exported map, ready to share. |

<p align="center">
  <img src="docs/screenshots/mobile-play.png" alt="Gameplay on a phone in reveal mode" width="280">
  &nbsp;&nbsp;
  <img src="docs/screenshots/mobile-flag-mode.png" alt="Gameplay on a phone in flag mode" width="280">
</p>
<p align="center">On a phone, the switch at the bottom flips taps between revealing and flagging.</p>

## Tech stack

- [TanStack Start](https://tanstack.com/start) with React 19, file-based routing and server functions
- [Tailwind CSS](https://tailwindcss.com/) v4 and [shadcn/ui](https://ui.shadcn.com/) components
- The board is drawn on a single `<canvas>`. Below 50% zoom it draws one block per sector instead of individual cells
- [Appwrite](https://appwrite.io/) for accounts (email and password, anonymous guest sessions) and the database: saves, preferences, nicknames, and leaderboard stats
- [Bun](https://bun.sh/) for installing, running, and the production server (`server.ts`)

The game logic lives in [`src/components/minesweeper`](src/components/minesweeper): `useInfiniteGrid.ts` holds the rules (mine placement, flood fill, chording, sectors, lives), `CanvasRenderer.tsx` draws the board, and `MinesweeperGame.tsx` handles input, zoom, saving, and the PNG export. Server functions that talk to Appwrite are in [`src/server/functions`](src/server/functions).

## Running locally

You need [Bun](https://bun.sh/) and an Appwrite project.

```bash
bun install
cp .env.example .env   # then fill in the values below
bun run dev            # http://localhost:3000
```

| Variable | Description |
| --- | --- |
| `APPWRITE_ENDPOINT` | Your Appwrite endpoint, for example `https://cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | Project ID |
| `APPWRITE_API_KEY` | Server API key with access to auth and databases |
| `APPWRITE_DB_ID` | Optional, defaults to `imagine-project-db` |
| `APPWRITE_BUCKET_ID` | Optional, only read by the storage helper in `src/server/lib/storage.ts`, which the game does not use |
| `VITE_INSTRUMENTATION_SCRIPT_SRC` | Optional analytics script URL |

The database and its four collections (`minesweeper_saves`, `user_preferences`, `user_onboarding`, `user_stats`) are defined in [`appwrite.json`](appwrite.json). Change `projectId` to your project and push them with the [Appwrite CLI](https://appwrite.io/docs/tooling/command-line/installation).

Other scripts:

```bash
bun run build   # type-check and build into dist/
bun run start   # serve dist/ with the Bun server in server.ts
```

## Credits

Built with [Imagine](https://imagine.dev/), the AI web builder from [Appwrite](https://appwrite.io/), as one of the projects I made while QA testing it.
