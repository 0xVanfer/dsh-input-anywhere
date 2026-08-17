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
- extension and attachment rows in minimum-height measurement;
- absolute overlay exclusion;
- leading/trailing toolbar discovery without model-owner guessing;
- scoped application and removal of floating markers and custom properties.

### React integration tests

`tests/component.test.tsx` mounts the actual Slot component into a mock composer hierarchy. It covers:

- preserving left and right third-party controls while moving the whole seat;
- trailing-region ownership without claiming extension controls;
- extension rows added and resized after floating;
- keyboard move, corner resize, Enter activation, and reset;
- latest-layout persistence during teardown;
- immediate reset persistence;
- marker discovery after a late mount;
- transformed-shell fail-closed behavior;
- denied storage;
- missing-marker behavior and lifecycle cleanup.

### Browser CSS tests

`tests/browser/responsive.spec.ts` runs in Chromium and validates behavior that DOM emulators cannot reliably implement:

- composer container-query breakpoints;
- permission/plugin toolbar separation;
- generic trailing-menu compaction;
- native trajectory-clearance override;
- shell-overlay z-index relationship;
- handle visibility only on direct hover/focus;
- 44 px coarse-pointer targets.

These tests use an isolated composer fixture. They do not require a running DSH process and do not modify a real profile or session.

### Bundle verification

`scripts/verify-bundle.mjs` executes the generated artifacts:

- imports the Host export and checks its inert contract;
- evaluates Client registration in a VM `ModuleLoader` context;
- executes the Client factory with real declared externals;
- verifies the exact external set;
- invokes Client `apply` against a fake Cordis context;
- checks style ownership and additive Slot registration options.

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
npm install --ignore-scripts ./artifacts/dsh-input-anywhere-0.1.0.tgz
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
| Persistence | Reload immediately after move, resize, and reset; denied/corrupt storage |
| Lifecycle | Stop, update, HMR, remount, and package removal |

Record DSH, browser, OS, and extension versions in the release notes.

## CI

`.github/workflows/ci.yml` installs Node and pnpm from repository metadata, installs Chromium, runs `pnpm check`, packs the package, and uploads the tarball. Pull requests must not bypass browser tests.

## Current limitations

Automated browser tests use a controlled fixture rather than a complete DSH runtime. Native input-machine and cross-plugin behaviors still require the manual clean-profile smoke matrix. Firefox, WebKit, assistive-technology combinations, and arbitrary transformed shells are not release claims until dedicated jobs exist.
