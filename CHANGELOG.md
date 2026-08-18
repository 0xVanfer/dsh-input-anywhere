# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Revalidated the Slot contracts, composer marker hierarchy, and full test suite against DeepSeek Harness `0.1.0-rc.7`; updated the development dependency baseline without changing the rc.6-compatible peer range.
- Replaced the engineering-evidence screenshot gallery with a concise three-scene product walkthrough, moving `dsh-any-background` configuration evidence into the compatibility contract.
- Stabilized Happy DOM unit tests under Node 22 by supplying an origin-backed browser storage fixture.
- Localized resize-control accessible names and tooltips in the English and Simplified Chinese dictionaries.

## [0.1.1] - 2026-08-17

### Added

- Dedicated bilingual DSH settings section with a live master switch, independent surface/control opacity modes, overlap-aware idle/input modes, and reset.
- Host-backed preference schema plus writable browser fallback and automatic fallback-to-Host migration.
- Positive-area `[data-chat-flow]` overlap detection using official draft state and native editor focus.
- Master-switch disable now restores and persists native docking, matching the toolbar reset action instead of reviving a prior floating layout when re-enabled.

### Changed

- Floating composer cards and seat-local task/todo, goal, queue, and menu surfaces now inherit resolved DSH layer colors without CSS-variable cycles; configurable control opacity is limited to floating-card controls.
- Theme-follow mode now preserves the resolved background alpha while overlap is idle; the default 92% override applies only while the native editor is focused or contains a draft.
- Active floating layouts return to native docking if a theme extension adds a transformed, filtered, or strongly contained ancestor at runtime.
- Browser verification now loads the built Client package, and CI verifies the exact packed artifact before upload.

### Fixed

- Preserve the opposite resize edge at viewport boundaries and release incompatible horizontal anchors.
- Fall back to viewport bounds when the conversation root is vertically outside the visible viewport.
- Release pointer capture and remove stale floating projection when composer markers are replaced or removed.
- Own the positioned containing block required by portaled resize handles.
- Journal every settings edit before transport, verify resolved Host mutations against accepted snapshots, retain unconfirmed/partial operations across conflicts or teardown, preserve untouched Host fields, and replay offline reset as field-level `unset` operations.
- Rebind overlap measurement when chat-flow nodes appear or disappear, and coalesce geometry notifications to one pass per animation frame.
- Include extension-row vertical margins in floating minimum height and retain alpha for modern CSS color functions.

## [0.1.0] - 2026-08-17

### Added

- Additive `conversation.input.left` move control for the native DSH composer.
- Mouse, touch, pen, and keyboard movement using Pointer Events and pointer capture.
- Four-corner pointer and keyboard resize with dynamic minimum height.
- Left/right edge snapping and boundary-following anchors.
- Versioned local layout persistence with validation and lifecycle flushing.
- Visual Viewport clamping and narrow-conversation fallback.
- Coarse-pointer targets, reduced-motion behavior, and descriptive control names.
- Responsive trailing-menu compaction for native and third-party menu contributors.
- Extension-aware observers for attachment, accessory, and toolbar changes.
- Fail-closed behavior for missing markers and fixed-position containing blocks.
- Unit, DOM, React lifecycle, Chromium CSS, bundle-execution, and packaging checks.
- English and Simplified Chinese project documentation.

[Unreleased]: https://github.com/0xVanfer/dsh-input-anywhere/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/0xVanfer/dsh-input-anywhere/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/0xVanfer/dsh-input-anywhere/releases/tag/v0.1.0
