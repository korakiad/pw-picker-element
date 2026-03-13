# CLAUDE.md

## Project

Pure skill element picker for Playwright browsers. No CLI binary, no dependencies. An agent reads `float-ball.js`, injects it via `playwright-cli run-code`, and polls `window.__pickerResult` via `playwright-cli eval`. Designed to be used by any agent via the skill file.

## Structure

```
playwright-picker/
  .claude/skills/playwright-picker/
    SKILL.md          # Agent orchestration instructions
    float-ball.js     # Injected into browser (pick-only, zero deps)
  .github/agents/
    playwright-healer.agent.md  # Copilot agent prompt
  CLAUDE.md           # This file
```

## How It Works

1. Agent reads `.claude/skills/playwright-picker/float-ball.js`
2. Injects into browser frames via `playwright-cli run-code` + `addScriptTag({ path })`
3. User clicks element, sees Confirm/Re-pick UI
4. On Confirm: `window.__pickerResult` is set, UI removed from DOM
5. Agent waits via blocking `run-code` poll loop (3s interval, 60s timeout)

See `.claude/skills/playwright-picker/SKILL.md` for full agent instructions.

## float-ball.js

Pick-only overlay injected into the browser. No WebSocket, no Node dependencies.

- Auto-activates picker on injection
- Hover highlight overlay, click to select
- Confirm/Re-pick buttons after selection
- Result written to `window.__pickerResult` on Confirm
- `hideAllUI()` removes shadow DOM host + broadcasts cleanup to iframes
- `__selectorFinderActive` guard prevents double-injection
- `__FRAME_CHAIN__` template variable replaced per-frame before injection

**Float ball UX:**
- Click ball to toggle (minimize/expand) the panel
- Drag ball to reposition — clamped to viewport bounds
- Panel follows ball — positioned above (preferred) or below
- Drag shield prevents iframe mouse capture during drag

## Conventions

- `float-ball.js` runs in browser, NOT Node — no bundling needed
- Cross-iframe: each frame gets its own injection with pre-computed frame chain
- After selection, `hideAllUI()` ensures clean screenshots
