# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The current development target is `0.1.1`; it has not been tagged or published.

### Changed

- Floating composer cards and seat-local task/todo, goal, queue, and menu surfaces now inherit translucent DSH layer tokens without changing text or control opacity.
- Active floating layouts return to native docking if a theme extension adds a transformed, filtered, or strongly contained ancestor at runtime.
- Browser verification now loads the built Client package, and CI verifies the exact packed artifact before upload.

### Fixed

- Preserve the opposite resize edge at viewport boundaries and release incompatible horizontal anchors.
- Fall back to viewport bounds when the conversation root is vertically outside the visible viewport.
- Release pointer capture and remove stale floating projection when composer markers are replaced or removed.
- Own the positioned containing block required by portaled resize handles.

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

[Unreleased]: https://github.com/0xVanfer/dsh-input-anywhere/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/0xVanfer/dsh-input-anywhere/releases/tag/v0.1.0
