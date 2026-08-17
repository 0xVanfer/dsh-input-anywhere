# Compatibility Contract

## Tested baseline

The published `0.1.0` release and current unpublished `0.1.1` development target are tested against:

| Dependency | Tested version |
| --- | --- |
| DeepSeek Harness | `0.1.0-rc.6` |
| Cordis | `4.0.1` |
| React / React DOM | `18.x` through DSH Web |
| Node.js build environment | `22.19` and newer Node 22 releases |
| Browser automation | Chromium through Playwright `1.62` |

Peer ranges below `0.2.0` express expected API compatibility, not proof that every intermediate DSH release was tested.

## Required Slot contract

The plugin registers one list item in:

```text
conversation.input.left
```

Required registration fields and assumptions:

- the Slot remains additive and session scoped;
- `id: input-anywhere` identifies this package's cell;
- the contribution renders inside the native composer card and seat;
- replacing the full composer is outside the plugin's ownership.

## Required DOM markers

A compatible native or replacement composer must preserve this ancestor relationship:

```text
[data-phase]
  [data-conversation-scroll]
    [data-composer-seat]
      [data-composer-card]
        [data-input-scroll]
        toolbar row
          leading branch containing the input.left contribution
          trailing branch
```

The plugin does not depend on DSH CSS-module class names. It adds only names beginning with `dsh-input-anywhere-` or `data-input-anywhere-`.

If the markers are absent at first render, discovery waits for child-tree changes. If a marker ancestor is replaced, the plugin removes its state from the old nodes and rebinds to the new hierarchy. If no compatible hierarchy appears, no composer classes, attributes, or inline properties are applied.

## Additional Slot contributors

The implementation is designed to coexist with:

- multiple `conversation.input.left` controls before or after its cell;
- `conversation.input.right` controls, including additional menus;
- `conversation.input.dock` and `conversation.composer.dock` rows;
- attachment rails, accessory rows, notices, and overlays;
- model-control replacements that use ordinary menu semantics.

At card widths up to 500 px, all menu buttons in the marked trailing branch are compacted consistently. Direct text spans are hidden while the button's accessible name, title, icon, or chevron remains available. Extension authors should provide a meaningful `aria-label` or equivalent accessible name for compactable menu buttons.

Normal-flow card rows contribute to the floating minimum height. `position: absolute` and `position: fixed` overlays are excluded.

## Appearance extensions

The floating seat can inherit transparency from generic DSH surface tokens without depending on an extension package name:

- `--dsw-alias-bg-layer-1` is preferred for the card and `conversation.input.dock` panels;
- `--dsw-alias-bg-layer-2` is preferred for in-seat menus, then layer-1/base is used as fallback;
- `--dsw-alias-bg-base` is the fallback for extensions that expose only main-interface transparency;
- opaque or unrecognized token formats leave `--dsw-specific-input-major`, `--dsw-specific-tip`, and `--dsw-specific-menu` unchanged;
- changes written to `style`, `class`, or `data-ds-dark-theme` on composer ancestors are observed while floating;
- only plugin-owned seat variables and the floating card/seat markers are changed; whole-seat `opacity`, global DSH tokens, portaled UI, and third-party DOM outside the seat are never modified.

This contract covers `dsh-any-background 0.1.7` and similarly implemented appearance extensions. It covers token-based Todo/task, Goal, Queue, and in-seat menu contributors; header-level Subagent/Jobs menus and replacement composers remain owned by their modules. Blur/filter remains subject to fixed-containing-block safety below. Enabling such a value at runtime restores native docking.

## Known incompatibilities

### Fixed-position containing blocks

Floating remains disabled when an ancestor of the composer seat establishes a fixed-position containing block with one of these mechanisms:

- non-`none` `transform`, `filter`, or `perspective`;
- non-`none` `backdrop-filter`;
- `contain: layout`, `paint`, `strict`, or `content`;
- `will-change` for transform, perspective, or filter.

Native docking remains functional. This avoids applying viewport coordinates in an ancestor-local coordinate system.

### Incompatible replacement toolbar

A replacement card with no separate leading and trailing toolbar branches can still float and resize, but the optional narrow-width trailing-menu compaction is not applied.

### Non-browser clients

The package declares `dsh.client.platform: web`. It is not intended for terminal, native, or server-rendered clients.

## Browser capabilities

Required:

- Pointer Events and pointer capture;
- `ResizeObserver` and `MutationObserver`;
- CSS container queries;
- CSS custom properties;
- `localStorage` for persistence, although interaction remains available when storage is denied;
- React portals.

Visual Viewport support is optional. Without it, `window.innerWidth` and `window.innerHeight` are used.

## Reporting compatibility failures

Include:

1. exact DSH and plugin versions;
2. browser and operating-system versions;
3. names and versions of composer/input Slot contributors;
4. whether the composer is native or replaced;
5. a reduced marker/toolbar DOM outline;
6. reproduction steps without conversation content.

Use the repository bug-report form. Compatibility regressions against a listed verified baseline are treated as bugs.
