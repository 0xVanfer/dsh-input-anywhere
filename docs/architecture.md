# Architecture

## Design objective

The plugin changes the location and dimensions of the existing DSH composer without owning its input state. Replacing `conversation.composer.bar` would duplicate private state-machine behavior and break unrelated Slot contributors, so the implementation uses the additive `conversation.input.left` Slot only as an interaction entry point.

## Package composition

- `src/index.ts`: Host registration for the durable `dsh-input-anywhere` settings schema.
- `src/preferences-contract.ts`: shared preference types, defaults, field list, and defensive normalization.
- `src/client/index.ts`: Client settings scope, locale, Slot registration, and lifecycle-owned stylesheet installation.
- `src/client/InputAnywhereSettings.tsx`: dedicated `settings.section` controls.
- `src/client/preferences.ts`: official `SettingsScope` adapter, browser fallback, and fallback-to-Host migration.
- `src/client/InputAnywhereControls.tsx`: React interaction controller, observers, layout persistence, and Slot UI.
- `src/client/dom.ts`: composer DOM discovery, geometry adapters, overlap detection, extension measurement, and scoped style ownership.
- `src/client/layout.ts`: pure layout persistence and geometry functions.
- `src/client/styles.ts`: settings, responsive, focus, coarse-pointer, floating-state, and opacity CSS.

The production Client entry is bundled as DSH lazy-CJS and registers through `window.__ModuleLoader__` with package id `dsh-input-anywhere`.

## Runtime sequence

1. The Host registers the `dsh-input-anywhere` schema when the optional settings service is available.
2. The Client binds that namespace, installs its bilingual settings section, and exposes a browser-local writable fallback while Host settings are unavailable.
3. DSH renders the `conversation.input.left` contribution for a session when the master switch is enabled.
4. The component discovers the nearest composer card, seat, conversation scroller, and phase root by stable data markers.
5. Discovery is retried after child-tree and marker-attribute changes. If marker ancestors are replaced, pointer capture, pending target-specific animation frames, and the old target projection are cleaned before new targets are bound.
6. The move control reads the native card and seat rectangles and creates an initial floating layout in viewport CSS pixels.
7. React state owns the serializable layout. CSS custom properties project the state onto the native seat and card.
8. Pointer changes are coalesced through one animation frame. Keyboard changes commit directly.
9. Resize, mutation, viewport, orientation, scroll, and transition notifications share one cancellable animation-frame scheduler, so each frame performs at most one re-clamp and overlap refresh.
10. Reset, disabling, Slot teardown, or plugin stop removes plugin-owned DOM changes and returns control to native layout CSS.

## Coordinate model

`FloatingLayout` stores:

- `x`, `y`: viewport-space position of the composer seat;
- `width`: total seat width;
- `height`: composer card height;
- `anchor`: optional left or right boundary attachment.

The whole seat may include notices or dock contributors outside the card. `extraHeight` reserves that measured difference when clamping the card vertically.

The preferred bounds are the intersection of the conversation root and the Visual Viewport. If that intersection is narrower than the minimum composer width, shorter than the minimum card height, or entirely off-screen on either axis, the full Visual Viewport becomes the fallback. This avoids reducing or persisting a composer into an unusable strip.

A horizontal anchor stores intent rather than a stale coordinate. Re-clamping computes the current left or right coordinate from the latest bounds, which allows the composer to follow sidebar and details-panel changes. Resizing preserves an anchor only when its fixed side is also the geometric opposite edge; otherwise the anchor is released so the opposite resize edge remains stable whenever viewport and minimum-size constraints permit.

## Fixed-position containment

A transformed or strongly contained ancestor can make `position: fixed` relative to that ancestor instead of the viewport. The plugin detects `transform`, `filter`, `perspective`, relevant `contain`, and related `will-change` values in the ancestor chain. Floating is refused in that case and the native dock remains active.

This is a deliberate fail-closed behavior. Correctly converting viewport coordinates through arbitrary transformed coordinate systems would require owning or moving DOM outside the native React tree, which conflicts with the primary design objective.

## Extension handling

The plugin does not enumerate or serialize Slot data. It interacts only with rendered DOM leaves required for layout:

