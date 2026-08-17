# Testing and Release Verification

## Test layers

### Geometry tests

`tests/layout.test.ts` exercises serializable behavior without a DOM:

- persistence validation and stale-version rejection;
- initial native-to-floating geometry;
- size and position clamping;
- dynamic minimum height;
- opposite-edge preservation during corner resize;
- edge snapping and boundary-following anchors;
- anchor release when moving away.

### DOM adapter tests

`tests/dom.test.ts` runs under Happy DOM and covers:

- conversation/Visual Viewport intersection and narrow-column fallback;
- extension and attachment border boxes plus vertical margins in minimum-height measurement;
- absolute overlay exclusion;
- leading/trailing toolbar discovery without model-owner guessing;
- scoped application and removal of floating markers and custom properties;
- inherited surface resolution across hex, legacy RGB/HSL, modern CSS color functions, named-color fallback, and opaque themes;
- positive-area `[data-chat-flow]` overlap, hidden/edge-touch rejection, idle theme preservation, input-active overrides, and independent surface/control modes.

### React integration tests

`tests/component.test.tsx` mounts the actual Slot component into a mock composer hierarchy. It covers:

- preserving left and right third-party controls while moving the whole seat;
- trailing-region ownership without claiming extension controls;
- extension rows and seat-local dock panels added or resized after floating;
- keyboard move, corner resize, Enter activation, and reset;
- latest-layout persistence during teardown;
- immediate reset persistence;
- marker discovery after a late mount or marker-attribute update;
- explicit pointer-capture cleanup on Escape and unmount;
- transformed-shell fail-closed behavior;
- live appearance-token updates and runtime blur/filter docking;
- master-switch unmount and full floating-style cleanup;
- official draft plus textarea-focus input state driving overlap alpha;
- chat-flow insertion/removal after floating and one-frame coalescing of event/observer bursts;
- denied layout storage;
- missing-marker behavior and lifecycle cleanup.

### Preference and settings UI tests

`tests/preferences.test.ts` validates default filling, numeric clamping, stable snapshots, write-ahead journaling, confirmed Host writes/unsets, resolve-without-commit recovery, partial migration progress, revision-conflict retry, offline reset replay, migration/reset serialization, disposal during a blocked write, and browser-storage getter/setter/removal failures. `tests/settings.test.tsx` exercises the dedicated settings section, mode-dependent controls, reset, read-only Host snapshots, page-only memory fallback, and failed-write reporting.

### Browser integration and CSS tests

`tests/browser/client-runtime.spec.ts` loads the built lazy-CJS Client package through a minimal `window.__ModuleLoader__`, starts with an unavailable Host settings scope, mounts the registered React component in Chromium, and verifies browser fallback activation, exact idle theme alpha, input-focus alpha, DOM discovery, floating projection, marker removal/rebinding, pointer-capture cancellation, and lifecycle disposal.

`tests/browser/responsive.spec.ts` uses a focused composer fixture for CSS behavior that DOM emulators cannot reliably implement:

- composer container-query breakpoints;
- permission/plugin toolbar separation;
- generic trailing-menu compaction;
- native trajectory-clearance override and the owned z-index baseline;
- translucent floating card, task/queue/goal panels, and in-seat menus without whole-seat opacity;
- an owned positioned containing block for resize handles;
- handle visibility only on direct hover/focus;
- 44 px coarse-pointer targets.

The browser tests do not require a running DSH process and do not modify a real profile or session. They exercise the built package in a controlled DSH-shaped DOM, not the complete DSH Web shell.

### Bundle verification

`scripts/verify-bundle.mjs` executes the generated artifacts:

- imports the Host export and verifies optional settings injection plus namespace/schema registration;
- evaluates Client registration in a VM `ModuleLoader` context;
- executes the Client factory with real declared externals;
- verifies the exact external set;
- invokes Client `apply` against a fake Cordis context;
- checks style installation/disposal and additive Slot registration options.

### Packed artifact verification

`scripts/verify-package.mjs` extracts the generated tarball, asserts the exact public packlist, validates export and DSH manifest paths, executes the packed Host/Client artifacts, and installs the tarball into a temporary clean consumer with lifecycle scripts disabled. CI runs this verifier before uploading the artifact.

## Commands

Quick source and build validation:

```sh
pnpm check:quick
```

Full release gate:

```sh
pnpm exec playwright install chromium
pnpm check
```

Use a system Chromium executable:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium pnpm test:browser
```

Create and inspect the npm artifact:

```sh
mkdir -p artifacts
pnpm pack --pack-destination artifacts
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
pnpm verify:package "./artifacts/dsh-input-anywhere-${PACKAGE_VERSION}.tgz"
```

## Package-format note

`publint` reports that `exports["./client"].default` points to CommonJS-style code in a `.js` file inside a `type: module` package. This is intentional: DSH Client packages use the `.js` path as a browser-only lazy-CJS script consumed by `window.__ModuleLoader__`, not by the Node ESM loader. The package follows the same `./client` export convention as the verified DSH `0.1.0-rc.6` packages. Bundle execution is covered by `scripts/verify-bundle.mjs` instead of changing the file to `.cjs`.

## Manual DSH smoke matrix

Before a release, install the packed tarball into a clean Web profile and verify:

| Area | Checks |
| --- | --- |
| Native input | Draft, IME, selection, copy/cut/paste, undo/redo, command menu |
| Submission | Send, stop, queue, steering, disabled and blocked states |
| Native controls | Permission, Plan, model, context meter, attachment actions |
| Extensions | Additional left/right menus, dock rows, accessory and attachment rows |
| Pointer | Mouse, touch, pen, cancel, lost capture, release outside the card |
| Keyboard | Tab order, arrows, Shift+arrows, Enter/Space corner growth, Escape reset |
| Responsive | 320, 390, 768, and 1440 px; sidebar/details open and closed; 200% zoom |
| Viewport | Portrait/landscape, Visual Viewport pan, soft keyboard |
| Layers | Settings modal, menus, tooltips, notices, overlays |
| Settings | Host-backed write/reset, Client-only fallback, fallback migration, theme/custom/opaque modes, idle/input overlap modes |
| Persistence | Reload immediately after move, resize, and reset; denied/corrupt layout and preference storage |
| Lifecycle | Stop, update, HMR, remount, and package removal |

Record DSH, browser, OS, and extension versions in the release notes.

## CI

`.github/workflows/ci.yml` uses commit-pinned Actions, installs the repository-pinned Node/pnpm toolchain and Chromium, runs `pnpm check`, builds the tarball, verifies the packed artifact, and only then uploads it. Pull requests must not bypass browser or package verification.

## Current limitations

Automated browser tests use a controlled fixture rather than a complete DSH runtime. Native input-machine and cross-plugin behaviors still require the manual clean-profile smoke matrix. Firefox, WebKit, assistive-technology combinations, and arbitrary transformed shells are not release claims until dedicated jobs exist.
