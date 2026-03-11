---
name: playwright-picker
description: Visual element picker — lets user select an element in the browser
allowed-tools: Bash(playwright-picker:*)
---

## pick-element

`playwright-picker pick --cdp=<port>` — activate visual element picker in a running browser.

The user sees an inspect overlay (hover to highlight, click to select). After selection, the user confirms or re-picks. Returns raw element info as JSON to stdout.

### Arguments

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--cdp` | yes | — | CDP port of running browser |
| `--hint` | no | — | Hint text shown to user |
| `--timeout` | no | `60` | Seconds before timeout |

### Exit codes

- `0` — element selected successfully
- `1` — timeout (user did not select)
- `2` — CDP connection failed or error

### Output fields

`tagName`, `id`, `role`, `ariaLabel`, `classList`, `attributes`, `textContent`, `parentPath`, `outerHTML`, `frameChain`

### Dropdown pattern (multi-step)

If the selected element is a dropdown/select/combobox:
1. First pick returns the dropdown container info
2. Use `playwright-cli click <ref>` to open the dropdown
3. Call `playwright-picker pick --cdp=<port> --hint="Select the option"` again
4. Build selector from both element infos

### Iframe elements

When `frameChain` is non-null, the element lives inside iframe(s). Each entry has `tagName`, `name`, `src`. Use the chain to build `page.frameLocator(...)` selectors.