- all normal-flow card children except the input scroller contribute their border-box height and vertical margins to dynamic minimum height;
- absolutely or fixed-positioned overlays do not consume minimum height;
- added, removed, resized, or restyled card children are synchronized through scoped mutation/resize observers;
- the toolbar trailing branch is marked as a region, not assigned to a guessed model owner;
- at extreme widths, every trailing menu control receives the same compact rule;
- third-party DOM is never moved independently from the native seat.

## Appearance inheritance

The native composer uses `--dsw-specific-input-major`; native Todo, Goal, and Queue dock panels use `--dsw-specific-tip`; in-seat panels and menus may use `--dsw-specific-menu`. Appearance extensions may encode card or main-interface opacity in `--dsw-alias-bg-layer-1`, `--dsw-alias-bg-layer-2`, and `--dsw-alias-bg-base`. During floating only, the DOM adapter resolves inherited colors and writes plugin-owned `--dsh-input-anywhere-surface` and `--dsh-input-anywhere-menu-surface` paint values. Hex, RGB/HSL, modern `hwb/lab/lch/oklab/oklch/color()` forms, and opaque named colors retain their tint while alpha is replaced. Output never points back to remapped DSH aliases, preventing CSS-variable cycles.

The surface setting can preserve the resolved theme alpha, apply a custom alpha, or retain the opaque native surface. Scoped CSS maps `--dsw-specific-tip` and `--dsw-specific-menu` only inside a marked floating seat. This covers current and future `conversation.input.dock` contributors that follow DSH tokens without enumerating CSS-module classes or mutating contributor nodes. Portaled and header-level UI outside the seat cannot inherit the mapping and is intentionally unaffected.

Output overlap is a strict positive-area intersection between the floating seat and visible `[data-chat-flow]` elements under the current conversation scroller, clipped to usable viewport bounds. Hidden, zero-area, edge-touching, and seat-descendant candidates are excluded. A scoped mutation observer adds, removes, and immediately remeasures flow elements that appear after floating. The official `InputState.draft` and native editor focus are combined into the input-active state. Idle and input-active overlap states independently choose either the effective input surface or a custom alpha. Defaults preserve the theme alpha while idle and use 92% while entering text.

No `opacity` is applied to the complete seat, card, editor, or text. Control opacity is a separate preference scoped to floating-card buttons and selects; it may follow the effective surface, use a custom value, or stay opaque. Ancestor style/class changes trigger re-evaluation, and teardown removes all plugin-owned bridge and control properties. If a live appearance change introduces a fixed-position containing block, the component restores native docking instead of copying blur/filter effects into an invalid coordinate system.

## Persistence

Layout uses the versioned `dsh-input-anywhere:layout:v1` record. Decode validates the version, mode, numeric fields, and optional anchor. Unknown or malformed values return the docked layout. Normal updates are debounced; completed pointer interactions and reset persist immediately, while `pagehide` and unmount flush the latest committed or animation-frame-pending layout.

Preferences use the official Host `dsh-input-anywhere` settings namespace. The schema owns defaults and numeric bounds. Every online or fallback edit first enters the `dsh-input-anywhere:preferences:v1` write-ahead journal as a display snapshot plus per-field `set`/`unset` operations. The controller serializes mutations, then verifies each resolved `SettingsScope` call against the accepted `user`, `value`, and `revision` snapshot because the transport intentionally resolves after rejection recovery as well as success. Only confirmed operations are removed; a partial failure, revision conflict, or teardown preserves the remaining journal for retry. Untouched Host fields are never transferred, and reset is replayed as verified `unset` operations. If browser storage is blocked, the journal remains writable in memory and the settings page identifies it as page-only.

## Lifecycle ownership

The Cordis Client plugin owns the stylesheet, locale dictionary, and preference-controller subscription through `ctx.effect`. The React contribution owns:

- discovery, marker, dependency, and appearance `MutationObserver` instances;
- root, seat, dynamic chat-flow, and card-child `ResizeObserver` subscriptions;
- viewport, window, orientation, and transition listeners;
- animation frames and persistence timers;
- active pointer capture and global interaction classes;
- plugin data attributes, classes, and inline custom properties.

Every owned effect has an explicit disposer or React cleanup path. Tests assert that extension-owned attributes and nodes survive reset and teardown.
