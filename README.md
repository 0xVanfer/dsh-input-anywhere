# dsh-input-anywhere

[![CI](https://github.com/0xVanfer/dsh-input-anywhere/actions/workflows/ci.yml/badge.svg)](https://github.com/0xVanfer/dsh-input-anywhere/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Move and resize the native DeepSeek Harness Web composer without replacing its input machine.

[简体中文](README.zh-CN.md)

> **Release status:** `0.1.0` is an experimental compatibility release for DeepSeek Harness `0.1.0-rc.6`. The plugin relies on documented Slot contracts and a small set of currently stable composer DOM markers. Review the [compatibility contract](docs/compatibility.md) before using it with another DSH release or a replacement composer.

## Overview

`dsh-input-anywhere` adds a compact move control to `conversation.input.left`. Activating the control floats the entire native composer seat. The user can move it, resize it from any corner, snap it to a horizontal boundary, or restore native docking.

The plugin deliberately does **not** create another textarea and does not replace `conversation.composer.bar`. Moving the native seat keeps these features in the original React tree:

- draft state, IME composition, selection, undo/redo, commands, and references;
- attachments, accessories, notices, queue and steering controls;
- permission, plan, model, context, send, and stop controls;
- `conversation.input.left`, `conversation.input.right`, `conversation.input.dock`, and `conversation.composer.dock` contributions.

## Verified Behavior

- Pointer Events and pointer capture for mouse, touch, and pen.
- Four-corner resize with dynamic minimum height for attachments and extension rows.
- Arrow-key movement and resize, with `Shift` for one-pixel adjustments.
- `Enter` or `Space` growth from a focused resize corner.
- Visual Viewport clamping during window, orientation, and soft-keyboard changes.
- Left and right edge snapping that follows conversation-boundary changes.
- Container-query rules that prevent permission, extension, model, and plugin controls from overlapping.
- Versioned `localStorage` persistence with validation, page-hide flushing, and re-clamping.
- Forty-four-pixel controls on coarse-pointer devices.
- Scoped cleanup of classes, attributes, inline properties, observers, listeners, pointer capture, timers, and animation frames.
- Native trajectory clearance removal while floating and restoration after reset.

## Requirements and Compatibility

| Component | Status |
| --- | --- |
| DeepSeek Harness `0.1.0-rc.6` | Verified |
| Cordis `4.0.1` | Verified |
| React / React DOM 18 | Verified through the DSH Web profile |
| Chromium, fine pointer | Automated Playwright coverage |
| Chromium, coarse pointer emulation | Automated Playwright coverage |
| Firefox and WebKit | Not yet claimed |
| Replacement composer implementations | Conditional; see below |

The package peer range allows compatible DSH releases below `0.2.0`, but that range is not a claim that every release has been tested. See [docs/compatibility.md](docs/compatibility.md) for the exact Slot, marker, browser, and extension contract.

## Installation

### Published package

```sh
dsh plugin --profile web add dsh-input-anywhere
```

Restart the Web profile after adding or removing the package. DSH resolves package manifests and the Client plugin roster at process startup.

Remove the package with:

```sh
dsh plugin --profile web remove dsh-input-anywhere
```

### Local checkout

```sh
pnpm install
pnpm check
dsh plugin --profile web add /absolute/path/to/dsh-input-anywhere
```

Restart the Web profile, then open the existing DSH Web URL.

## Usage

| Control | Pointer | Keyboard |
| --- | --- | --- |
| Six-dot move control | Click to float; drag to move | Arrow keys move 10 px; `Shift` + Arrow moves 1 px; `Escape` resets |
| Resize corner | Drag from the selected corner | Arrow keys resize 10 px; `Shift` + Arrow resizes 1 px; `Enter` or `Space` grows 10 px from that corner |
| Reset control | Click to restore native docking | Focus and activate normally |

Dragging within 24 px of the left or right usable boundary creates a persistent horizontal anchor. When the sidebar, details region, viewport, or responsive shell changes, an anchored composer follows the corresponding boundary.

## Persistence and Privacy

The layout is stored locally under:

```text
dsh-input-anywhere:layout:v1
```

The value contains only the layout mode, viewport-space position, size, and optional horizontal anchor. It does not contain prompts, messages, workspace paths, model names, or account data. The plugin performs no network requests.

Malformed, stale, or unavailable storage is ignored. The current interaction remains usable in memory. Completed interactions, reset, page hide, and plugin teardown flush the latest layout where browser policy permits it.

## Extension Compatibility

The plugin moves the complete `data-composer-seat`, so contributors already rendered within the native seat move with it. It also:

- measures normal-flow card children added by attachment or accessory extensions;
- observes children added, removed, and resized after floating;
- treats all trailing `aria-haspopup="menu"` controls consistently in an extremely narrow card instead of guessing which extension owns the model control;
- re-discovers the composer when marker ancestors appear late or are replaced;
- removes only `dsh-input-anywhere-*` markers and properties during reset or teardown.

A replacement composer is compatible only when it preserves the marker hierarchy listed in [docs/compatibility.md](docs/compatibility.md). If required markers are absent, the move control has no composer side effects. If an ancestor establishes a fixed-position containing block with `transform`, `filter`, `perspective`, or strong containment, floating is refused and native docking is retained; applying viewport coordinates in that layout would be incorrect.

## Accessibility

The move, reset, and corner controls are native buttons. All controls are keyboard reachable and expose descriptive accessible names. Resize names include the current width and height. Focus indicators use DSH theme tokens, and pointer targets expand on coarse-pointer devices.

This project does not currently claim WCAG conformance or completed screen-reader certification. Accessibility regressions are treated as bugs; include browser and assistive-technology details when reporting one.

## Troubleshooting

### The control is not visible

Confirm that the package appears in the resolved Web profile and restart DSH after installation. The plugin registers in the session-scoped `conversation.input.left` Slot, so it is not rendered on an inert composer without a session.

### Clicking the move control does nothing

Inspect whether a custom shell ancestor uses `transform`, `filter`, `perspective`, `contain: paint/layout`, or related `will-change` values. The plugin intentionally remains docked in those layouts.

### The composer was restored to an older position

Verify that browser storage is enabled. The plugin flushes on completed interaction, reset, `pagehide`, and teardown, but a browser or policy that rejects `localStorage` keeps state only for the current mount.

### Controls overlap in a custom composer

The responsive rules depend on a two-branch toolbar row below `data-composer-card`. Open an issue with a reduced DOM outline and the contributing Slot names; do not include conversation content.

## Development

Prerequisites:

- Node.js `>=22.19`;
- pnpm `10.16.1`;
- a Chromium installation for browser tests.

```sh
pnpm install
pnpm exec playwright install chromium
pnpm typecheck
pnpm test
pnpm test:browser
pnpm build
pnpm check
```

To use an existing Chromium executable instead of a Playwright-managed browser:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium pnpm test:browser
```

`pnpm check:quick` runs type checks, unit/component tests, and the production build without launching a browser. `pnpm check` is the release gate and also runs Playwright.

The browser artifact is `lib/client.js`, a DSH lazy-CJS package registered through `window.__ModuleLoader__`. The Host half is intentionally inert and exists so DSH can discover the `dsh.client` manifest.

For development HMR, run `pnpm watch` in this repository while a DSH Web process with the Client HMR receiver is active. Installing the package into a profile still requires a process restart because manifest discovery is a startup operation.

## Project Documentation

- [Architecture](docs/architecture.md)
- [Compatibility contract](docs/compatibility.md)
- [Testing and release verification](docs/testing.md)
- [Open-source research](docs/research.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

MIT. See [LICENSE](LICENSE).

The implementation is informed by the projects listed in [docs/research.md](docs/research.md). No third-party source code is copied into this repository.
