# Contributing

Thank you for improving `dsh-input-anywhere`. Changes should preserve the native DSH input machine and remain reversible when the plugin is stopped or removed.

## Before opening a change

Use an issue for behavior changes, new DOM dependencies, persistence migrations, or support for a new DSH release. Include the DSH version and relevant composer/input Slot contributors.

Security reports must follow [SECURITY.md](SECURITY.md), not a public issue.

## Development setup

Requirements:

- Node.js `>=22.19`;
- pnpm `10.16.1`;
- Chromium for Playwright.

```sh
pnpm install
pnpm exec playwright install chromium
pnpm check
```

A system Chromium executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

## Design constraints

Contributions must follow these ownership rules:

1. Enhance the native composer; do not introduce a second textarea or duplicate private input state.
2. Prefer additive Slots. Replacing `conversation.composer.bar` is outside this plugin's scope.
3. Treat DSH objects and Slot props as live internal data; select only needed leaves.
4. Do not depend on generated CSS-module class names.
5. Keep DOM assumptions documented in `docs/compatibility.md` and covered by tests.
6. Every class, attribute, property, observer, listener, timer, animation frame, pointer capture, and style must have an explicit cleanup path.
7. Unknown or incompatible layouts must remain natively docked instead of receiving guessed coordinates.
8. Do not restyle one third-party control by guessing its Slot owner from incidental order.

## Tests required by change type

| Change | Minimum coverage |
| --- | --- |
| Pure geometry or persistence | `tests/layout.test.ts` |
| DOM discovery or extension behavior | `tests/dom.test.ts` |
| React lifecycle or interaction | `tests/component.test.tsx` |
| Container query, focus, pointer media, or stacking CSS | `tests/browser/*.spec.ts` |
| Bundle or manifest | `scripts/verify-bundle.mjs` and a package dry run |
| DSH compatibility claim | Clean-profile manual matrix in `docs/testing.md` |

Run before submitting:

```sh
pnpm check
git diff --check
pnpm pack --pack-destination artifacts
```

## Code style and comments

- Use TypeScript and the repository's existing formatting.
- Keep geometry functions pure where practical.
- Add comments for ownership boundaries, compatibility assumptions, unusual browser behavior, and cleanup logic.
- Do not narrate obvious assignments or JSX.
- Keep user-facing labels concise and accessible.
- Use ASCII unless a documentation file is intentionally localized.

## Pull requests

A pull request should contain:

- the user-visible problem and resulting behavior;
- DSH, browser, and extension combinations tested;
- tests at the appropriate layers;
- compatibility and documentation updates;
- risk and rollback notes for DOM, persistence, or lifecycle changes.

Do not commit `lib`, Playwright reports, local artifacts, or profile changes. The CI workflow builds and packages from source.

## Releases

Maintainers follow the release procedure in `docs/testing.md`: update the changelog, run the full gate, inspect the tarball, install that exact tarball in a clean DSH profile, complete the manual smoke matrix, then create the release tag and npm publication.
