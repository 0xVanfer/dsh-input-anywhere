# Architecture

## Design objective

The plugin changes the location and dimensions of the existing DSH composer without owning its input state. Replacing `conversation.composer.bar` would duplicate private state-machine behavior and break unrelated Slot contributors, so the implementation uses the additive `conversation.input.left` Slot only as an interaction entry point.

## Package composition

- `src/index.ts`: inert Host half used for package and Client manifest discovery.
- `src/client/index.ts`: Client plugin registration and lifecycle-owned stylesheet installation.
- `src/client/InputAnywhereControls.tsx`: React interaction controller, observers, persistence, and Slot UI.
- `src/client/dom.ts`: composer DOM discovery, geometry adapters, extension-row measurement, and scoped style ownership.
- `src/client/layout.ts`: pure persistence and geometry functions.
- `src/client/styles.ts`: responsive, focus, coarse-pointer, and floating-state CSS.

The production Client entry is bundled as DSH lazy-CJS and registers through `window.__ModuleLoader__` with package id `dsh-input-anywhere`.

## Runtime sequence

1. DSH renders the `conversation.input.left` contribution for a session.
2. The component discovers the nearest composer card, seat, conversation scroller, and phase root by stable data markers.
3. Discovery is retried after child-tree and marker-attribute changes. If marker ancestors are replaced, pointer capture, pending target-specific animation frames, and the old target projection are cleaned before new targets are bound.
4. The move control reads the native card and seat rectangles and creates an initial floating layout in viewport CSS pixels.
5. React state owns the serializable layout. CSS custom properties project the state onto the native seat and card.
6. Pointer changes are coalesced through one animation frame. Keyboard changes commit directly.
7. Resize, mutation, viewport, orientation, scroll, and transition notifications re-clamp the active layout.
8. Reset, Slot teardown, or plugin stop removes plugin-owned DOM changes and returns control to native layout CSS.

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

- all normal-flow card children except the input scroller contribute to dynamic minimum height;
- absolutely or fixed-positioned overlays do not consume minimum height;
- newly added and removed card children are synchronized with a `ResizeObserver`;
- the toolbar trailing branch is marked as a region, not assigned to a guessed model owner;
- at extreme widths, every trailing menu control receives the same compact rule;
- third-party DOM is never moved independently from the native seat.

## Appearance inheritance

The native composer uses `--dsw-specific-input-major`; native Todo, Goal, and Queue dock panels use `--dsw-specific-tip`; in-seat panels and menus may use `--dsw-specific-menu`. Appearance extensions may encode card or main-interface opacity in `--dsw-alias-bg-layer-1`, `--dsw-alias-bg-layer-2`, and `--dsw-alias-bg-base`. During floating only, the DOM adapter reads the inherited values. If a surface contains a real alpha channel below one, it writes plugin-owned `--dsh-input-anywhere-surface` and `--dsh-input-anywhere-menu-surface` references on the seat and adds `data-input-anywhere-themed`. Otherwise no bridge marker or property exists and native tokens remain unchanged.

Scoped CSS on that marked floating seat maps `--dsw-specific-tip` and `--dsw-specific-menu` to the plugin-owned references. This automatically covers current and future `conversation.input.dock` contributors that follow DSH tokens, without enumerating CSS-module classes or mutating contributor nodes. Portaled and header-level UI outside the seat cannot inherit the scoped mapping and is intentionally unaffected.

This is deliberately a background bridge rather than element `opacity`. Text, editor content, controls, extension nodes, focus rings, and hit targets remain fully opaque. The plugin does not inspect another plugin's id/settings or write DSH tokens globally or inline. Ancestor style/class changes trigger re-evaluation, and teardown removes the bridge marker and properties. If a live appearance change introduces a fixed-position containing block, the component restores native docking instead of copying blur/filter effects into an invalid coordinate system.

## Persistence

The versioned record is stored at `dsh-input-anywhere:layout:v1`. Decode validates the version, mode, numeric fields, and optional anchor. Unknown or malformed values return the docked layout.

Normal updates are debounced. Completed pointer interactions and reset persist immediately. `pagehide` and unmount flush the latest committed or animation-frame-pending layout. Storage errors are caught and do not disable the in-memory interaction.

## Lifecycle ownership

The Cordis Client plugin owns the stylesheet through `ctx.effect`. The React contribution owns:

- discovery, marker, dependency, and appearance `MutationObserver` instances;
- root, seat, and child `ResizeObserver` subscriptions;
- viewport, window, orientation, and transition listeners;
- animation frames and persistence timers;
- active pointer capture and global interaction classes;
- plugin data attributes, classes, and inline custom properties.

Every owned effect has an explicit disposer or React cleanup path. Tests assert that extension-owned attributes and nodes survive reset and teardown.
