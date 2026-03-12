# CLAUDE.md

## Project

Standalone CLI element picker for Playwright browsers. Connects via CDP, injects a visual overlay (`float-ball.js`), lets the user click an element, and returns raw element info as JSON to stdout. Designed to be invoked by any agent via a skill file — no VS Code extension dependency.

## Tech Stack

- TypeScript (ES2022, Node16 module resolution)
- playwright-core (CDP connection)
- ws (WebSocket for float ball communication)
- minimist (CLI arg parsing)
- esbuild (bundling to `dist/cli.js`)
- vitest (unit testing)
- pnpm (package manager)

## Commands

```bash
pnpm build          # esbuild bundle (src/cli.ts → dist/cli.js) + copy float-ball.js
pnpm lint           # tsc --noEmit (type check only)
pnpm test           # vitest run (unit tests)
```

## Usage

```bash
playwright-picker pick --cdp=<port> [--hint="..."] [--timeout=60]
```

Exit codes: `0` success, `1` timeout, `2` CDP connection failed.

## Architecture

### CLI Entry (`src/cli.ts`)

Parses args with minimist, validates `pick` command + `--cdp` flag, calls `runPicker()`, prints JSON to stdout.

### Picker Process (`src/picker-process.ts`)

Core flow:
1. Connect to browser via `chromium.connectOverCDP()`
2. Start `PickerWsServer` (random port + auth token)
3. Inject `float-ball.js` into all frames with `MODE="pick"`, WS port/token, and pre-computed frame chain
4. Send `activate-picker` via WS after 500ms wait for client connection
5. Wait for `element-selected` WS message or timeout
6. Return `PickerResult` (exitCode + elementInfo)

Exports: `ElementInfo`, `PickerResult`, `PickerOptions`, `runPicker()`, `buildFrameChain()`

### WebSocket Server (`src/ws-server.ts`)

Pure `ws` + `crypto`, zero VS Code dependencies. Token-authenticated, random port on `127.0.0.1`.

### float-ball.js

Source at `src/injected/float-ball.js`. Copied to `dist/injected/` during build by `esbuild.js`'s `copyFloatBall()`.

In `pick` mode: auto-activates picker, shows Confirm/Re-pick buttons after click, sends `element-selected` on Confirm. After confirmation, the entire UI is **removed from the DOM** (`hideAllUI()`) to prevent appearing in subsequent screenshots.

**Float ball UX:**
- Click ball to toggle (minimize/expand) the panel — picker stays active while collapsed
- Drag ball to reposition — ball is clamped to viewport bounds on drag and resize
- Panel follows ball — positioned above (preferred) or below, centered horizontally
- Drag shield prevents iframe mouse capture and accidental element selection during drag

### Skill File (`skill/SKILL.md`)

Documents the `playwright-picker pick` command for agent consumption. Install to workspace `.claude/skills/playwright-picker/`.

## Conventions

- `float-ball.js` is NOT bundled — it's copied as-is (runs in browser, not Node)
- The `__selectorFinderActive` guard prevents double-injection if the extension also injected float-ball.js
- `buildFrameChain()` uses Playwright's Frame API (works cross-origin) to pre-compute iframe ancestry before injection
- After element selection, `hideAllUI()` removes the shadow DOM host from the document and broadcasts `__selector-finder-cleanup` to all iframes — this ensures clean screenshots for investigation
