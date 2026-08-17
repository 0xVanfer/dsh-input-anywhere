# Security Policy

## Supported versions

Until the first stable release, security fixes are applied to the latest published `0.1.x` version only.

| Version | Supported |
| --- | --- |
| Latest `0.1.x` | Yes |
| Older prereleases | No |

## Reporting a vulnerability

Do not open a public issue for a vulnerability or for diagnostics containing sensitive conversation data.

Use GitHub's private vulnerability reporting for this repository:

```text
https://github.com/0xVanfer/dsh-input-anywhere/security/advisories/new
```

Include:

- affected plugin, DSH, browser, and operating-system versions;
- required extensions or Slot contributors;
- reproduction steps and impact;
- whether prompts, messages, paths, credentials, or cross-session state may be exposed;
- a minimal proof of concept with sensitive content removed.

The maintainer will acknowledge the report through the private advisory, investigate scope, coordinate a fix and release, and credit the reporter if requested and appropriate. Avoid testing against systems or data you do not own.

## Security model

The plugin is a Client-side UI extension, not a security boundary. It can reposition the existing composer but does not change DSH authorization or submission policy. It performs no network requests and stores only layout geometry in browser `localStorage`.

The most relevant security and privacy risks are:

- a DOM compatibility regression that overlays or obstructs native permission or submission controls;
- stale cleanup that leaves a transparent hit target after plugin stop;
- accidental persistence of content instead of geometry;
- third-party extensions creating unexpected containing blocks or toolbar structures;
- publication of a package artifact that differs from reviewed source.

Release checks therefore include hit testing, modal stacking, scoped teardown, persistence validation, bundle execution, and packed-artifact inspection. See [docs/testing.md](docs/testing.md).

Publication is currently manual. CI verifies an uploadable tarball, but the repository does not claim that a later npm publication is provenance-attested or cryptographically identical until a trusted-publishing workflow is introduced.
