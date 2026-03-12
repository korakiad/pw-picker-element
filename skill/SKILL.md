---
name: playwright-picker
description: Visual element picker — user clicks element in browser, returns raw element info as JSON
allowed-tools: Bash(playwright-cli:*)
---

## pick-element

Visual overlay that lets the user click an element in the browser. Returns raw element info as JSON.

### Prerequisites

- Browser running with `--remote-debugging-port=<port>`
- `playwright-cli` daemon connected (`playwright-cli open --config=<path>`)

### Step 1: Inject float-ball.js

Read `float-ball.js` from this skill directory, then inject into all frames:

```
playwright-cli run-code "
  const script = `<FLOAT_BALL_JS_CONTENT>`;
  for (const frame of page.frames()) {
    const chain = [];
    let f = frame;
    while (f.parentFrame()) {
      chain.unshift({ tagName: 'iframe', name: f.name() || null, src: f.url() || null });
      f = f.parentFrame();
    }
    try {
      await frame.evaluate(script.replace('__FRAME_CHAIN__', JSON.stringify(chain)));
    } catch {}
  }
"
```

The picker activates automatically — user sees hover highlight overlay.

### Step 2: Poll for result

Poll every 3 seconds until non-null or 60 seconds elapsed:

```
playwright-cli eval "JSON.stringify(window.__pickerResult)"
```

- `null` / `undefined` → user hasn't confirmed yet, keep polling
- JSON string → user confirmed, parse and use

### Step 3: Use element info

Result fields: `tagName`, `id`, `role`, `ariaLabel`, `classList`, `attributes`, `textContent`, `parentPath`, `outerHTML`, `frameChain`

The agent decides how to use this info based on project context (framework, test patterns, POM structure).

### Iframe elements

When `frameChain` is non-null, the element lives inside iframe(s). Each entry has `{ tagName, name, src }`. Use the chain to build the appropriate frame selector for the project's framework.

### Dropdown pattern (multi-step)

If the selected element is a dropdown/select/combobox:
1. First pick returns the dropdown container info
2. Use `playwright-cli click <ref>` to open the dropdown
3. Re-inject float-ball.js and poll again for the option element
4. Build selector from both element infos
