# Open-Source Research

## Scope

The project began with a review of mature drag, resize, gesture, positioning, panel, and DSH plugin implementations. The objective was not to copy a library API. It was to identify established interaction rules and decide whether a dependency could safely move the complete native DSH composer seat.

Research was evaluated against these requirements:

- preserve the native textarea and input state machine;
- move attachment, permission, model, send/stop, and extension controls together;
- support mouse, touch, pen, keyboard, cancellation, and pointer capture;
- clamp against the Visual Viewport and changing shell boundaries;
- avoid invisible handles covering native buttons;
- retain reversible Cordis/React lifecycle ownership;
- keep the public package small and auditable.

## Projects reviewed

| Project | Primary lesson for this plugin |
| --- | --- |
| [react-rnd](https://github.com/bokuweb/react-rnd) | Controlled position and size state, bounds, drag handles, and minimum dimensions. |
| [react-draggable](https://github.com/react-grid-layout/react-draggable) | Separating drag initiation from content interaction and avoiding textarea drag capture. |
| [re-resizable](https://github.com/bokuweb/re-resizable) | Directional resize math, minimum sizes, and opposite-edge behavior. |
| [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) | Keyboard-resizable controls and persistence tradeoffs, although panel layout differs from a floating composer. |
| [interact.js](https://github.com/taye/interact.js) | Pointer unification, modifiers, restriction, snapping, and cancellation behavior. |
| [dnd-kit](https://github.com/clauderic/dnd-kit) | Sensor separation, accessibility concerns, and lifecycle-safe drag state. |
| [use-gesture](https://github.com/pmndrs/use-gesture) | Gesture-state normalization across pointer types and cancellation paths. |
| [Floating UI](https://github.com/floating-ui/floating-ui) | Viewport collision concepts and separation of geometry from rendering. |
| [react-use-measure](https://github.com/pmndrs/react-use-measure) | ResizeObserver-driven measurement and the implications of transformed ancestors. |
| [Moveable](https://github.com/daybrush/moveable) | Multi-direction handles, transformed coordinate systems, and control-box hit targets. |
| [Gridstack](https://github.com/gridstack/gridstack.js) | Snapping, responsive constraints, and mobile interaction sizing. |
| [Split.js](https://github.com/nathancahill/split) | Small dependency surface and explicit cleanup for resize interactions. |
| [Shopify Draggable](https://github.com/Shopify/draggable) | Plugin-oriented drag lifecycle and event ownership. |
| [Pragmatic Drag and Drop](https://github.com/atlassian/pragmatic-drag-and-drop) | Deliberate adapters, accessibility, and minimizing assumptions about rendered content. |
| [W3C Pointer Events](https://github.com/w3c/pointerevents) | Normative pointer capture, primary-pointer, button-state, and cancellation behavior. |
| [WAI-ARIA Authoring Practices](https://github.com/w3c/aria-practices) | Matching keyboard behavior and accessible names to the semantics of custom controls. |
| [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) | Native composer ownership, Slot topology, stable data markers, lazy-CJS Client bundles, and profile installation. |
| [dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) | Community DSH package metadata, bundle configuration, and Client plugin packaging patterns. |

Licenses were reviewed at the upstream repositories before using the projects as references. Most interaction libraries in the table use permissive licenses, but no implementation source was copied into this repository. The resulting runtime has no third-party drag/resize dependency.

## Why no drag/resize runtime dependency

Mature libraries solve general transformation, grid, collision, and gesture problems. This plugin has a narrower but unusual requirement: reposition an existing DSH-owned DOM seat while preserving its React ownership and every nested Slot contribution.

A general drag wrapper would either require re-rendering the composer through another component, wrapping an element not owned by this package, or introducing transformation coordinates that interact poorly with fixed-position containing blocks. Four corner directions and one move handle can be expressed with small pure geometry functions, Pointer Events, and browser observers. Keeping those rules local makes lifecycle cleanup and compatibility review more explicit.

This decision should be revisited if the feature grows to include rotation, arbitrary transforms, multi-selection, collision graphs, or complex gesture recognition. Those are established library domains and should not be reimplemented casually.

## Rules derived from the research

1. Enhance the native composer instead of replacing the input machine.
2. Start interactions only from explicit controls, never from the textarea or card body.
3. Use Pointer Events, primary-pointer checks, immediate capture, `pointercancel`, lost-capture cleanup, and `buttons === 0` recovery.
4. Coalesce pointer geometry through animation frames, but flush the latest pending state on completion and teardown.
5. Store position and size as controlled serializable state; treat DOM styles as a projection with explicit cleanup.
6. Keep the full seat footprint inside usable bounds, with Visual Viewport fallback for unusably narrow conversation columns.
7. Represent edge attachment as an anchor intent so sidebar and details changes recompute the correct coordinate.
8. Preserve extension-owned normal-flow rows and observe dynamic child size changes.
9. Use container width, not only window width, for toolbar compaction.
10. Apply narrow-width rules to semantic groups instead of guessing a third-party control's owner.
11. Hide resize visuals until their handle is directly hovered, focused, active, or resizing.
12. Refuse floating when transformed ancestors make viewport coordinates invalid.
13. Validate and version persistence, tolerate unavailable storage, and flush on page hide.
14. Provide native-button semantics, descriptive labels, keyboard alternatives, visible focus, and coarse-pointer target sizing.
15. Keep every class, attribute, property, observer, listener, timer, animation frame, and style lifecycle owned.

## DSH-specific source of truth

The implementation was checked against the live DSH `conversation.input.left` Slot contract and the installed `0.1.0-rc.6` Web packages. Inspect and source review established the marker and toolbar assumptions documented in [compatibility.md](compatibility.md).

Inspect data is used only to confirm contracts. Runtime behavior uses the real Slot and rendered native composer; the plugin does not cache Inspect output or serialize live DSH objects.

## Ongoing review

Upstream links are research references, not vendored dependencies. Before expanding supported DSH or browser ranges, rerun the matrix in [testing.md](testing.md), review upstream interaction guidance, and update this document when a new design decision is derived from another project.
